'use client';

import type { MembershipRow } from '@/lib/use-memberships-list';
import { daysUntil } from '@/lib/member-derived-status';

interface Props {
  rows: MembershipRow[];
  loading: boolean;
  selected: Set<string>;
  onSelect: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onRowClick: (row: MembershipRow) => void;
}

function statusClass(status: string, endDate: string): string {
  if (status === 'cancelled') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'expired') return 'bg-gray-100 text-gray-600 border-gray-200';
  const remain = daysUntil(endDate) ?? 0;
  if (remain < 0) return 'bg-gray-100 text-gray-600 border-gray-200';
  if (remain <= 7) return 'bg-red-50 text-red-700 border-red-200 font-semibold';
  if (remain <= 30) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

export default function MembershipTable({
  rows,
  loading,
  selected,
  onSelect,
  onSelectAll,
  onRowClick,
}: Props) {
  if (loading) {
    return <p className="text-center text-sm text-text-secondary py-10">불러오는 중...</p>;
  }
  if (rows.length === 0) {
    return <p className="text-center text-sm text-text-tertiary py-10">회원권이 없습니다.</p>;
  }
  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id));

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-3 py-3 w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={e => onSelectAll(e.target.checked)}
              />
            </th>
            <th className="px-3 py-3 font-medium text-text-secondary">코드</th>
            <th className="px-3 py-3 font-medium text-text-secondary">회원명</th>
            <th className="px-3 py-3 font-medium text-text-secondary">플랜</th>
            <th className="px-3 py-3 font-medium text-text-secondary">농장/구좌</th>
            <th className="px-3 py-3 font-medium text-text-secondary">기간</th>
            <th className="px-3 py-3 font-medium text-text-secondary">남은일</th>
            <th className="px-3 py-3 font-medium text-text-secondary">상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const remain = daysUntil(r.end_date);
            const isSelected = selected.has(r.id);
            const cls = statusClass(r.status, r.end_date);
            const leftBar =
              r.status === 'active' && remain !== null && remain >= 0 && remain <= 30
                ? remain <= 7
                  ? 'border-l-4 border-l-red-500'
                  : 'border-l-4 border-l-amber-400'
                : '';
            return (
              <tr
                key={r.id}
                className={`border-b border-border last:border-0 hover:bg-accent/30 cursor-pointer ${leftBar} ${
                  r.status === 'cancelled' ? 'opacity-60' : ''
                }`}
                onClick={() => onRowClick(r)}
              >
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={e => onSelect(r.id, e.target.checked)}
                  />
                </td>
                <td className="px-3 py-3 font-mono text-xs text-text-secondary">
                  {r.membership_code}
                </td>
                <td className="px-3 py-3 font-medium text-text-primary">
                  {r.member?.name || '-'}
                </td>
                <td className="px-3 py-3 text-text-secondary">{r.plan_name || '-'}</td>
                <td className="px-3 py-3 text-text-secondary text-xs">
                  {r.farm?.number ? `#${r.farm.number}` : '-'} / {r.plots}구좌
                </td>
                <td className="px-3 py-3 text-text-secondary text-xs">
                  {r.start_date}~{r.end_date}
                </td>
                <td className="px-3 py-3 text-text-secondary text-xs">
                  {remain !== null
                    ? remain >= 0
                      ? `D-${remain}`
                      : `${Math.abs(remain)}일 경과`
                    : '-'}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full border ${cls}`}
                  >
                    {r.status === 'active' ? '활성' : r.status === 'expired' ? '만료' : '취소'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
