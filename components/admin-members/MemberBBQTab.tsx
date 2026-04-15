'use client';

import { RESERVATION_STATUS, TIME_SLOTS } from '@/lib/member-constants';
import type { BBQReservation } from '@/types';

interface Props { reservations: BBQReservation[]; }

export default function MemberBBQTab({ reservations }: Props) {
  if (reservations.length === 0) {
    return <div className="bg-card border rounded-xl p-10 text-center"><p className="text-sm text-text-tertiary">BBQ 예약 내역이 없습니다.</p></div>;
  }

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left">
          <th className="px-4 py-3 font-medium text-text-secondary">날짜</th>
          <th className="px-4 py-3 font-medium text-text-secondary">시간</th>
          <th className="px-4 py-3 font-medium text-text-secondary">바베큐장</th>
          <th className="px-4 py-3 font-medium text-text-secondary">인원</th>
          <th className="px-4 py-3 font-medium text-text-secondary">금액</th>
          <th className="px-4 py-3 font-medium text-text-secondary">상태</th>
        </tr></thead>
        <tbody>
          {reservations.map(r => {
            const status = RESERVATION_STATUS[r.status];
            const slot = TIME_SLOTS[r.time_slot];
            return (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                <td className="px-4 py-3 font-medium">{r.reservation_date.replace(/-/g, '.')}</td>
                <td className="px-4 py-3 text-xs">{slot?.label} {slot?.time}</td>
                <td className="px-4 py-3">{r.bbq_number}번</td>
                <td className="px-4 py-3">{r.party_size}명</td>
                <td className="px-4 py-3">{r.price.toLocaleString()}원</td>
                <td className="px-4 py-3">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: status?.color, backgroundColor: status?.bg }}>{status?.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
