'use client';

import { useMemo } from 'react';
import type { BBQBoardRow } from '@/types';

/**
 * 주간 Tape Chart — 시설 × 일자 매트릭스, 각 셀 안 3분할(1/2/3 타임)
 * - 가로 스크롤 + 첫 컬럼 sticky
 * - 점 SVG 도트 (유니코드 의존 X)
 * - 색: emerald(예약완료), rose(노쇼), white(가용), gray-hatched(비운영)
 */
interface Props {
  rows: BBQBoardRow[];                          // 7일치
  onCellClick: (row: BBQBoardRow) => void;
}

function dotColor(row: BBQBoardRow | undefined): string {
  if (!row) return '#E5E7EB';
  if (!row.facility_active && !row.reservation_id) return '#D1D5DB';   // 비운영
  if (row.status === 'confirmed') return '#10B981';                     // emerald-500
  if (row.status === 'completed') return '#6EE7B7';                     // emerald-300
  if (row.status === 'no_show') return '#F43F5E';                       // rose-500
  return '#F9FAFB';                                                      // 가용 (거의 흰)
}

export default function BoardWeekTape({ rows, onCellClick }: Props) {
  const { facilities, dates, slots, lookup } = useMemo(() => {
    const facMap = new Map<number, { number: number; name: string; active: boolean }>();
    const dateSet = new Set<string>();
    const slotSet = new Set<number>();
    const lookup = new Map<string, BBQBoardRow>();

    rows.forEach(r => {
      if (!facMap.has(r.bbq_number)) {
        facMap.set(r.bbq_number, { number: r.bbq_number, name: r.bbq_name, active: r.facility_active });
      }
      dateSet.add(r.reservation_date);
      slotSet.add(r.slot_number);
      lookup.set(`${r.bbq_number}-${r.reservation_date}-${r.slot_number}`, r);
    });

    return {
      facilities: [...facMap.values()].sort((a, b) => a.number - b.number),
      dates: [...dateSet].sort(),
      slots: [...slotSet].sort((a, b) => a - b),
      lookup,
    };
  }, [rows]);

  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div
      role="grid"
      aria-label="BBQ 주간 운영 보드"
      className="bg-card border border-border rounded-2xl p-4 sm:p-5 overflow-x-auto"
      data-testid="board-week-tape"
    >
      <div className="min-w-[800px]">
        <div
          role="row"
          className="grid items-center gap-1.5 mb-2 text-xs font-semibold text-text-secondary"
          style={{ gridTemplateColumns: `100px repeat(${dates.length}, minmax(80px, 1fr))` }}
        >
          <div role="columnheader" className="px-2 sticky left-0 bg-card">시설</div>
          {dates.map(d => {
            const dt = new Date(d + 'T12:00:00+09:00');
            const wd = weekdays[dt.getDay()];
            return (
              <div role="columnheader" key={d} className="px-2 text-center">
                <div className="text-text-primary">{dt.getMonth() + 1}/{dt.getDate()}</div>
                <div className={`text-[10px] ${dt.getDay() === 0 ? 'text-red-500' : dt.getDay() === 6 ? 'text-blue-500' : 'text-text-tertiary'}`}>{wd}</div>
              </div>
            );
          })}
        </div>

        <div className="space-y-1.5">
          {facilities.map(f => (
            <div
              key={f.number}
              role="row"
              className="grid items-stretch gap-1.5"
              style={{ gridTemplateColumns: `100px repeat(${dates.length}, minmax(80px, 1fr))` }}
            >
              <div
                role="rowheader"
                className={`px-2 py-1 rounded-md text-xs font-semibold sticky left-0 ${
                  f.active ? 'bg-card text-text-primary' : 'bg-gray-100 text-gray-600'
                }`}
              >
                #{f.number} {!f.active && <span className="text-[9px] bg-yellow-400 text-yellow-900 px-1 rounded ml-1">중단</span>}
              </div>
              {dates.map(d => (
                <div
                  key={d}
                  role="gridcell"
                  className="flex items-center justify-center gap-0.5 py-1 px-1 rounded-md border border-border bg-white"
                  data-testid={`week-cell-${f.number}-${d}`}
                >
                  {slots.map(slot => {
                    const row = lookup.get(`${f.number}-${d}-${slot}`);
                    const color = dotColor(row);
                    const hasRsv = !!row?.reservation_id;
                    const isInactiveWithRsv = row && !row.facility_active && hasRsv;
                    const statusKo = row?.status === 'confirmed' ? '예약완료'
                      : row?.status === 'completed' ? '완료'
                      : row?.status === 'no_show' ? '노쇼'
                      : (row && !row.facility_active) ? '비운영'
                      : '가용';
                    const ariaLabelText = `#${f.number}번 ${slot}타임 ${statusKo}`
                      + (row?.member_name ? ` ${row.member_name}` : '')
                      + (row?.party_size ? ` ${row.party_size}인` : '');
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={hasRsv && row ? () => onCellClick(row) : undefined}
                        disabled={!hasRsv}
                        className={`size-3.5 rounded-full ${hasRsv ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
                        style={{
                          backgroundColor: color,
                          border: isInactiveWithRsv ? '2px solid #EAB308' : '1px solid rgba(0,0,0,0.1)',
                        }}
                        title={ariaLabelText}
                        aria-label={ariaLabelText}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* 범례 */}
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border text-[11px] text-text-secondary flex-wrap">
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ backgroundColor: '#10B981' }} /> 예약완료</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ backgroundColor: '#6EE7B7' }} /> 완료</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ backgroundColor: '#F43F5E' }} /> 노쇼</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full border border-gray-300" style={{ backgroundColor: '#F9FAFB' }} /> 가용</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ backgroundColor: '#D1D5DB' }} /> 비운영</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ border: '2px solid #EAB308', backgroundColor: '#10B981' }} /> 비운영+예약 ⚠️</span>
        </div>
      </div>
    </div>
  );
}
