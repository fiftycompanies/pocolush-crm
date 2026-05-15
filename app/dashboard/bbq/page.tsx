'use client';

import { useEffect, useState } from 'react';
import FacilitiesSection from '@/components/admin-bbq/FacilitiesSection';
import TimeSlotsSection from '@/components/admin-bbq/TimeSlotsSection';
import ProductsSection from '@/components/admin-bbq/ProductsSection';
import FacilitiesTable from '@/components/admin-bbq/FacilitiesTable';

/**
 * 평상 설정 — 통합 페이지 (2026-05-16)
 *
 * 통합 배경 (thoughts/research/20260516-0030_bbq_consolidation_research.md):
 * - 기존 /dashboard/bbq-products (평상 메뉴) 페이지의 상품/이벤트 데이터가 1건씩만
 *   존재하여 단독 페이지 비용 대비 가치 낮음 → §3 상품·이벤트 섹션으로 통합
 *
 * 구조 (안 A — 3 섹션 단일 페이지):
 *   §1 평상 배치도 (FacilitiesSection)
 *   §2 타임 슬롯 (TimeSlotsSection)
 *   §3 상품·이벤트 (ProductsSection)  ← 통합
 *   §4 시설 목록 (FacilitiesTable, collapsible)
 */
export default function BBQSettingsPage() {
  const [facilityKpi, setFacilityKpi] = useState({ total: 0, active: 0 });
  const [slotKpi, setSlotKpi] = useState({ total: 0, active: 0 });
  const [productKpi, setProductKpi] = useState({ products: 0, events: 0 });
  const [facilityRefreshKey, setFacilityRefreshKey] = useState(0);

  // §1 변경 시 §4 테이블도 갱신
  const handleFacilitiesChange = (data: {
    total: number;
    active: number;
    facilities: unknown[];
  }) => {
    setFacilityKpi({ total: data.total, active: data.active });
    setFacilityRefreshKey((k) => k + 1);
  };

  // 페이지 진입 시 #products 해시 있으면 자동 스크롤
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#products') {
      const el = document.getElementById('products');
      if (el) {
        // 약간의 딜레이로 섹션 마운트 대기
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
      }
    }
  }, []);

  return (
    <div className="space-y-6" style={{ maxWidth: '1200px' }}>
      {/* 헤더 + KPI */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">
            평상 설정
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            시설 {facilityKpi.total}개 · 활성 {facilityKpi.active}개 · 타임 {slotKpi.total}개
            · 상품 {productKpi.products}개 · 이벤트 {productKpi.events}개
          </p>
        </div>
      </div>

      {/* §1 평상 배치도 */}
      <FacilitiesSection onChange={handleFacilitiesChange} />

      {/* §2 타임 슬롯 */}
      <TimeSlotsSection onChange={setSlotKpi} />

      {/* §3 상품·이벤트 (통합) */}
      <ProductsSection onChange={setProductKpi} />

      {/* §4 시설 목록 (collapsible) */}
      <FacilitiesTable refreshKey={facilityRefreshKey} />
    </div>
  );
}
