'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { BBQBoardRow } from '@/types';

/**
 * KST 자정 경계 안전 — 클라이언트가 항상 Asia/Seoul 기준으로 today/tomorrow 계산
 * (검수 D3: reservation_date 는 timezone 없는 DATE — UTC 자정 시점에 점프 위험)
 */
export const todayKST = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

export const dateOffsetKST = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);
};

/**
 * BBQ 보드 데이터 hook
 * - 072 RPC (`get_bbq_board`) 호출
 * - Supabase Realtime 구독 (성공 시 폴링 간격 5분으로 늘림)
 * - 30s 폴링 fallback (visibility API + pause 가드)
 * - 사이드 패널 오픈 중 폴링 일시정지 (pause/resume)
 * - 3회 exponential backoff retry
 */
export function useBBQBoard(dateFrom: string, dateTo?: string) {
  const supabase = createClient();
  const [rows, setRows] = useState<BBQBoardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pausedRef = useRef(false);
  const realtimeOkRef = useRef(false);

  const fetchOnce = useCallback(async (retries = 3) => {
    try {
      const { data, error: rpcError } = await supabase.rpc('get_bbq_board', {
        p_date_from: dateFrom,
        p_date_to: dateTo ?? null,
      });
      if (rpcError) throw rpcError;
      setRows((data as BBQBoardRow[]) ?? []);
      setLastFetched(new Date());
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'RPC 실패';
      if (retries > 0) {
        const delay = (4 - retries) * 1000;  // 1s, 2s, 3s
        setTimeout(() => fetchOnce(retries - 1), delay);
      } else {
        setError(msg);
        console.error('[use-bbq-board] fetch failed:', msg);
      }
    } finally {
      setLoading(false);
    }
  }, [supabase, dateFrom, dateTo]);

  const startPolling = useCallback((intervalMs: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (pausedRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      fetchOnce();
    }, intervalMs);
  }, [fetchOnce]);

  useEffect(() => {
    fetchOnce();
    startPolling(30000);  // 초기 폴링 30s

    // Realtime 구독 — 성공 시 폴링 간격 5분으로 늘림 (이중 실행 차단, 검수 P2)
    const channel = supabase
      .channel('bbq_board')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bbq_reservations' },
        () => { if (!pausedRef.current) fetchOnce(); },
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          realtimeOkRef.current = true;
          startPolling(300000);  // Realtime OK → 5분 fallback 폴링
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          realtimeOkRef.current = false;
          startPolling(30000);   // Realtime 실패 → 30s 폴링 복귀
        }
      });
    channelRef.current = channel;

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  return {
    rows, loading, error, lastFetched,
    refetch: fetchOnce,
    pausePolling: () => { pausedRef.current = true; },
    resumePolling: () => { pausedRef.current = false; },
    isRealtimeOk: realtimeOkRef.current,
  };
}
