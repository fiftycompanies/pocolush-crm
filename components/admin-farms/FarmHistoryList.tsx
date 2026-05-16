'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { FarmHistoryRow } from '@/lib/use-farm-history';

const STATUS_LABEL: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  active:    { label: '활성',  color: '#059669', bg: '#ECFDF5' },
  expired:   { label: '만료',  color: '#6B7280', bg: '#F3F4F6' },
  cancelled: { label: '취소',  color: '#D97706', bg: '#FFFBEB' },
};

const PAYMENT_LABEL: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  납부완료: { label: '납부완료', color: '#059669', bg: '#ECFDF5' },
  미납:     { label: '미납',     color: '#991B1B', bg: '#FEE2E2' },
  대기:     { label: '대기',     color: '#D97706', bg: '#FFFBEB' },
};

interface Props {
  rows: FarmHistoryRow[];
  loading: boolean;
  page: number;
  limit: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onRowClick?: (row: FarmHistoryRow) => void;
}

export default function FarmHistoryList({
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
      <div
        className="text-center text-sm text-text-secondary py-10"
        role="status"
      >
        불러오는 중...
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div
        className="text-center text-sm text-text-tertiary py-10"
        role="status"
      >
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
              <th className="px-3 py-2 font-medium">계약기간</th>
              <th className="px-3 py-2 font-medium">존/농장</th>
              <th className="px-3 py-2 font-medium">임차인</th>
              <th className="px-3 py-2 font-medium">연락처</th>
              <th className="px-3 py-2 font-medium">플랜</th>
              <th className="px-3 py-2 font-medium">월세</th>
              <th className="px-3 py-2 font-medium">납부</th>
              <th className="px-3 py-2 font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = STATUS_LABEL[r.rental_status] ?? {
                label: r.rental_status,
                color: '#000',
                bg: '#fff',
              };
              const pay = PAYMENT_LABEL[r.payment_status ?? ''] ?? {
                label: r.payment_status ?? '-',
                color: '#6B7280',
                bg: '#F3F4F6',
              };
              return (
                <tr
                  key={r.rental_id}
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
                  <td className="px-3 py-2.5 text-xs">
                    {r.start_date.replace(/-/g, '.')}
                    <span className="text-text-tertiary"> ~ </span>
                    {r.end_date.replace(/-/g, '.')}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs text-text-secondary">
                      {r.zone_name ?? '-'}
                    </span>
                    <span className="font-medium ml-1.5">
                      {r.farm_number}번
                    </span>
                  </td>
                  <td className="px-3 py-2.5">{r.customer_name || '-'}</td>
                  <td className="px-3 py-2.5 text-xs text-text-secondary">
                    {r.customer_phone || '-'}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {r.rental_plan ?? '-'}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {r.monthly_fee.toLocaleString()}원
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{ color: pay.color, backgroundColor: pay.bg }}
                    >
                      {pay.label}
                    </span>
                  </td>
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
