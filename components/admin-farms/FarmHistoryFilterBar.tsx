'use client';

import { Search, X } from 'lucide-react';
import type {
  FarmHistoryFilters,
  FarmRentalStatus,
  FarmRentalPlan,
} from '@/lib/use-farm-history';
import { todayKST, dateOffsetKST } from '@/lib/use-bbq-board';

const QUICK_PRESETS = [
  { label: '지난 30일', days: 30 },
  { label: '지난 90일', days: 90 },
  { label: '지난 1년', days: 365 },
] as const;

const STATUS_OPTIONS: {
  value: FarmRentalStatus;
  label: string;
  activeColor: string;
}[] = [
  { value: 'active',    label: '활성',  activeColor: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
  { value: 'expired',   label: '만료',  activeColor: 'border-gray-400 bg-gray-100 text-gray-700' },
  { value: 'cancelled', label: '취소',  activeColor: 'border-orange-500 bg-orange-50 text-orange-700' },
];

const PLAN_OPTIONS: {
  value: FarmRentalPlan;
  label: string;
  activeColor: string;
}[] = [
  { value: '씨앗', label: '씨앗', activeColor: 'border-amber-500 bg-amber-50 text-amber-700' },
  { value: '새싹', label: '새싹', activeColor: 'border-lime-500 bg-lime-50 text-lime-700' },
  { value: '자람', label: '자람', activeColor: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
];

interface Props {
  filters: FarmHistoryFilters;
  zones: { id: string; name: string }[];
  onChange: (next: FarmHistoryFilters) => void;
  onReset: () => void;
}

export default function FarmHistoryFilterBar({
  filters,
  zones,
  onChange,
  onReset,
}: Props) {
  const setPreset = (days: number) =>
    onChange({
      ...filters,
      dateFrom: dateOffsetKST(-days),
      dateTo: todayKST(),
      page: 0,
    });

  const toggleStatus = (s: FarmRentalStatus) => {
    const cur = filters.status ?? [];
    const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s];
    onChange({ ...filters, status: next.length ? next : undefined, page: 0 });
  };

  const togglePlan = (p: FarmRentalPlan) => {
    const cur = filters.plan ?? [];
    const next = cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p];
    onChange({ ...filters, plan: next.length ? next : undefined, page: 0 });
  };

  return (
    <div className="space-y-3 text-sm">
      {/* 기간 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-secondary shrink-0">기간:</span>
        {QUICK_PRESETS.map((p) => (
          <button
            key={p.days}
            onClick={() => setPreset(p.days)}
            className="text-xs px-2.5 py-1 rounded-full border border-border hover:bg-accent cursor-pointer transition-colors"
            type="button"
          >
            {p.label}
          </button>
        ))}
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) =>
            onChange({ ...filters, dateFrom: e.target.value, page: 0 })
          }
          className="text-xs border border-border rounded-lg px-2 py-1 focus:outline-none focus:border-primary"
          aria-label="검색 시작일"
        />
        <span className="text-text-tertiary">~</span>
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) =>
            onChange({ ...filters, dateTo: e.target.value, page: 0 })
          }
          className="text-xs border border-border rounded-lg px-2 py-1 focus:outline-none focus:border-primary"
          aria-label="검색 종료일"
        />
      </div>

      {/* 검색 + 존 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-tertiary pointer-events-none" />
          <input
            type="search"
            value={filters.query || ''}
            onChange={(e) =>
              onChange({ ...filters, query: e.target.value, page: 0 })
            }
            placeholder="임차인명 / 연락처 검색"
            className="w-full pl-9 pr-3 h-9 border border-border rounded-lg text-xs focus:outline-none focus:border-primary"
            aria-label="임차인명 또는 연락처 검색"
          />
        </div>
        <select
          value={filters.zoneId ?? ''}
          onChange={(e) =>
            onChange({
              ...filters,
              zoneId: e.target.value || undefined,
              page: 0,
            })
          }
          className="h-9 px-3 border border-border rounded-lg text-xs cursor-pointer focus:outline-none focus:border-primary"
          aria-label="존 필터"
        >
          <option value="">전체 존</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
        <button
          onClick={onReset}
          className="text-xs text-text-tertiary hover:text-text-primary flex items-center gap-1 cursor-pointer transition-colors"
          type="button"
        >
          <X className="size-3" /> 초기화
        </button>
      </div>

      {/* 상태 multi-select chip */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-secondary shrink-0">상태:</span>
        {STATUS_OPTIONS.map((s) => {
          const active = filters.status?.includes(s.value) ?? false;
          return (
            <button
              key={s.value}
              onClick={() => toggleStatus(s.value)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                active
                  ? s.activeColor
                  : 'border-border text-text-tertiary hover:bg-accent'
              }`}
              type="button"
              aria-pressed={active}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* 플랜 multi-select chip */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-secondary shrink-0">플랜:</span>
        {PLAN_OPTIONS.map((p) => {
          const active = filters.plan?.includes(p.value) ?? false;
          return (
            <button
              key={p.value}
              onClick={() => togglePlan(p.value)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                active
                  ? p.activeColor
                  : 'border-border text-text-tertiary hover:bg-accent'
              }`}
              type="button"
              aria-pressed={active}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
