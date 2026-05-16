'use client';

import { useState } from 'react';
import FarmHistoryFilterBar from './FarmHistoryFilterBar';
import FarmHistoryList from './FarmHistoryList';
import {
  useFarmHistory,
  type FarmHistoryFilters,
  type FarmHistoryRow,
} from '@/lib/use-farm-history';
import { todayKST, dateOffsetKST } from '@/lib/use-bbq-board';

interface Props {
  zones: { id: string; name: string }[];
  /** 행 클릭 시 호출 — 부모(page)가 FarmDrawer 오픈에 사용 */
  onRowClick?: (row: FarmHistoryRow) => void;
}

const PAGE_LIMIT = 20;

// 기본값: 최근 30일 자동 검색 (BBQ 7일 대비 농장 임대는 장기간이라 30일 권장)
function defaultFilters(): FarmHistoryFilters {
  return {
    dateFrom: dateOffsetKST(-30),
    dateTo: todayKST(),
    page: 0,
    limit: PAGE_LIMIT,
  };
}

/**
 * 농장 임대 이력 검색 섹션 (2026-05-16)
 *
 * /dashboard/farms-board 하단에 추가 — 보드(매트릭스 active)와 별도.
 * 기간 + 검색 + 상태/플랜/존 multi-filter + 페이지네이션.
 * 행 클릭 → 부모에서 FarmDrawer 재활용.
 */
export default function FarmHistorySection({ zones, onRowClick }: Props) {
  const [filters, setFilters] = useState<FarmHistoryFilters>(defaultFilters);
  const { rows, totalCount, loading, error, refetch } = useFarmHistory(filters);

  const handleReset = () => setFilters(defaultFilters());

  return (
    <section className="bg-card border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">임대 이력 검색</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            기간·임차인·상태·플랜·존으로 과거 계약을 검색합니다 · {totalCount}건
          </p>
        </div>
      </div>

      <FarmHistoryFilterBar
        filters={filters}
        zones={zones}
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

      <FarmHistoryList
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
