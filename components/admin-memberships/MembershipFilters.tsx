'use client';

import type { MembershipFilters as F } from '@/lib/use-memberships-list';

interface Props {
  filters: F;
  setFilters: (f: F) => void;
}

const STATUS_OPTIONS: Array<{ value: F['status']; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '활성' },
  { value: 'expired', label: '만료' },
  { value: 'cancelled', label: '취소' },
];

export default function MembershipFilters({ filters, setFilters }: Props) {
  return (
    <div className="bg-card border rounded-xl p-3 flex flex-wrap items-center gap-2">
      <select
        value={filters.status || 'all'}
        onChange={e => setFilters({ ...filters, status: e.target.value as F['status'] })}
        className="h-9 px-3 border border-border rounded-lg text-sm"
      >
        {STATUS_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={filters.planName || ''}
        onChange={e => setFilters({ ...filters, planName: e.target.value || undefined })}
        placeholder="플랜명"
        className="h-9 px-3 border border-border rounded-lg text-sm w-32"
      />

      <div className="flex items-center gap-1">
        <span className="text-xs text-text-tertiary">만료</span>
        <input
          type="date"
          value={filters.endAfter || ''}
          onChange={e => setFilters({ ...filters, endAfter: e.target.value || undefined })}
          className="h-9 px-2 border border-border rounded-lg text-sm"
        />
        <span className="text-xs text-text-tertiary">~</span>
        <input
          type="date"
          value={filters.endBefore || ''}
          onChange={e => setFilters({ ...filters, endBefore: e.target.value || undefined })}
          className="h-9 px-2 border border-border rounded-lg text-sm"
        />
      </div>

      <input
        type="text"
        value={filters.memberQuery || ''}
        onChange={e => setFilters({ ...filters, memberQuery: e.target.value || undefined })}
        placeholder="이름/전화/코드 검색"
        className="flex-1 min-w-[200px] h-9 px-3 border border-border rounded-lg text-sm"
      />

      {(filters.memberId ||
        filters.planName ||
        filters.endAfter ||
        filters.endBefore ||
        filters.memberQuery ||
        (filters.status && filters.status !== 'all')) && (
        <button
          onClick={() => setFilters({ status: 'all' })}
          className="h-9 px-3 text-xs text-text-secondary hover:text-text-primary border border-border rounded-lg"
        >
          초기화
        </button>
      )}
    </div>
  );
}
