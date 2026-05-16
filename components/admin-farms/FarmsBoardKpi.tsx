'use client';

import { Home, Users, AlertTriangle, Square, Ban } from 'lucide-react';
import type { Farm, FarmZone } from '@/types';

interface Props {
  farms: Farm[];
  zones: FarmZone[];
}

/**
 * 농장 현황 KPI 5종 (2026-05-16, kk Q4=30일)
 * - 총 농장 / 임대중 / 만료 임박 30일 / 비어있음 / 비운영
 */
export default function FarmsBoardKpi({ farms, zones }: Props) {
  const today = new Date();
  const threshold = new Date(today);
  threshold.setDate(today.getDate() + 30); // kk Q4 = 30일

  const operationalZoneIds = new Set(
    zones.filter((z) => z.is_operational).map((z) => z.id),
  );

  const operational = farms.filter((f) => operationalZoneIds.has(f.zone_id));
  const nonOperational = farms.length - operational.length;
  const occupied = operational.filter((f) => f.current_rental).length;
  const expiringSoon = operational.filter((f) => {
    const end = f.current_rental?.end_date;
    if (!end) return false;
    return new Date(end) <= threshold;
  }).length;
  const empty = operational.length - occupied;

  const kpis = [
    {
      label: '총 농장',
      value: operational.length,
      icon: Home,
      color: 'text-text-primary',
      iconColor: 'text-text-tertiary',
    },
    {
      label: '임대중',
      value: occupied,
      icon: Users,
      color: 'text-emerald-700',
      iconColor: 'text-emerald-500',
    },
    {
      label: '만료 임박 (30일)',
      value: expiringSoon,
      icon: AlertTriangle,
      color: 'text-amber-700',
      iconColor: 'text-amber-500',
    },
    {
      label: '비어있음',
      value: empty,
      icon: Square,
      color: 'text-text-primary',
      iconColor: 'text-text-tertiary',
    },
    {
      label: '비운영',
      value: nonOperational,
      icon: Ban,
      color: 'text-text-tertiary',
      iconColor: 'text-text-tertiary opacity-60',
    },
  ];

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
      data-testid="farms-board-kpi"
    >
      {kpis.map((k) => {
        const Icon = k.icon;
        return (
          <div
            key={k.label}
            className="bg-card border rounded-xl p-4 flex items-start justify-between"
          >
            <div>
              <p className="text-xs text-text-secondary">{k.label}</p>
              <p className={`text-2xl font-bold tracking-tight mt-1 ${k.color}`}>
                {k.value}
              </p>
            </div>
            <Icon className={`size-5 shrink-0 ${k.iconColor}`} />
          </div>
        );
      })}
    </div>
  );
}
