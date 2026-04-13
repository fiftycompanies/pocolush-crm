'use client';

import { TIME_SLOTS } from '@/lib/member-constants';
import { Clock } from 'lucide-react';

interface Props {
  selectedSlot: number | null;
  onSelect: (slot: number) => void;
  availability?: Record<number, number>; // slot → available count
}

export default function TimeSlotSelector({ selectedSlot, onSelect, availability }: Props) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">시간 선택</h3>
      <div className="grid grid-cols-3 gap-2">
        {([1, 2, 3] as const).map((slot) => {
          const info = TIME_SLOTS[slot];
          const available = availability?.[slot];
          const isSelected = selectedSlot === slot;

          return (
            <button
              key={slot}
              onClick={() => onSelect(slot)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                isSelected
                  ? 'bg-[#16A34A] text-white border-[#16A34A] shadow-sm'
                  : 'bg-white text-text-primary border-border hover:border-[#16A34A]/40'
              }`}
            >
              <Clock className="size-4" strokeWidth={1.8} />
              <span className="text-xs font-semibold">{info.label}</span>
              <span className={`text-[10px] ${isSelected ? 'text-white/70' : 'text-text-tertiary'}`}>
                {info.time}
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
