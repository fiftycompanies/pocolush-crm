'use client';

import { useMemo } from 'react';

interface Props {
  selectedDate: string | null;
  onSelect: (date: string) => void;
  bookedDates?: Record<string, number>; // date → count of bookings
}

export default function ReservationCalendar({ selectedDate, onSelect }: Props) {
  const dates = useMemo(() => {
    const result: { date: string; label: string; dayName: string; isWeekend: boolean }[] = [];
    const today = new Date();

    for (let i = 1; i <= 28; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

      result.push({
        date: d.toISOString().split('T')[0],
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        dayName: dayNames[dayOfWeek],
        isWeekend,
      });
    }
    return result;
  }, []);

  // 토/일만 표시
  const weekendDates = dates.filter(d => d.isWeekend);

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">날짜 선택</h3>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {weekendDates.map((d) => (
          <button
            key={d.date}
            onClick={() => onSelect(d.date)}
            className={`shrink-0 flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl border transition-all ${
              selectedDate === d.date
                ? 'bg-[#16A34A] text-white border-[#16A34A] shadow-sm'
                : 'bg-white text-text-primary border-border hover:border-[#16A34A]/40'
            }`}
          >
            <span className={`text-[10px] font-medium ${
              selectedDate === d.date ? 'text-white/70' : d.dayName === '일' ? 'text-red' : 'text-blue'
            }`}>
              {d.dayName}
            </span>
            <span className="text-sm font-semibold">{d.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
