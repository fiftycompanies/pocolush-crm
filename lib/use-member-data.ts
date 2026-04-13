'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Member, Membership, Farm, BBQReservation, ServiceOrder, CouponIssue, Notice, MemberNotification } from '@/types';

const supabase = createClient();

async function getCurrentMember(): Promise<Member | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('members').select('*').eq('user_id', user.id).maybeSingle();
  return data;
}

export function useMember() {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentMember().then(m => { setMember(m); setLoading(false); });
  }, []);

  return { member, loading };
}

export function useMembership() {
  const [membership, setMembership] = useState<(Membership & { farm?: Farm }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const member = await getCurrentMember();
      if (!member) { setLoading(false); return; }
      const { data } = await supabase
        .from('memberships')
        .select('*, farm:farms(*)')
        .eq('member_id', member.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setMembership(data);
      setLoading(false);
    }
    load();
  }, []);

  return { membership, loading };
}

export function useMyReservations(status?: string) {
  const [reservations, setReservations] = useState<BBQReservation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const member = await getCurrentMember();
    if (!member) { setLoading(false); return; }
    let query = supabase.from('bbq_reservations').select('*')
      .eq('member_id', member.id)
      .order('reservation_date', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data } = await query;
    setReservations(data || []);
    setLoading(false);
  }, [status]);

  useEffect(() => { fetch(); }, [fetch]);

  return { reservations, loading, refetch: fetch };
}

export function useMyOrders() {
  const [orders, setOrders] = useState<(ServiceOrder & { product?: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const member = await getCurrentMember();
    if (!member) { setLoading(false); return; }
    const { data } = await supabase
      .from('service_orders')
      .select('*, product:store_products(name)')
      .eq('member_id', member.id)
      .order('created_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { orders, loading, refetch: fetch };
}

export function useMyCoupons() {
  const [coupons, setCoupons] = useState<(CouponIssue & { coupon?: { name: string; description: string | null } })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const member = await getCurrentMember();
      if (!member) { setLoading(false); return; }
      const { data } = await supabase
        .from('coupon_issues')
        .select('*, coupon:coupons(name, description)')
        .eq('member_id', member.id)
        .order('created_at', { ascending: false });
      setCoupons(data || []);
      setLoading(false);
    }
    load();
  }, []);

  return { coupons, loading };
}

export function useNotices(category?: string) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      let query = supabase.from('notices').select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false });
      if (category) query = query.eq('category', category);
      const { data } = await query;
      setNotices(data || []);
      setLoading(false);
    }
    load();
  }, [category]);

  return { notices, loading };
}

export function useMyNotifications() {
  const [notifications, setNotifications] = useState<MemberNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const member = await getCurrentMember();
      if (!member) { setLoading(false); return; }
      const { data } = await supabase
        .from('member_notifications')
        .select('*')
        .eq('member_id', member.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setNotifications(data || []);
      setLoading(false);
    }
    load();
  }, []);

  return { notifications, loading };
}
