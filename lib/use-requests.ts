'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTimeSlots } from '@/lib/use-time-slots';
import type { ReservationStatus } from '@/types';

export type RequestType = 'bbq' | 'order' | 'coupon';
export type UnifiedStatus =
  | 'payment_pending'
  | 'pending'
  | 'confirmed'          // ⭐ Q8: BBQ "예약완료" 분리
  | 'processing'
  | 'completed'
  | 'no_show'            // ⭐ E3: 노쇼 별도 매핑
  | 'cancelled';

/** BBQ 행 디테일 메타 — Q1 Sentry 2-line 행 + Q10 예약일/신청일 분리용 */
export interface BBQRequestMeta {
  bbqNumber: number;
  timeSlot: number;
  timeLabel: string;          // "1타임 (11:00 ~ 13:50)"
  reservationDate: string;    // YYYY-MM-DD
  partySize: number;
  productName: string | null;
  isEvent: boolean;           // bbq_events 매칭
}

export interface UnifiedRequest {
  id: string;
  type: RequestType;
  memberName: string;
  memberPhone: string;
  detail: string;
  amount: number;
  date: string;               // created_at (신청일)
  rawStatus: string;
  unifiedStatus: UnifiedStatus;
  paymentStatus?: string;
  adminNote?: string | null;
  // 신규
  bbqMeta?: BBQRequestMeta;
}

// 통합 상태 매핑
function mapBBQStatus(s: string): UnifiedStatus {
  // ⭐ Q8: confirmed → '예약완료' 분리 (운영자 혼선 해결)
  if (s === 'confirmed') return 'confirmed';
  if (s === 'completed') return 'completed';
  // ⭐ E3: no_show 별도 매핑 (기존 버그: else → cancelled)
  if (s === 'no_show') return 'no_show';
  return 'cancelled';
}
function mapOrderStatus(s: string): UnifiedStatus {
  if (s === 'payment_pending') return 'payment_pending';
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
  const { slotMap, getSlotLabel, getSlotTime } = useTimeSlots();
  const [items, setItems] = useState<UnifiedRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const results: UnifiedRequest[] = [];

    if (!typeFilter || typeFilter === 'bbq') {
      const { data, error } = await supabase
        .from('bbq_reservations')
        .select('*, member:members(name, phone), product:bbq_products(id, name)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('[use-requests] bbq fetch error:', error.message);
      } else if (data && data.length > 0) {
        // E1: 이벤트 판정 — bbq_events 매칭
        const productIds = [
          ...new Set(
            (data as Array<{ product?: { id?: string } }>)
              .map(b => b.product?.id)
              .filter((id): id is string => !!id),
          ),
        ];
        let eventRanges: Array<{ product_id: string; start_date: string; end_date: string }> = [];
        if (productIds.length > 0) {
          const { data: evData } = await supabase
            .from('bbq_events')
            .select('product_id, start_date, end_date')
            .in('product_id', productIds);
          eventRanges = (evData as typeof eventRanges) || [];
        }

        (data as Array<{
          id: string; reservation_date: string; time_slot: number; bbq_number: number;
          party_size: number | null; status: ReservationStatus; price: number | null;
          snapshotted_price: number | null; created_at: string;
          member: { name: string; phone: string } | null;
          product: { id: string; name: string } | null;
        }>).forEach(b => {
          const slotTime = getSlotTime(b.time_slot).split('~')[0]?.trim() ?? '';
          const slotLabel = slotTime
            ? `${getSlotLabel(b.time_slot)} (${slotTime})`
            : getSlotLabel(b.time_slot);
          const partySize = b.party_size ?? 1;
          const amount = b.snapshotted_price ?? b.price ?? 0;
          const isEvent =
            !!b.product?.id &&
            eventRanges.some(
              e =>
                e.product_id === b.product?.id &&
                e.start_date <= b.reservation_date &&
                e.end_date >= b.reservation_date,
            );

          results.push({
            id: b.id,
            type: 'bbq',
            memberName: b.member?.name || '-',
            memberPhone: b.member?.phone || '-',
            detail: `#${b.bbq_number}번 · ${slotLabel} · ${partySize}인`,
            amount,
            date: b.created_at,
            rawStatus: b.status,
            unifiedStatus: mapBBQStatus(b.status),
            bbqMeta: {
              bbqNumber: b.bbq_number,
              timeSlot: b.time_slot,
              timeLabel: slotLabel,
              reservationDate: b.reservation_date,
              partySize,
              productName: b.product?.name ?? null,
              isEvent,
            },
          });
        });
      }
    }

    if (!typeFilter || typeFilter === 'order') {
      const { data, error } = await supabase
        .from('service_orders')
        .select('*, member:members(name, phone), product:store_products(name)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) {
        console.error('[use-requests] order fetch error:', error.message);
      } else {
        (data || []).forEach((o: {
          id: string; total_price: number | null; created_at: string;
          status: string; payment_status: string | null; admin_note: string | null;
          member: { name: string; phone: string } | null;
          product: { name: string } | null;
        }) => {
          results.push({
            id: o.id, type: 'order',
            memberName: o.member?.name || '-',
            memberPhone: o.member?.phone || '-',
            detail: o.product?.name || '서비스',
            amount: o.total_price || 0,
            date: o.created_at,
            rawStatus: o.status,
            unifiedStatus: mapOrderStatus(o.status),
            paymentStatus: o.payment_status ?? undefined,
            adminNote: o.admin_note,
          });
        });
      }
    }

    if (!typeFilter || typeFilter === 'coupon') {
      const { data, error } = await supabase
        .from('coupon_issues')
        .select('*, member:members(name, phone), coupon:coupons(name, discount_type, discount_value)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) {
        console.error('[use-requests] coupon fetch error:', error.message);
      } else {
        (data || []).forEach((c: {
          id: string; created_at: string; status: string;
          member: { name: string; phone: string } | null;
          coupon: { name: string; discount_type: string; discount_value: number } | null;
        }) => {
          const discount = c.coupon?.discount_type === 'percentage'
            ? `${c.coupon.discount_value}%`
            : `${c.coupon?.discount_value?.toLocaleString() ?? 0}원`;
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
    }

    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const filtered = statusFilter
      ? results.filter(r => r.unifiedStatus === statusFilter)
      : results;

    setItems(filtered);
    setLoading(false);
    // slotMap 은 useTimeSlots refetch 시 안정화. dep 에 넣지 않음 (무한 루프 방지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, typeFilter, statusFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // slotMap 변경 시 한번 더 갱신 (label 적용)
  useEffect(() => {
    if (Object.keys(slotMap).length > 0) fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotMap]);

  return { items, loading, refetch: fetchAll };
}
