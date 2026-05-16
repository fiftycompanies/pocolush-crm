'use client';

import { Home, Users, AlertTriangle, Square, Ban } from 'lucide-react';
import type { Farm, FarmZone } from '@/types';
import { EXPIRY_DANGER_DAYS, EXPIRY_WARNING_DAYS } from '@/lib/constants';

interface Props {
  farms: Farm[];
  zones: FarmZone[];
}

/**
 * 농장 현황 KPI 5종 (2026-05-16, PR-C1 한 카드 2-값)
 * - 총 농장 / 임대중 / 만료 임박 (D-7/D-30) / 비어있음 / 비운영
 *
 * PR-C1 (Q-C1=한카드2값):
 *   "만료 임박 (30일)" 단일 카드 → 한 카드 안에 D-7 (빨강) / D-30 (주황) 2값 표시.
 *   카드 수 5 유지 (grid 변경 0, 반응형 회귀 risk 0).
 */
export default function FarmsBoardKpi({ farms, zones }: Props) {
  const today = new Date();
  const dangerThreshold = new Date(today);
  dangerThreshold.setDate(today.getDate() + EXPIRY_DANGER_DAYS); // 7일
  const warningThreshold = new Date(today);
  warningThreshold.setDate(today.getDate() + EXPIRY_WARNING_DAYS); // 30일

  const operationalZoneIds = new Set(
    zones.filter((z) => z.is_operational).map((z) => z.id),
  );

  const operational = farms.filter((f) => operationalZoneIds.has(f.zone_id));
  const nonOperational = farms.length - operational.length;
  const occupied = operational.filter((f) => f.current_rental).length;

  // D-7 / D-30 임박 별도 카운트 (D-7 ⊂ D-30)
  const expiringIn7 = operational.filter((f) => {
    const end = f.current_rental?.end_date;
    if (!end) return false;
    const endDate = new Date(end);
    return !Number.isNaN(endDate.getTime()) && endDate <= dangerThreshold;
  }).length;
  const expiringIn30 = operational.filter((f) => {
    const end = f.current_rental?.end_date;
    if (!end) return false;
    const endDate = new Date(end);
    return !Number.isNaN(endDate.getTime()) && endDate <= warningThreshold;
  }).length;
  const empty = operational.length - occupied;

  // 5 카드 — 만료 임박만 2값 카드, 나머지 4개는 단일 값
  const simpleKpis = [
    { label: '총 농장', value: operational.length, icon: Home, color: 'text-text-primary', iconColor: 'text-text-tertiary' },
    { label: '임대중', value: occupied, icon: Users, color: 'text-emerald-700', iconColor: 'text-emerald-500' },
  ];
  const remainKpis = [
    { label: '비어있음', value: empty, icon: Square, color: 'text-text-primary', iconColor: 'text-text-tertiary' },
    { label: '비운영', value: nonOperational, icon: Ban, color: 'text-text-tertiary', iconColor: 'text-text-tertiary opacity-60' },
  ];

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
      data-testid="farms-board-kpi"
    >
      {simpleKpis.map((k) => {
        const Icon = k.icon;
        return (
          <div key={k.label} className="bg-card border rounded-xl p-4 flex items-start justify-between">
            <div>
              <p className="text-xs text-text-secondary">{k.label}</p>
              <p className={`text-2xl font-bold tracking-tight mt-1 ${k.color}`}>{k.value}</p>
            </div>
            <Icon className={`size-5 shrink-0 ${k.iconColor}`} />
          </div>
        );
      })}

      {/* 만료 임박 — D-7 (위험) / D-30 (주의) 한 카드 2-값 */}
      <div
        className="bg-card border rounded-xl p-4 flex items-start justify-between"
        data-testid="farms-board-kpi-expiring"
      >
        <div>
          <p className="text-xs text-text-secondary">만료 임박</p>
          <div className="flex items-baseline gap-2.5 mt-1">
            <div>
              <p className="text-2xl font-bold tracking-tight text-red-600">{expiringIn7}</p>
              <p className="text-[10px] text-red-600/80">D-7</p>
            </div>
            <div className="opacity-60">
              <p className="text-xl font-semibold tracking-tight text-amber-600">{expiringIn30}</p>
              <p className="text-[10px] text-amber-600/80">D-30</p>
            </div>
          </div>
        </div>
        <AlertTriangle className="size-5 shrink-0 text-amber-500" />
      </div>

      {remainKpis.map((k) => {
        const Icon = k.icon;
        return (
          <div key={k.label} className="bg-card border rounded-xl p-4 flex items-start justify-between">
            <div>
              <p className="text-xs text-text-secondary">{k.label}</p>
              <p className={`text-2xl font-bold tracking-tight mt-1 ${k.color}`}>{k.value}</p>
            </div>
            <Icon className={`size-5 shrink-0 ${k.iconColor}`} />
          </div>
        );
      })}
    </div>
  );
}
