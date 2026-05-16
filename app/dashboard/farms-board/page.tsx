'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, RefreshCw, Settings2, ArrowRight } from 'lucide-react';
import { useFarmsBoard } from '@/lib/use-farms-board';
import FarmsBoardKpi from '@/components/admin-farms/FarmsBoardKpi';
import FarmsBoardMatrix from '@/components/admin-farms/FarmsBoardMatrix';
import FarmHistorySection from '@/components/admin-farms/FarmHistorySection';
import FarmDrawer from '@/components/farms/FarmDrawer';
import type { Farm } from '@/types';
import type { FarmHistoryRow } from '@/lib/use-farm-history';

/**
 * /dashboard/farms-board — 농장 운영 현황 (2026-05-16)
 *
 * kk 결정 (plan §12):
 * - Q1=A 신규 페이지 + 기존 /farms 보존
 * - Q2=2 useFarmsBoard RPC 분리 (마이그 085 — 4 round trip → 1 + admin only + PIPA 1h dedup)
 * - Q3=a 라벨 "평상 현황" 단축 통일
 * - Q4=iii 만료 임박 30일 임계 (운영 미리 알림 유효)
 * - Q5=1 "관리하기 →" outlined 버튼 + Settings2 + ArrowRight
 *
 * 구조 (평상 현황 패턴 답습):
 *   헤더 + 새로고침 + "관리하기 →"
 *   검색 (임차인명/전화번호)
 *   KPI 5종 (총/임대중/만료임박30일/비어있음/비운영)
 *   매트릭스 (zone × number, A존 + B존)
 *   FarmDrawer (셀 클릭, 기존 컴포넌트 재활용)
 */
export const dynamic = 'force-dynamic';

export default function FarmsBoardPage() {
  const { farms, zones, loading, refetch } = useFarmsBoard();
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const minDelay = new Promise<void>((r) => setTimeout(r, 600));
    try {
      await Promise.all([refetch(), minDelay]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // client-side 검색 필터 (임차인명/전화번호 부분 일치)
  const filteredFarms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return farms;
    return farms.filter((f) => {
      const name = f.current_rental?.customer?.name?.toLowerCase() ?? '';
      const phone = f.current_rental?.customer?.phone ?? '';
      return name.includes(q) || phone.includes(q);
    });
  }, [farms, search]);

  return (
    <div className="space-y-5">
      {/* 헤더 + 관리하기 버튼 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">
            농장 현황
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            농장 임대·만료·빈 상태를 실시간 확인합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-busy={isRefreshing}
            aria-label={isRefreshing ? '갱신 중' : '새로고침'}
            data-testid="farms-board-refresh"
            className="p-2 rounded-lg border border-border hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-opacity"
          >
            <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/dashboard/farms"
            data-testid="farms-board-manage"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-accent cursor-pointer transition-colors"
          >
            <Settings2 className="size-4" />
            관리하기
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* 검색 */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-tertiary pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="임차인명 / 전화번호"
          data-testid="farms-board-search"
          className="w-full pl-9 pr-3 h-9 border border-border rounded-lg text-xs focus:outline-none focus:border-primary"
          aria-label="임차인 검색"
        />
      </div>

      {/* KPI 카드 5종 */}
      <FarmsBoardKpi farms={farms} zones={zones} />

      {/* 매트릭스 (loading 시 spinner) */}
      {loading && farms.length === 0 ? (
        <div className="bg-card border rounded-xl p-10 text-center text-sm text-text-secondary">
          불러오는 중...
        </div>
      ) : (
        <FarmsBoardMatrix
          farms={filteredFarms}
          zones={zones}
          onFarmClick={setSelectedFarm}
        />
      )}

      {/* §이력 검색 (마이그 087, 모든 status 검색) */}
      <FarmHistorySection
        zones={zones.filter((z) => z.is_operational !== false)}
        onRowClick={(row: FarmHistoryRow) => {
          // 행 클릭 → 매트릭스에서 해당 농장 찾아 Drawer 오픈 (현재 데이터에 있을 때만)
          const found = farms.find((f) => f.id === row.farm_id);
          if (found) setSelectedFarm(found);
        }}
      />

      {/* 사이드 패널 (FarmDrawer 재활용) */}
      <FarmDrawer
        farm={selectedFarm}
        isOpen={selectedFarm !== null}
        onClose={() => setSelectedFarm(null)}
        onUpdate={refetch}
      />
    </div>
  );
}
