'use client';

import { Search, X } from 'lucide-react';
import type { BBQHistoryFilters, BBQStatus } from '@/lib/use-bbq-history';
import { todayKST, dateOffsetKST } from '@/lib/use-bbq-board';

const QUICK_PRESETS = [
  { label: '지난 7일', days: 7 },
  { label: '지난 30일', days: 30 },
  { label: '지난 90일', days: 90 },
] as const;

const STATUS_OPTIONS: { value: BBQStatus; label: string; activeColor: string }[] = [
  { value: 'confirmed', label: '예약완료', activeColor: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
  { value: 'completed', label: '완료',     activeColor: 'border-gray-400 bg-gray-100 text-gray-700' },
  { value: 'cancelled', label: '취소',     activeColor: 'border-orange-500 bg-orange-50 text-orange-700' },
  { value: 'no_show',   label: '노쇼',     activeColor: 'border-red-500 bg-red-50 text-red-700' },
];

interface Props {
  filters: BBQHistoryFilters;
  facilities: { number: number; name: string }[];
  onChange: (next: BBQHistoryFilters) => void;
  onReset: () => void;
}

export default function HistoryFilterBar({ filters, facilities, onChange, onReset }: Props) {
  const setPreset = (days: number) =>
    onChange({ ...filters, dateFrom: dateOffsetKST(-days), dateTo: todayKST(), page: 0 });

  const toggleStatus = (s: BBQStatus) => {
    const cur = filters.status ?? [];
    const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s];
    onChange({ ...filters, status: next.length ? next : undefined, page: 0 });
  };

  return (
    <div className="space-y-3 text-sm">
      {/* 기간 — Quick preset + Custom date 2 input */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-secondary shrink-0">기간:</span>
        {QUICK_PRESETS.map((p) => (
          <button
            key={p.days}
            onClick={() => setPreset(p.days)}
            className="text-xs px-2.5 py-1 rounded-full border border-border hover:bg-accent cursor-pointer transition-colors"
          >
            {p.label}
          </button>
        ))}
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value, page: 0 })}
          className="text-xs border border-border rounded-lg px-2 py-1 focus:outline-none focus:border-primary"
          aria-label="검색 시작일"
        />
        <span className="text-text-tertiary">~</span>
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value, page: 0 })}
          className="text-xs border border-border rounded-lg px-2 py-1 focus:outline-none focus:border-primary"
          aria-label="검색 종료일"
        />
      </div>

      {/* 검색 + 시설 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-tertiary pointer-events-none" />
          <input
            type="search"
            value={filters.query || ''}
            onChange={(e) => onChange({ ...filters, query: e.target.value, page: 0 })}
            placeholder="회원명 / 연락처 검색"
            className="w-full pl-9 pr-3 h-9 border border-border rounded-lg text-xs focus:outline-none focus:border-primary"
            aria-label="회원명 또는 연락처 검색"
          />
        </div>
        <select
          value={filters.facilityNumber ?? ''}
          onChange={(e) =>
            onChange({
              ...filters,
              facilityNumber: e.target.value ? Number(e.target.value) : undefined,
              page: 0,
            })
          }
          className="h-9 px-3 border border-border rounded-lg text-xs cursor-pointer focus:outline-none focus:border-primary"
          aria-label="시설 필터"
        >
          <option value="">전체 시설</option>
          {facilities.map((f) => (
            <option key={f.number} value={f.number}>
              {f.number}번 {f.name}
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
                active ? s.activeColor : 'border-border text-text-tertiary hover:bg-accent'
              }`}
              type="button"
              aria-pressed={active}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
