'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { RESERVATION_STATUS, TIME_SLOTS } from '@/lib/member-constants';
import toast from 'react-hot-toast';
import type { BBQReservation } from '@/types';

export default function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [reservation, setReservation] = useState<BBQReservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('bbq_reservations').select('*').eq('id', id).maybeSingle();
      setReservation(data);
      setLoading(false);
    }
    load();
  }, [supabase, id]);

  const handleCancel = async () => {
    if (!reservation) return;

    // 예약일 전날까지만 취소 가능
    const resDate = new Date(reservation.reservation_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (resDate <= today) {
      toast.error('예약 당일에는 취소할 수 없습니다.');
      return;
    }

    setCancelling(true);
    const { error } = await supabase.from('bbq_reservations').update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    }).eq('id', reservation.id);

    if (error) {
      toast.error('취소에 실패했습니다.');
    } else {
      toast.success('예약이 취소되었습니다.');
      setReservation({ ...reservation, status: 'cancelled' });
    }
    setCancelling(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-sm text-text-secondary">불러오는 중...</p></div>;
  if (!reservation) return <div className="text-center py-20"><p className="text-sm text-text-tertiary">예약을 찾을 수 없습니다.</p></div>;

  const status = RESERVATION_STATUS[reservation.status];
  const slot = TIME_SLOTS[reservation.time_slot];
  const canCancel = reservation.status === 'confirmed' && new Date(reservation.reservation_date) > new Date();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-text-secondary hover:text-text-primary"><ArrowLeft className="size-5" /></button>
        <h1 className="text-lg font-bold text-text-primary">예약 상세</h1>
      </div>

      <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-text-primary">바베큐장 {reservation.bbq_number}번</span>
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full"
            style={{ color: status?.color, backgroundColor: status?.bg }}>
            {status?.label}
          </span>
        </div>

        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between"><span className="text-text-secondary">날짜</span><span className="font-medium">{reservation.reservation_date.replace(/-/g, '.')}</span></div>
          <div className="flex justify-between"><span className="text-text-secondary">시간</span><span className="font-medium">{slot?.label} {slot?.time}</span></div>
          <div className="flex justify-between"><span className="text-text-secondary">인원</span><span className="font-medium">{reservation.party_size}명</span></div>
          <div className="flex justify-between"><span className="text-text-secondary">가격</span><span className="font-medium">{reservation.price.toLocaleString()}원</span></div>
          <div className="flex justify-between"><span className="text-text-secondary">결제</span><span className="font-medium">현장결제</span></div>
        </div>
      </div>

      {canCancel && (
        <button onClick={handleCancel} disabled={cancelling}
          className="w-full h-12 rounded-xl border border-red text-red font-semibold text-sm hover:bg-red-light transition-colors disabled:opacity-40">
          {cancelling ? '취소 중...' : '예약 취소'}
        </button>
      )}
    </div>
  );
}
