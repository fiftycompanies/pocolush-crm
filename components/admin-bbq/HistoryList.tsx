'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { BBQHistoryRow } from '@/lib/use-bbq-history';

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: '예약완료', color: '#059669', bg: '#ECFDF5' },
  completed: { label: '완료',     color: '#6B7280', bg: '#F3F4F6' },
  cancelled: { label: '취소',     color: '#D97706', bg: '#FFFBEB' },
  no_show:   { label: '노쇼',     color: '#991B1B', bg: '#FEE2E2' },
};

interface Props {
  rows: BBQHistoryRow[];
  loading: boolean;
  page: number;
  limit: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onRowClick?: (row: BBQHistoryRow) => void;
}

export default function HistoryList({
  rows,
  loading,
  page,
  limit,
  totalCount,
  onPageChange,
  onRowClick,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const startIdx = totalCount === 0 ? 0 : page * limit + 1;
  const endIdx = Math.min((page + 1) * limit, totalCount);

  if (loading && rows.length === 0) {
    return (
      <div className="text-center text-sm text-text-secondary py-10" role="status">
        불러오는 중...
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="text-center text-sm text-text-tertiary py-10" role="status">
        검색 결과가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-text-secondary">
              <th className="px-3 py-2 font-medium">예약일</th>
              <th className="px-3 py-2 font-medium">시간</th>
              <th className="px-3 py-2 font-medium">시설</th>
              <th className="px-3 py-2 font-medium">회원</th>
              <th className="px-3 py-2 font-medium">연락처</th>
              <th className="px-3 py-2 font-medium">인원</th>
              <th className="px-3 py-2 font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = STATUS_LABEL[r.status] ?? {
                label: r.status,
                color: '#000',
                bg: '#fff',
              };
              return (
                <tr
                  key={r.reservation_id}
                  onClick={() => onRowClick?.(r)}
                  className={`border-b border-border last:border-0 hover:bg-accent/30 ${
                    onRowClick ? 'cursor-pointer' : ''
                  } transition-colors`}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                  onKeyDown={(e) => {
                    if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onRowClick(r);
                    }
                  }}
                >
                  <td className="px-3 py-2.5">{r.reservation_date.replace(/-/g, '.')}</td>
                  <td className="px-3 py-2.5 text-xs text-text-secondary">
                    {r.slot_label ?? `${r.time_slot}타임`}
                  </td>
                  <td className="px-3 py-2.5 font-medium">
                    {r.bbq_number}번 {r.bbq_name ?? '-'}
                  </td>
                  <td className="px-3 py-2.5">{r.member_name || '-'}</td>
                  <td className="px-3 py-2.5 text-xs text-text-secondary">
                    {r.member_phone || '-'}
                  </td>
                  <td className="px-3 py-2.5 text-xs">{r.party_size}인</td>
                  <td className="px-3 py-2.5">
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{ color: st.color, backgroundColor: st.bg }}
                    >
                      {st.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-between text-xs text-text-tertiary pt-2">
        <span>
          {totalCount}건 중 {startIdx}–{endIdx}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
            className="p-1.5 rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            aria-label="이전 페이지"
            type="button"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="px-2">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page + 1 >= totalPages}
            className="p-1.5 rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            aria-label="다음 페이지"
            type="button"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
