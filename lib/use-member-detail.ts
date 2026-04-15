'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Member, Membership, FarmRental, Farm, FarmZone, ServiceOrder, StoreProduct, BBQReservation, Coupon, CouponIssue } from '@/types';

export interface StatusLog {
  id: string;
  member_id: string;
  from_status: string;
  to_status: string;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
  changer?: { name: string } | null;
}

export type RentalWithFarm = FarmRental & {
  farm?: Farm & { zone?: FarmZone };
  customer?: { name: string; phone: string };
};

export type OrderWithProduct = ServiceOrder & {
  product?: Pick<StoreProduct, 'name'>;
};

export type CouponWithDetails = CouponIssue & {
  coupon?: Coupon;
};

export interface ActivityItem {
  id: string;
  type: 'rental' | 'order' | 'coupon' | 'bbq' | 'status' | 'membership';
  title: string;
  description: string;
  date: string;
}

export function useMemberDetail(memberId: string) {
  const supabase = createClient();
  const [member, setMember] = useState<Member | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [rentals, setRentals] = useState<RentalWithFarm[]>([]);
  const [orders, setOrders] = useState<OrderWithProduct[]>([]);
  const [coupons, setCoupons] = useState<CouponWithDetails[]>([]);
  const [reservations, setReservations] = useState<BBQReservation[]>([]);
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    // 1. 회원 기본정보
    const { data: m } = await supabase
      .from('members').select('*').eq('id', memberId).single();
    if (!m) { setLoading(false); return; }
    setMember(m);

    // 2. 나머지 병렬 fetch
    const [msRes, ordRes, cpRes, bbqRes, logRes] = await Promise.all([
      supabase.from('memberships').select('*, farm:farms(*, zone:farm_zones(*))').eq('member_id', memberId).order('created_at', { ascending: false }),
      supabase.from('service_orders').select('*, product:store_products(name)').eq('member_id', memberId).order('created_at', { ascending: false }),
      supabase.from('coupon_issues').select('*, coupon:coupons(*)').eq('member_id', memberId).order('created_at', { ascending: false }),
      supabase.from('bbq_reservations').select('*').eq('member_id', memberId).order('reservation_date', { ascending: false }),
      supabase.from('member_status_logs').select('*, changer:profiles(name)').eq('member_id', memberId).order('created_at', { ascending: false }),
    ]);

    // 3. 임대계약 (member_id 직접 또는 phone 매칭)
    let rentalData: RentalWithFarm[] = [];
    const { data: directRentals } = await supabase
      .from('farm_rentals')
      .select('*, farm:farms(*, zone:farm_zones(*)), customer:customers(name, phone)')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false });

    if (directRentals && directRentals.length > 0) {
      rentalData = directRentals;
    } else if (m.phone) {
      // phone 폴백
      const { data: cust } = await supabase.from('customers').select('id').eq('phone', m.phone).maybeSingle();
      if (cust) {
        const { data: phoneRentals } = await supabase
          .from('farm_rentals')
          .select('*, farm:farms(*, zone:farm_zones(*)), customer:customers(name, phone)')
          .eq('customer_id', cust.id)
          .order('created_at', { ascending: false });
        rentalData = phoneRentals || [];
      }
    }

    const activeMembership = msRes.data?.find(ms => ms.status === 'active') || msRes.data?.[0] || null;
    setMembership(activeMembership);
    setRentals(rentalData);
    setOrders(ordRes.data || []);
    setCoupons(cpRes.data || []);
    setReservations(bbqRes.data || []);
    setStatusLogs(logRes.data || []);

    // 4. 활동 타임라인 생성
    const acts: ActivityItem[] = [];
    rentalData.forEach(r => acts.push({
      id: r.id, type: 'rental',
      title: '임대계약',
      description: `${r.farm?.zone?.name || ''} ${r.farm?.number || ''}번 — ${r.plan || '플랜 미지정'}`,
      date: r.created_at,
    }));
    (ordRes.data || []).forEach(o => acts.push({
      id: o.id, type: 'order',
      title: '서비스 신청',
      description: `${o.product?.name || '상품'} — ${o.total_price.toLocaleString()}원`,
      date: o.created_at,
    }));
    (cpRes.data || []).forEach(c => acts.push({
      id: c.id, type: 'coupon',
      title: '쿠폰',
      description: `${c.coupon?.name || '쿠폰'} — ${c.status === 'used' ? '사용완료' : '발급'}`,
      date: c.created_at,
    }));
    (bbqRes.data || []).forEach(b => acts.push({
      id: b.id, type: 'bbq',
      title: 'BBQ 예약',
      description: `${b.bbq_number}번 바베큐장 — ${b.reservation_date}`,
      date: b.created_at,
    }));
    (logRes.data || []).forEach(l => acts.push({
      id: l.id, type: 'status',
      title: '상태 변경',
      description: `${l.from_status} → ${l.to_status}${l.reason ? ` (${l.reason})` : ''}`,
      date: l.created_at,
    }));
    if (activeMembership) {
      acts.push({
        id: activeMembership.id, type: 'membership',
        title: '회원권 발행',
        description: `${activeMembership.membership_code} — ${activeMembership.plots}구좌`,
        date: activeMembership.created_at,
      });
    }
    acts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setActivities(acts);
    setLoading(false);
  }, [supabase, memberId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { member, membership, rentals, orders, coupons, reservations, statusLogs, activities, loading, refetch: fetchAll };
}
