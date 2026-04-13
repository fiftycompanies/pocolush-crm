'use client';

import type { BBQFacility, BBQReservation } from '@/types';

interface Props {
  facilities: BBQFacility[];
  reservations: BBQReservation[];
  selectedBBQ: number | null;
  onSelect: (bbqNumber: number) => void;
  currentMemberId?: string;
}

export default function BBQGrid({ facilities, reservations, selectedBBQ, onSelect, currentMemberId }: Props) {
  const getStatus = (facilityNumber: number) => {
    const reservation = reservations.find(r => r.bbq_number === facilityNumber && r.status === 'confirmed');
    if (!reservation) return 'available';
    if (reservation.member_id === currentMemberId) return 'mine';
    return 'booked';
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">바베큐장 선택</h3>
      <div className="grid grid-cols-3 gap-2">
        {facilities.filter(f => f.is_active).map((facility) => {
          const status = getStatus(facility.number);
          const isSelected = selectedBBQ === facility.number;
          const isAvailable = status === 'available';

          return (
            <button
              key={facility.number}
              onClick={() => isAvailable && onSelect(facility.number)}
              disabled={!isAvailable}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                isSelected
                  ? 'bg-[#16A34A] text-white border-[#16A34A] shadow-sm'
                  : status === 'mine'
                    ? 'bg-blue-light text-blue border-blue/30'
                    : isAvailable
                      ? 'bg-white text-text-primary border-border hover:border-[#16A34A]/40 cursor-pointer'
                      : 'bg-gray-light text-text-tertiary border-border cursor-not-allowed opacity-60'
              }`}
            >
              <span className="text-lg">🔥</span>
              <span className="text-xs font-semibold">{facility.number}번</span>
              <span className={`text-[10px] font-medium ${
                isSelected ? 'text-white/80'
                  : status === 'mine' ? 'text-blue'
                    : isAvailable ? 'text-green' : 'text-text-tertiary'
              }`}>
                {status === 'mine' ? '내 예약' : isAvailable ? '예약가능' : '예약됨'}
              </span>
            </button>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 mt-3 text-[10px] text-text-tertiary">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green" /> 예약가능</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray" /> 예약됨</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue" /> 내 예약</span>
      </div>
    </div>
  );
}
