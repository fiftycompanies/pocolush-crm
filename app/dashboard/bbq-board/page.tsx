'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { Search, RefreshCw, AlertCircle } from 'lucide-react';
import { useBBQBoard, todayKST, dateOffsetKST } from '@/lib/use-bbq-board';
import BoardKpiCard from '@/components/admin-bbq/BoardKpiCard';
import BoardMatrix from '@/components/admin-bbq/BoardMatrix';
import BoardWeekTape from '@/components/admin-bbq/BoardWeekTape';
import ReservationSidePanel from '@/components/admin-bbq/ReservationSidePanel';
import BoardHistorySection from '@/components/admin-bbq/BoardHistorySection';
import { createClient } from '@/lib/supabase/client';
import type { BBQBoardRow } from '@/types';
import type { BBQHistoryRow } from '@/lib/use-bbq-history';

// BBQHistoryRow → BBQBoardRow 변환 (ReservationSidePanel 재활용 — kk Q5=1)
function historyRowToBoard(h: BBQHistoryRow): BBQBoardRow {
  return {
    reservation_date: h.reservation_date,
    slot_number: h.time_slot,
    slot_label: h.slot_label ?? `${h.time_slot}타임`,
    slot_start: '',
    bbq_number: h.bbq_number,
    bbq_name: h.bbq_name ?? '',
    facility_active: true,
    status: h.status,
    member_name: h.member_name,
    member_phone: h.member_phone,
    party_size: h.party_size,
    snapshotted_price: h.snapshotted_price,
    product_name: h.product_name,
    is_event: false,
    reservation_id: h.reservation_id,
  };
}

/**
 * /dashboard/bbq-board — BBQ 운영 실시간 보드
 *
 * - 탭: 오늘 / 내일 / 이번 주
 * - 상단 KPI 카드 (sticky)
 * - 오늘·내일: 시설×타임 매트릭스
 * - 이번 주: 시설×일자 Tape Chart (셀 안 3타임 도트)
 * - 셀 클릭 → 사이드 패널 (≥1024px) / bottom-sheet (<1024px)
 * - Supabase Realtime + 30s 폴링 fallback + 사이드 패널 오픈 중 폴링 일시정지
 *
 * Phase 1 — 072 RPC (admin only + audit log)
 */

type Tab = 'today' | 'tomorrow' | 'week';

export const dynamic = 'force-dynamic';

function BoardClient() {
  const [tab, setTab] = useState<Tab>('today');
  const [selectedRow, setSelectedRow] = useState<BBQBoardRow | null>(null);
  const [search, setSearch] = useState('');
  const [facilities, setFacilities] = useState<{ number: number; name: string }[]>([]);

  // 시설 목록 1회 fetch (이력 검색 시설 필터 드롭다운용)
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('bbq_facilities')
      .select('number, name')
      .order('number')
      .then(({ data }) => setFacilities((data ?? []) as { number: number; name: string }[]));
  }, []);

  const { dateFrom, dateTo } = useMemo(() => {
    if (tab === 'today') return { dateFrom: todayKST(), dateTo: todayKST() };
    if (tab === 'tomorrow') return { dateFrom: dateOffsetKST(1), dateTo: dateOffsetKST(1) };
    return { dateFrom: todayKST(), dateTo: dateOffsetKST(6) };
  }, [tab]);

  const { rows, loading, error, lastFetched, refetch, pausePolling, resumePolling, isRealtimeOk } =
    useBBQBoard(dateFrom, dateTo);

  const handleCellClick = (row: BBQBoardRow) => {
    if (!row.reservation_id) return;
    pausePolling();
    setSelectedRow(row);
  };
  const handleClosePanel = () => {
    setSelectedRow(null);
    resumePolling();
  };

  // 단일 일자 필터링 (today/tomorrow 탭은 매트릭스, week 는 Tape)
  const singleDayRows = useMemo(() => {
    if (tab === 'week') return rows;
    return rows.filter(r => r.reservation_date === dateFrom);
  }, [rows, tab, dateFrom]);

  const staleSeconds = lastFetched ? (Date.now() - lastFetched.getTime()) / 1000 : 0;
  const isStale = staleSeconds > 60;

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">평상 예약 현황</h1>
          <p className="text-sm text-text-secondary mt-1">오늘·내일·이번 주 예약을 실시간 확인합니다. 운영 중단된 시설이라도 예약이 남아 있으면 표시됩니다.</p>
        </div>
        <div className="flex items-center gap-2">
          {lastFetched && (
            <span className={`text-[11px] ${isStale ? 'text-amber-700 font-semibold' : 'text-text-tertiary'}`} data-testid="last-fetched">
              {isStale && '⚠ '}
              {Math.floor(staleSeconds)}초 전 자동 갱신
              {isRealtimeOk && <span className="ml-1 text-emerald-600" title="실시간 연결 정상">● 실시간 연결됨</span>}
            </span>
          )}
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg border border-border hover:bg-accent"
            aria-label="새로고침"
            data-testid="refresh-btn"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {/* 탭 + 검색 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-bg-muted rounded-xl p-1" role="tablist">
          {([
            { key: 'today', label: '오늘' },
            { key: 'tomorrow', label: '내일' },
            { key: 'week', label: '이번 주' },
          ] as { key: Tab; label: string }[]).map(t => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              data-testid={`tab-${t.key}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key
                  ? 'bg-card text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-tertiary" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="회원명 / 연락처 뒷4자리..."
            data-testid="board-search"
            className="w-full pl-9 pr-3 h-9 border border-border rounded-lg text-xs focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* KPI 카드 (sticky) */}
      <div className="sticky top-0 z-10">
        <BoardKpiCard rows={singleDayRows} />
      </div>

      {/* 에러 / 로딩 / 콘텐츠 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2" data-testid="board-error">
          <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <strong className="text-red-900">데이터 조회 실패</strong>
            <p className="text-red-700 text-xs mt-1">{error}</p>
            <button onClick={() => refetch()} className="mt-2 text-xs text-primary hover:underline">다시 시도</button>
          </div>
        </div>
      )}

      {loading && !rows.length ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center">
          <p className="text-sm text-text-secondary">불러오는 중...</p>
        </div>
      ) : tab === 'week' ? (
        <BoardWeekTape rows={rows} onCellClick={handleCellClick} />
      ) : (
        <BoardMatrix rows={singleDayRows} onCellClick={handleCellClick} searchQuery={search} />
      )}

      {/* § 예약 이력 검색 (2026-05-16 추가) */}
      <BoardHistorySection
        facilities={facilities}
        onRowClick={(h) => {
          pausePolling();
          setSelectedRow(historyRowToBoard(h));
        }}
      />

      {/* 사이드 패널 */}
      {selectedRow && (
        <ReservationSidePanel
          row={selectedRow}
          onClose={handleClosePanel}
          onUpdated={refetch}
        />
      )}
    </div>
  );
}

export default function BBQBoardPage() {
  return (
    <Suspense fallback={<div className="text-sm text-text-secondary">불러오는 중...</div>}>
      <BoardClient />
    </Suspense>
  );
}
