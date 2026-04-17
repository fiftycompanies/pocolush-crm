'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface MembershipRow {
  id: string;
  member_id: string;
  membership_code: string;
  farm_id: string | null;
  plots: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'expired' | 'cancelled';
  benefits: string[] | null;
  plan_name: string | null;
  created_at: string;
  updated_at: string;
  // 조인 결과
  member?: { id: string; name: string; phone: string | null } | null;
  farm?: { id: string; number: number; name: string | null } | null;
}

export interface MembershipFilters {
  status?: 'active' | 'expired' | 'cancelled' | 'all';
  planName?: string;
  endBefore?: string;
  endAfter?: string;
  memberQuery?: string;
  memberId?: string;
}

export function useMembershipsList(filters: MembershipFilters) {
  const supabase = createClient();
  const [rows, setRows] = useState<MembershipRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('memberships')
      .select(
        `id, member_id, membership_code, farm_id, plots, start_date, end_date,
         status, benefits, plan_name, created_at, updated_at,
         member:members!memberships_member_id_fkey(id, name, phone),
         farm:farms(id, number, name)`
      )
      .order('end_date', { ascending: true });

    if (filters.memberId) q = q.eq('member_id', filters.memberId);
    if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
    if (filters.planName) q = q.eq('plan_name', filters.planName);
    if (filters.endBefore) q = q.lte('end_date', filters.endBefore);
    if (filters.endAfter) q = q.gte('end_date', filters.endAfter);

    const { data, error } = await q;
    if (error) {
      console.warn('memberships fetch error', error.message);
      setRows([]);
    } else {
      let list = (data as unknown as MembershipRow[]) || [];
      if (filters.memberQuery) {
        const qstr = filters.memberQuery.toLowerCase();
        list = list.filter(
          r =>
            (r.member?.name || '').toLowerCase().includes(qstr) ||
            (r.member?.phone || '').includes(qstr) ||
            r.membership_code.toLowerCase().includes(qstr)
        );
      }
      setRows(list);
    }
    setLoading(false);
  }, [supabase, filters]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { rows, loading, refetch: fetch };
}
