'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Member, BBQReservation, ServiceOrder, CouponIssue, Notice } from '@/types';

const supabase = createClient();

export function useMembers(statusFilter?: string) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('members').select('*').order('created_at', { ascending: false });
    if (statusFilter) query = query.eq('status', statusFilter);
    const { data } = await query;
    setMembers(data || []);
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
  const [orders, setOrders] = useState<(ServiceOrder & { member?: { name: string }; product?: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('service_orders')
      .select('*, member:members(name), product:store_products(name)')
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
    const { data } = await supabase.from('notices').select('*').order('created_at', { ascending: false });
    setNotices(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { notices, loading, refetch: fetch };
}
