'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import type { BBQBoardRow } from '@/types';

/**
 * KST 자정 경계 안전 — Asia/Seoul 기준 today/tomorrow
 * (reservation_date 는 timezone 없는 DATE — UTC 자정 시점에 점프 위험)
 */
export const todayKST = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

export const dateOffsetKST = (days: number): string => {
  // Asia/Seoul 자정 시점부터 days 더하기 (DST 영향 0, 호스트 TZ 무관)
  const todayStr = todayKST();  // YYYY-MM-DD (KST)
  const [y, m, d] = todayStr.split('-').map(Number);
  // UTC 12:00 으로 고정 (KST 21:00) — 자정 점프 방지
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + days);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(base);
};

// 보드 영향 컬럼 (Realtime watch 필터링 — D1)
// 검수 결과: party_size 도 셀에 표시되므로 watch keys 포함
const BBQ_WATCH_KEYS = [
  'status', 'reservation_date', 'bbq_number', 'time_slot', 'member_id', 'party_size',
] as const;

/**
 * BBQ 보드 데이터 hook
 *
 * Hotfix v2 적용:
 *  - A1: Realtime auth.setAuth(session.access_token) — 401 무한 재시도 차단
 *  - B3: mountedRef 가드 + clearTimeout — unmount 후 setState 방지
 *  - A4: Sentry.captureException 명시 호출
 *  - D1: Realtime 이벤트 debounce(500ms) + watch keys 변경시에만 트리거 (fan-out 폭증 차단)
 */
export function useBBQBoard(dateFrom: string, dateTo?: string) {
  const supabase = createClient();
  const [rows, setRows] = useState<BBQBoardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pausedRef = useRef(false);
  const realtimeOkRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchOnce = useCallback(async (retries = 3) => {
    if (!mountedRef.current) return;
    try {
      const { data, error: rpcError } = await supabase.rpc('get_bbq_board', {
        p_date_from: dateFrom,
        p_date_to: dateTo ?? null,
      });
      if (rpcError) throw rpcError;
      if (!mountedRef.current) return;
      setRows((data as BBQBoardRow[]) ?? []);
      setLastFetched(new Date());
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'RPC 실패';
      if (retries > 0 && mountedRef.current) {
        const delay = (4 - retries) * 1000;  // 1s, 2s, 3s
        if (retryRef.current) clearTimeout(retryRef.current);
        retryRef.current = setTimeout(() => {
          if (mountedRef.current) fetchOnce(retries - 1);
        }, delay);
      } else if (mountedRef.current) {
        setError(msg);
        console.error('[use-bbq-board] fetch failed:', msg);
        Sentry.captureException(e instanceof Error ? e : new Error(msg), {
          tags: { component: 'use-bbq-board', operation: 'get_bbq_board' },
          extra: { dateFrom, dateTo },
        });
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [supabase, dateFrom, dateTo]);

  const startPolling = useCallback((intervalMs: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (pausedRef.current || !mountedRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      fetchOnce();
    }, intervalMs);
  }, [fetchOnce]);

  // D1: Realtime 이벤트 debounce + watch keys 변경시만 트리거
  const handleRealtimeEvent = useCallback((payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE' | string;
    old: Record<string, unknown> | null;
    new: Record<string, unknown> | null;
  }) => {
    if (pausedRef.current || !mountedRef.current) return;
    const o = payload.old;
    const n = payload.new;
    const watchChanged =
      payload.eventType !== 'UPDATE' ||
      BBQ_WATCH_KEYS.some(k => o?.[k] !== n?.[k]);
    if (!watchChanged) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (mountedRef.current && !pausedRef.current) fetchOnce();
    }, 500);
  }, [fetchOnce]);

  // D5: visibilitychange — sleep/wake 후 채널 재구독 + 즉시 갱신
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVis = () => {
      if (document.visibilityState === 'visible' && mountedRef.current && !pausedRef.current) {
        fetchOnce();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [fetchOnce]);

  useEffect(() => {
    mountedRef.current = true;
    fetchOnce();
    startPolling(30000);

    let authSub: { subscription: { unsubscribe(): void } } | null = null;
    let channel: RealtimeChannel | null = null;

    // A1: Realtime 토큰 인증 — anon 401 무한 재시도 차단
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
      // 토큰 갱신 시 자동 반영
      const sub = supabase.auth.onAuthStateChange((_event, s: Session | null) => {
        if (s?.access_token) supabase.realtime.setAuth(s.access_token);
      });
      authSub = sub.data;

      if (!mountedRef.current) return;

      channel = supabase
        .channel('bbq_board')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bbq_reservations' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => handleRealtimeEvent(payload),
        )
        .subscribe(status => {
          if (!mountedRef.current) return;
          if (status === 'SUBSCRIBED') {
            realtimeOkRef.current = true;
            startPolling(300000);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            realtimeOkRef.current = false;
            startPolling(30000);
          }
        });
      channelRef.current = channel;
    })();

    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (authSub?.subscription) authSub.subscription.unsubscribe();
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
