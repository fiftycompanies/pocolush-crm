'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type RequestType = 'bbq' | 'order' | 'coupon';
export type UnifiedStatus = 'pending' | 'processing' | 'completed' | 'cancelled';

export interface UnifiedRequest {
  id: string;
  type: RequestType;
  memberName: string;
  memberPhone: string;
  detail: string;
  amount: number;
  date: string;
  rawStatus: string;
  unifiedStatus: UnifiedStatus;
  paymentStatus?: string;
  adminNote?: string | null;
}

// 통합 상태 매핑
function mapBBQStatus(s: string): UnifiedStatus {
  if (s === 'confirmed') return 'pending';
  if (s === 'completed') return 'completed';
  return 'cancelled';
}
function mapOrderStatus(s: string): UnifiedStatus {
  if (s === 'pending') return 'pending';
  if (s === 'processing') return 'processing';
  if (s === 'completed') return 'completed';
  return 'cancelled';
}
function mapCouponStatus(s: string): UnifiedStatus {
  if (s === 'issued') return 'pending';
  if (s === 'used') return 'completed';
  return 'cancelled';
}

export function useRequests(typeFilter?: string, statusFilter?: string) {
  const supabase = createClient();
  const [items, setItems] = useState<UnifiedRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const results: UnifiedRequest[] = [];

    if (!typeFilter || typeFilter === 'bbq') {
      const { data } = await supabase
        .from('bbq_reservations')
        .select('*, member:members(name, phone)')
        .order('created_at', { ascending: false })
        .limit(100);
      (data || []).forEach((b: any) => {
        results.push({
          id: b.id, type: 'bbq',
          memberName: b.member?.name || '-',
          memberPhone: b.member?.phone || '-',
          detail: `${b.bbq_number}번 바베큐 · ${b.reservation_date}`,
          amount: b.price || 0,
          date: b.created_at,
          rawStatus: b.status,
          unifiedStatus: mapBBQStatus(b.status),
        });
      });
    }

    if (!typeFilter || typeFilter === 'order') {
      const { data } = await supabase
        .from('service_orders')
        .select('*, member:members(name, phone), product:store_products(name)')
        .order('created_at', { ascending: false })
        .limit(100);
      (data || []).forEach((o: any) => {
        results.push({
          id: o.id, type: 'order',
          memberName: o.member?.name || '-',
          memberPhone: o.member?.phone || '-',
          detail: o.product?.name || '서비스',
          amount: o.total_price || 0,
          date: o.created_at,
          rawStatus: o.status,
          unifiedStatus: mapOrderStatus(o.status),
          paymentStatus: o.payment_status,
          adminNote: o.admin_note,
        });
      });
    }

    if (!typeFilter || typeFilter === 'coupon') {
      const { data } = await supabase
        .from('coupon_issues')
        .select('*, member:members(name, phone), coupon:coupons(name, discount_type, discount_value)')
        .order('created_at', { ascending: false })
        .limit(100);
      (data || []).forEach((c: any) => {
        const discount = c.coupon?.discount_type === 'percentage'
          ? `${c.coupon.discount_value}%` : `${c.coupon?.discount_value?.toLocaleString()}원`;
        results.push({
          id: c.id, type: 'coupon',
          memberName: c.member?.name || '-',
          memberPhone: c.member?.phone || '-',
          detail: `${c.coupon?.name || '쿠폰'} (${discount})`,
          amount: 0,
          date: c.created_at,
          rawStatus: c.status,
          unifiedStatus: mapCouponStatus(c.status),
        });
      });
    }

    // 시간순 정렬
    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 상태 필터
    const filtered = statusFilter
      ? results.filter(r => r.unifiedStatus === statusFilter)
      : results;

    setItems(filtered);
    setLoading(false);
  }, [supabase, typeFilter, statusFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { items, loading, refetch: fetchAll };
}
