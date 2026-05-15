'use client';

import { useMemo } from 'react';
import type { BBQBoardRow } from '@/types';

/**
 * BBQ 보드 상단 KPI 카드
 * - 예약완료 / 노쇼 / 가용 / 비운영 카운트
 * - 점유율 progress bar
 * - 사용자 첨부 참고화면의 [예약완료] [예약불가(대기)] [예약가능] [비운영] 패턴
 */
interface Props {
  rows: BBQBoardRow[];
}

export default function BoardKpiCard({ rows }: Props) {
  const kpi = useMemo(() => {
    let confirmed = 0, completed = 0, noShow = 0, available = 0, inactive = 0;
    let totalCells = 0;

    rows.forEach(r => {
      totalCells++;
      if (r.status === 'confirmed') confirmed++;
      else if (r.status === 'completed') completed++;
      else if (r.status === 'no_show') noShow++;
      else if (!r.facility_active) inactive++;
      else available++;
    });

    const occupied = confirmed + completed + noShow;
    const occupancy = totalCells > 0 ? Math.round((occupied / totalCells) * 100) : 0;

    return { confirmed, completed, noShow, available, inactive, occupied, occupancy, totalCells };
  }, [rows]);

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-3" data-testid="board-kpi-card">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">오늘 운영 현황</h2>
        <span className="text-xs text-text-tertiary">점유율 <span className="font-semibold text-text-primary" data-testid="kpi-occupancy">{kpi.occupancy}%</span></span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${kpi.occupancy}%` }}
          role="progressbar"
          aria-valuenow={kpi.occupancy}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {/* KPI badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2" data-testid="kpi-confirmed">
          <div className="text-[10px] font-medium text-emerald-700 uppercase tracking-wider">예약완료</div>
          <div className="text-lg font-bold text-emerald-900 tabular-nums">{kpi.confirmed + kpi.completed}</div>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2" data-testid="kpi-noshow">
          <div className="text-[10px] font-medium text-rose-700 uppercase tracking-wider">노쇼</div>
          <div className="text-lg font-bold text-rose-900 tabular-nums">{kpi.noShow}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2" data-testid="kpi-available">
          <div className="text-[10px] font-medium text-blue-700 uppercase tracking-wider">가용</div>
          <div className="text-lg font-bold text-blue-900 tabular-nums">{kpi.available}</div>
        </div>
        <div className="bg-gray-100 border border-gray-300 rounded-xl px-3 py-2" data-testid="kpi-inactive">
          <div className="text-[10px] font-medium text-gray-700 uppercase tracking-wider">비운영</div>
          <div className="text-lg font-bold text-gray-900 tabular-nums">{kpi.inactive}</div>
        </div>
      </div>
    </div>
  );
}
