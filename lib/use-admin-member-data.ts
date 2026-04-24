'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { BBQReservation, ServiceOrder, CouponIssue, Notice } from '@/types';
import type { MemberWithStatusRow } from '@/lib/member-derived-status';

const supabase = createClient();

// 어드민 회원 리스트 훅 — 뷰 기반 파생상태 필드 포함
// statusFilter는 members.status 원본 값 (파생상태 아님). pending/approved/suspended/withdrawn.
export function useMembers(statusFilter?: string) {
  const [members, setMembers] = useState<MemberWithStatusRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_members_list_admin');
    let rows = ((data as MemberWithStatusRow[]) || []).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (statusFilter) rows = rows.filter(r => r.member_status === statusFilter);
    if (error) setMembers([]); else setMembers(rows);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  return { members, loading, refetch: fetch };
}

export function usePendingMembers() {
  return useMembers('pending');
}

export function useAdminReservations(dateFilter?: string) {
  const [reservations, setReservations] = useState<(BBQReservation & { member?: { name: string; phone: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('bbq_reservations')
      .select('*, member:members(name, phone)')
      .order('reservation_date', { ascending: false });
    if (dateFilter) query = query.eq('reservation_date', dateFilter);
    const { data } = await query;
    setReservations(data || []);
    setLoading(false);
  }, [dateFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  return { reservations, loading, refetch: fetch };
}

export function useAdminOrders(statusFilter?: string) {
  const [orders, setOrders] = useState<(ServiceOrder & { member?: { name: string; phone: string }; product?: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('service_orders')
      .select('*, member:members(name, phone), product:store_products(name)')
      .order('created_at', { ascending: false });
    if (statusFilter) query = query.eq('status', statusFilter);
    const { data } = await query;
    setOrders(data || []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  return { orders, loading, refetch: fetch };
}

export function useAdminCoupons() {
  const [coupons, setCoupons] = useState<CouponIssue[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('coupon_issues')
      .select('*, coupon:coupons(*), member:members(name, phone)')
      .order('created_at', { ascending: false });
    setCoupons(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { coupons, loading, refetch: fetch };
}

export function useAdminNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    // 고정 우선: pin_order ASC NULLS LAST → created_at DESC (어드민은 초안 포함해 created_at 기반)
    // PR-H3 draft_id 패턴: 빈 title 의 자동생성 draft 는 목록에서 숨김 (C3 해결)
    //   - 7일 TTL cron (056 fn_notices_prune_drafts) 이 실제 정리 담당
    //   - title 을 한 글자라도 입력하면 목록에 노출됨 (임시저장 상태도 확인 가능)
    const { data } = await supabase
      .from('notices')
      .select('*')
      .neq('title', '')
      .order('pin_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    setNotices(data || []);
    setLoading(false);
  }, []);

  // 마이크로태스크 지연 — react-hooks/set-state-in-effect 회피
  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => { if (alive) fetch(); });
    return () => { alive = false; };
  }, [fetch]);

  // 고정/일반 분리 + 고정 개수 (10건 초과 시 UI warning용)
  const pinnedNotices = notices.filter(n => n.pin_order !== null);
  const normalNotices = notices.filter(n => n.pin_order === null);
  const pinnedCount = pinnedNotices.length;

  return { notices, pinnedNotices, normalNotices, pinnedCount, loading, refetch: fetch };
}
