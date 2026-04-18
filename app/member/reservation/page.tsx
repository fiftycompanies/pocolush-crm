'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import ReservationCalendar from '@/components/member/ReservationCalendar';
import TimeSlotSelector from '@/components/member/TimeSlotSelector';
import BBQGrid from '@/components/member/BBQGrid';
import { TIME_SLOTS } from '@/lib/member-constants';
import toast from 'react-hot-toast';
import type { BBQFacility, BBQReservation, Member } from '@/types';

export default function ReservationPage() {
  const supabase = createClient();
  const [member, setMember] = useState<Member | null>(null);
  const [facilities, setFacilities] = useState<BBQFacility[]>([]);
  const [reservations, setReservations] = useState<BBQReservation[]>([]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [selectedBBQ, setSelectedBBQ] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  // R2: 활성 상품 + 이벤트 가격
  const [activeProduct, setActiveProduct] = useState<{ id: string; name: string; base_price: number; duration_minutes: number } | null>(null);
  const [eventPrice, setEventPrice] = useState<number | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: m } = await supabase.from('members').select('*').eq('user_id', user.id).maybeSingle();
        setMember(m);
      }
      const { data: f } = await supabase.from('bbq_facilities').select('*').order('number');
      setFacilities(f || []);
      // R2: 활성 바베큐 상품 (is_active 가장 최근)
      const { data: p } = await supabase
        .from('bbq_products')
        .select('id, name, base_price, duration_minutes')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setActiveProduct(p as typeof activeProduct);
      setLoading(false);
    }
    init();
  }, [supabase]);

  // R2: 선택한 날짜 기준 이벤트 가격 조회
  useEffect(() => {
    if (!activeProduct || !selectedDate) { setEventPrice(null); return; }
    supabase.rpc('get_bbq_reservation_price', { p_product_id: activeProduct.id, p_date: selectedDate })
      .then(({ data }) => setEventPrice(typeof data === 'number' ? data : null));
  }, [supabase, activeProduct, selectedDate]);

  const fetchReservations = useCallback(async () => {
    if (!selectedDate || selectedSlot === null) return;
    const { data } = await supabase
      .from('bbq_reservations')
      .select('*')
      .eq('reservation_date', selectedDate)
      .eq('time_slot', selectedSlot)
      .in('status', ['confirmed']);
    setReservations(data || []);
  }, [supabase, selectedDate, selectedSlot]);

  useEffect(() => {
    setSelectedBBQ(null);
    fetchReservations();
  }, [fetchReservations]);

  // 타임별 가용 수
  const [slotAvailability, setSlotAvailability] = useState<Record<number, number>>({});
  useEffect(() => {
    if (!selectedDate) return;
    async function loadAvailability() {
      const activeCount = facilities.filter(f => f.is_active).length;
      const availability: Record<number, number> = {};
      for (const slot of [1, 2, 3]) {
        const { count } = await supabase
          .from('bbq_reservations')
          .select('*', { count: 'exact', head: true })
          .eq('reservation_date', selectedDate)
          .eq('time_slot', slot)
          .eq('status', 'confirmed');
        availability[slot] = activeCount - (count || 0);
      }
      setSlotAvailability(availability);
    }
    loadAvailability();
  }, [supabase, selectedDate, facilities]);

  const handleReserve = async () => {
    if (!member || !selectedDate || selectedSlot === null || selectedBBQ === null) return;
    setSubmitting(true);

    const { error } = await supabase.rpc('create_bbq_reservation', {
      p_member_id: member.id,
      p_date: selectedDate,
      p_slot: selectedSlot,
      p_bbq_number: selectedBBQ,
      p_product_id: activeProduct?.id ?? null,
    });

    if (error) {
      if (error.message.includes('SLOT_ALREADY_BOOKED')) {
        toast.error('이미 예약된 슬롯입니다. 다른 시간을 선택해주세요.');
      } else {
        toast.error('예약에 실패했습니다.');
      }
    } else {
      toast.success('예약이 완료되었습니다!');
      setShowConfirm(false);
      setSelectedBBQ(null);
      fetchReservations();
    }
    setSubmitting(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-sm text-text-secondary">불러오는 중...</p></div>;
  }

  // R2: 이벤트 가격 우선, 없으면 상품 base_price, 마지막 폴백은 시설 가격
  const price = eventPrice ?? activeProduct?.base_price ?? facilities.find(f => f.number === selectedBBQ)?.price ?? 30000;
  const priceIsEvent = eventPrice !== null && activeProduct && eventPrice !== activeProduct.base_price;
  const durationMin = activeProduct?.duration_minutes ?? 170;

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">바베큐장 예약</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            {priceIsEvent ? (
              <>
                <span className="font-semibold text-emerald-600">
                  🎉 {price === 0 ? '무료' : `${price.toLocaleString()}원`}
                </span>
                {activeProduct && (
                  <span className="text-text-tertiary line-through ml-1.5">
                    {activeProduct.base_price.toLocaleString()}원
                  </span>
                )}
                {` · ${Math.floor(durationMin / 60)}시간 ${durationMin % 60}분 · 현장결제`}
              </>
            ) : (
              `${price.toLocaleString()}원 · ${Math.floor(durationMin / 60)}시간 ${durationMin % 60}분 · 현장결제`
            )}
          </p>
        </div>
        <a href="/member/reservation/history" className="text-xs text-primary hover:underline">예약 내역 &gt;</a>
      </div>

      {/* Step 1: 날짜 */}
      <div className="bg-white border border-border rounded-2xl p-4">
        <ReservationCalendar selectedDate={selectedDate} onSelect={(d) => { setSelectedDate(d); setSelectedSlot(null); setSelectedBBQ(null); }} />
      </div>

      {/* Step 2: 타임 */}
      {selectedDate && (
        <div className="bg-white border border-border rounded-2xl p-4">
          <TimeSlotSelector selectedSlot={selectedSlot} onSelect={(s) => { setSelectedSlot(s); setSelectedBBQ(null); }} availability={slotAvailability} />
        </div>
      )}

      {/* Step 3: 바베큐장 */}
      {selectedDate && selectedSlot !== null && (
        <div className="bg-white border border-border rounded-2xl p-4">
          <BBQGrid
            facilities={facilities}
            reservations={reservations}
            selectedBBQ={selectedBBQ}
            onSelect={setSelectedBBQ}
            currentMemberId={member?.id}
          />
        </div>
      )}

      {/* 예약 버튼 */}
      {selectedBBQ !== null && (
        <button
          onClick={() => setShowConfirm(true)}
          className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold rounded-xl h-12 transition-all active:scale-[0.98] shadow-sm"
        >
          예약하기
        </button>
      )}

      {/* 확인 모달 */}
      {showConfirm && selectedDate && selectedSlot && selectedBBQ && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-lg" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-4">예약 확인</h3>
            <div className="space-y-2 text-sm mb-6">
              <div className="flex justify-between"><span className="text-text-secondary">날짜</span><span className="font-medium">{selectedDate.replace(/-/g, '.')}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">시간</span><span className="font-medium">{TIME_SLOTS[selectedSlot as 1|2|3]?.label} {TIME_SLOTS[selectedSlot as 1|2|3]?.time}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">장소</span><span className="font-medium">바베큐장 {selectedBBQ}번</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">가격</span>
                <span className="font-medium">
                  {price === 0 ? '무료' : `${price.toLocaleString()}원`}
                  {priceIsEvent ? ' (이벤트 적용)' : ' (현장결제)'}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirm(false)} className="flex-1 h-11 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">
                취소
              </button>
              <button onClick={handleReserve} disabled={submitting}
                className="flex-1 h-11 rounded-xl bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D] transition-colors disabled:opacity-40">
                {submitting ? '예약 중...' : '예약 확정'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
