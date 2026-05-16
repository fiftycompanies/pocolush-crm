'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * 농장 임대 이력 검색 훅 (2026-05-16)
 *
 * 마이그 087 search_farm_rentals_history RPC 호출
 * - admin only + PIPA audit 1h dedup
 * - 페이지네이션 + 기간/상태/플랜/존/검색 필터
 *
 * useFarmsBoard (085 RPC, 매트릭스) 와 별도 — board (active 현황) vs history (모든 status 검색)
 */

export type FarmRentalStatus = 'active' | 'expired' | 'cancelled';
export type FarmRentalPlan = '씨앗' | '새싹' | '자람';

export interface FarmHistoryFilters {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;
  query?: string;
  status?: FarmRentalStatus[];
  plan?: FarmRentalPlan[];
  zoneId?: string;
  page: number;
  limit: number;
}

export interface FarmHistoryRow {
  rental_id: string;
  farm_id: string;
  farm_number: number;
  farm_name: string | null;
  zone_id: string | null;
  zone_name: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  start_date: string;
  end_date: string;
  rental_plan: FarmRentalPlan | null;
  monthly_fee: number;
  payment_status: string | null;
  rental_status: FarmRentalStatus;
  created_at: string;
  total_count: number;
}

export function useFarmHistory(filters: FarmHistoryFilters | null) {
  const [rows, setRows] = useState<FarmHistoryRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!filters) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: rpcErr } = await supabase.rpc(
        'search_farm_rentals_history',
        {
          p_date_from: filters.dateFrom,
          p_date_to: filters.dateTo,
          p_query: filters.query || null,
          p_status: filters.status?.length ? filters.status : null,
          p_plan: filters.plan?.length ? filters.plan : null,
          p_zone_id: filters.zoneId || null,
          p_page: filters.page,
          p_limit: filters.limit,
        },
      );
      if (rpcErr) throw rpcErr;
      const list = (data as FarmHistoryRow[]) ?? [];
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
    filters?.plan?.join(','),
    filters?.zoneId,
    filters?.page,
    filters?.limit,
  ]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { rows, totalCount, loading, error, refetch: fetchHistory };
}
