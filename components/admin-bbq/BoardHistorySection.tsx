'use client';

import { useState } from 'react';
import HistoryFilterBar from './HistoryFilterBar';
import HistoryList from './HistoryList';
import {
  useBBQHistory,
  type BBQHistoryFilters,
  type BBQHistoryRow,
} from '@/lib/use-bbq-history';
import { todayKST, dateOffsetKST } from '@/lib/use-bbq-board';

interface Props {
  facilities: { number: number; name: string }[];
  /** 행 클릭 시 호출 — 부모(page)가 ReservationSidePanel 오픈에 사용 */
  onRowClick?: (row: BBQHistoryRow) => void;
}

const PAGE_LIMIT = 20;

// 기본값: 최근 7일 자동 검색 (kk Q2=3 결정)
function defaultFilters(): BBQHistoryFilters {
  return {
    dateFrom: dateOffsetKST(-7),
    dateTo: todayKST(),
    page: 0,
    limit: PAGE_LIMIT,
  };
}

/**
 * 평상 예약 이력 검색 섹션 (2026-05-16)
 *
 * 평상 예약 현황 페이지 하단에 추가 — 운영 보드(매트릭스/Tape)는 그대로 유지.
 * 기간 + 검색 + 상태/시설 필터 + 페이지네이션.
 * 행 클릭 → 부모에서 ReservationSidePanel 재활용 (Q5=1).
 */
export default function BoardHistorySection({ facilities, onRowClick }: Props) {
  const [filters, setFilters] = useState<BBQHistoryFilters>(defaultFilters);
  const { rows, totalCount, loading, error, refetch } = useBBQHistory(filters);

  const handleReset = () => setFilters(defaultFilters());

  return (
    <section className="bg-card border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">예약 이력 검색</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            기간·회원·상태·시설로 과거 예약을 검색합니다 · {totalCount}건
          </p>
        </div>
      </div>

      <HistoryFilterBar
        filters={filters}
        facilities={facilities}
        onChange={setFilters}
        onReset={handleReset}
      />

      {error && (
        <div
          className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between"
          role="alert"
        >
          <span>{error}</span>
          <button
            onClick={() => refetch()}
            className="text-xs underline hover:no-underline cursor-pointer"
            type="button"
          >
            다시 시도
          </button>
        </div>
      )}

      <HistoryList
        rows={rows}
        loading={loading}
        page={filters.page}
        limit={filters.limit}
        totalCount={totalCount}
        onPageChange={(page) => setFilters({ ...filters, page })}
        onRowClick={onRowClick}
      />
    </section>
  );
}
