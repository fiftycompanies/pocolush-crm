'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { RESERVATION_STATUS, TIME_SLOTS } from '@/lib/member-constants';
import type { BBQReservation } from '@/types';

export default function ReservationHistoryPage() {
  const supabase = createClient();
  const [reservations, setReservations] = useState<BBQReservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: m } = await supabase.from('members').select('id').eq('user_id', user.id).maybeSingle();
      if (!m) return;
      const { data } = await supabase
        .from('bbq_reservations')
        .select('*')
        .eq('member_id', m.id)
        .order('reservation_date', { ascending: false });
      setReservations(data || []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-sm text-text-secondary">불러오는 중...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/member/reservation" className="text-text-secondary hover:text-text-primary"><ArrowLeft className="size-5" /></Link>
        <h1 className="text-lg font-bold text-text-primary">예약 내역</h1>
      </div>

      {reservations.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl p-10 text-center">
          <p className="text-sm text-text-tertiary">예약 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reservations.map((r) => {
            const status = RESERVATION_STATUS[r.status];
            const slot = TIME_SLOTS[r.time_slot];
            return (
              <Link key={r.id} href={`/member/reservation/${r.id}`}
                className="block bg-white border border-border rounded-2xl p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">바베큐장 {r.bbq_number}번</p>
                    <p className="text-[12px] text-text-secondary mt-0.5">
                      {r.reservation_date.replace(/-/g, '.')} · {slot?.label} {slot?.time}
                    </p>
                  </div>
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                    style={{ color: status?.color, backgroundColor: status?.bg }}>
                    {status?.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
