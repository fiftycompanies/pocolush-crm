'use client';

import { Clock } from 'lucide-react';
import type { BBQTimeSlot } from '@/types';

interface Props {
  selectedSlot: number | null;
  onSelect: (slot: number) => void;
  availability?: Record<number, number>;
  timeSlots: BBQTimeSlot[];
}

export default function TimeSlotSelector({ selectedSlot, onSelect, availability, timeSlots }: Props) {
  if (timeSlots.length === 0) {
    return <p className="text-sm text-text-tertiary py-4 text-center">현재 예약 가능한 시간이 없습니다.</p>;
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">시간 선택</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {timeSlots.map((slot) => {
          const available = availability?.[slot.slot_number];
          const isSelected = selectedSlot === slot.slot_number;

          return (
            <button
              key={slot.slot_number}
              onClick={() => onSelect(slot.slot_number)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                isSelected
                  ? 'bg-[#16A34A] text-white border-[#16A34A] shadow-sm'
                  : 'bg-white text-text-primary border-border hover:border-[#16A34A]/40'
              }`}
            >
              <Clock className="size-4" strokeWidth={1.8} />
              <span className="text-xs font-semibold">{slot.label}</span>
              <span className={`text-[10px] ${isSelected ? 'text-white/70' : 'text-text-tertiary'}`}>
                {slot.start_time.slice(0, 5)} ~ {slot.end_time.slice(0, 5)}
              </span>
              {available !== undefined && (
                <span className={`text-[10px] font-medium ${
                  isSelected ? 'text-white/80' : available > 0 ? 'text-green' : 'text-red'
                }`}>
                  {available > 0 ? `${available}자리` : '마감'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
