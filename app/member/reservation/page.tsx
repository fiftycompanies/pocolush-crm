'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import ReservationCalendar from '@/components/member/ReservationCalendar';
import TimeSlotSelector from '@/components/member/TimeSlotSelector';
import BBQGrid, { type BookedFacility } from '@/components/member/BBQGrid';
import { useTimeSlots } from '@/lib/use-time-slots';
import toast from 'react-hot-toast';
import type { BBQFacility, Member } from '@/types';

export default function ReservationPage() {
  const supabase = createClient();
  const [member, setMember] = useState<Member | null>(null);
  const [facilities, setFacilities] = useState<BBQFacility[]>([]);
  const [bookedFacilities, setBookedFacilities] = useState<BookedFacility[]>([]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [selectedBBQ, setSelectedBBQ] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // 타임슬롯 (active만)
  const { timeSlots: activeTimeSlots, slotMap, refetch: refetchTimeSlots } = useTimeSlots(true);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // R2: 선택한 날짜 기준 이벤트 가격 조회
  useEffect(() => {
    if (!activeProduct || !selectedDate) { setEventPrice(null); return; }
    supabase.rpc('get_bbq_reservation_price', { p_product_id: activeProduct.id, p_date: selectedDate })
      .then(({ data }) => setEventPrice(typeof data === 'number' ? data : null));
  }, [supabase, activeProduct, selectedDate]);

  // 061 RPC 사용 — RLS 우회 + status IN (confirmed, completed) 정확 카운팅.
  //   기존 .from('bbq_reservations').select('*') 는 두 결함 동시 발생:
  //   1) status='confirmed' 만 카운팅 → completed 변환된 예약 누락
  //   2) member_select RLS 가 본인+admin 만 노출 → 타 회원 예약을 가용성 표시 못함
  //   RPC 는 SECURITY DEFINER + bbq_number 만 노출 (개인정보 비노출).
  const fetchReservations = useCallback(async () => {
    if (!selectedDate || selectedSlot === null) return;
    const { data, error } = await supabase.rpc('get_booked_facilities', {
      p_date: selectedDate,
      p_slot: selectedSlot,
    });
    if (error) {
      toast.error('점유 시설 조회 실패: ' + error.message);
      setBookedFacilities([]);
      return;
    }
    setBookedFacilities((data ?? []) as BookedFacility[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedSlot]);

  useEffect(() => {
    setSelectedBBQ(null);
    fetchReservations();
  }, [fetchReservations]);

  // 타임별 가용 수 — 061 RPC 사용 (RLS 우회 + status IN confirmed+completed 정확 카운팅).
  //   기존 코드 결함: status='confirmed' 만 카운팅 + RLS 가 본인 예약만 노출 → 잘못된 가용성.
  //   RPC 반환: { slot_number, booked_count, available_count } per slot.
  const [slotAvailability, setSlotAvailability] = useState<Record<number, number>>({});
  const loadAvailability = useCallback(async () => {
    if (!selectedDate || activeTimeSlots.length === 0) return;
    const { data, error } = await supabase.rpc('get_bbq_availability', {
      p_date: selectedDate,
    });
    if (error) {
      toast.error('가용성 조회 실패: ' + error.message);
      return;
    }
    const rows = (data ?? []) as { slot_number: number; booked_count: number; available_count: number }[];
    const availability: Record<number, number> = {};
    rows.forEach(r => { availability[r.slot_number] = r.available_count; });
    setSlotAvailability(availability);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, activeTimeSlots]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

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
      } else if (error.message.includes('INVALID_TIME_SLOT')) {
        toast.error('선택한 타임이 비활성화되었습니다. 다른 시간을 선택해주세요.');
        refetchTimeSlots();
        setSelectedSlot(null);
      } else if (error.message.includes('INACTIVE_FACILITY')) {
        toast.error('선택한 시설이 비활성화되었습니다. 다른 시설을 선택해주세요.');
        setSelectedBBQ(null);
      } else if (error.message.includes('FACILITY_NOT_FOUND')) {
        toast.error('선택한 시설을 찾을 수 없습니다. 페이지를 새로고침해주세요.');
      } else {
        toast.error('예약에 실패했습니다.');
      }
    } else {
      toast.success('예약이 완료되었습니다!');
      setShowConfirm(false);
      setSelectedBBQ(null);
      // 예약 성공 → 같은 슬롯의 점유 시설 + 슬롯별 가용성 모두 즉시 refetch.
      // Promise.allSettled — 둘 중 하나 실패해도 다른 한쪽은 반영.
      const results = await Promise.allSettled([
        fetchReservations(),
        loadAvailability(),
      ]);
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        toast.error('예약은 성공했으나 일부 정보 갱신에 실패했습니다. 새로고침 해주세요.');
      }
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

  const selectedSlotInfo = slotMap[selectedSlot as number];

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
          <TimeSlotSelector
            selectedSlot={selectedSlot}
            onSelect={(s) => { setSelectedSlot(s); setSelectedBBQ(null); }}
            availability={slotAvailability}
            timeSlots={activeTimeSlots}
          />
        </div>
      )}

      {/* Step 3: 바베큐장 */}
      {selectedDate && selectedSlot !== null && (
        <div className="bg-white border border-border rounded-2xl p-4">
          <BBQGrid
            facilities={facilities}
            bookedFacilities={bookedFacilities}
            selectedBBQ={selectedBBQ}
            onSelect={setSelectedBBQ}
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
      {showConfirm && selectedDate && selectedSlot !== null && selectedBBQ !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-lg" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-4">예약 확인</h3>
            <div className="space-y-2 text-sm mb-6">
              <div className="flex justify-between"><span className="text-text-secondary">날짜</span><span className="font-medium">{selectedDate.replace(/-/g, '.')}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">시간</span><span className="font-medium">{selectedSlotInfo?.label} {selectedSlotInfo?.time}</span></div>
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
