'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * 평상 예약 이력 검색 훅 (2026-05-16)
 *
 * 마이그 082 search_bbq_reservations RPC 호출
 * - admin only + PIPA audit 1h dedup
 * - 페이지네이션 + 기간/상태/시설/검색 필터
 *
 * useBBQBoard 와 별도 — board (실시간 매트릭스) vs history (과거 검색)
 */

export type BBQStatus = 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface BBQHistoryFilters {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;
  query?: string;
  status?: BBQStatus[];
  facilityNumber?: number;
  page: number;
  limit: number;
}

export interface BBQHistoryRow {
  reservation_id: string;
  reservation_date: string;
  time_slot: number;
  slot_label: string | null;
  bbq_number: number;
  bbq_name: string | null;
  status: BBQStatus;
  member_id: string | null;
  member_name: string | null;
  member_phone: string | null;
  party_size: number;
  snapshotted_price: number;
  product_name: string | null;
  created_at: string;
  total_count: number;
}

export function useBBQHistory(filters: BBQHistoryFilters | null) {
  const supabase = createClient();
  const [rows, setRows] = useState<BBQHistoryRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!filters) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('search_bbq_reservations', {
        p_date_from: filters.dateFrom,
        p_date_to: filters.dateTo,
        p_query: filters.query || null,
        p_status: filters.status?.length ? filters.status : null,
        p_facility_number: filters.facilityNumber ?? null,
        p_page: filters.page,
        p_limit: filters.limit,
      });
      if (rpcErr) throw rpcErr;
      const list = (data as BBQHistoryRow[]) ?? [];
      setRows(list);
      setTotalCount(list[0]?.total_count ?? 0);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '검색 실패';
      setError(msg);
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters?.dateFrom,
    filters?.dateTo,
    filters?.query,
    filters?.status?.join(','),
    filters?.facilityNumber,
    filters?.page,
    filters?.limit,
  ]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { rows, totalCount, loading, error, refetch: fetchHistory };
}
