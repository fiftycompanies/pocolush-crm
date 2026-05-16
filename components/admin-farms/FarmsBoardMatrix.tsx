'use client';

import { useMemo } from 'react';
import type { Farm, FarmZone } from '@/types';

interface Props {
  farms: Farm[];
  zones: FarmZone[];
  onFarmClick: (farm: Farm) => void;
}

/**
 * 농장 zone × number 매트릭스 (2026-05-16)
 * - 운영 zone 만 표시 (A존 + B존)
 * - 셀 색상: 임대중(emerald) / 만료 임박 30일(amber) / 비어있음(gray)
 * - 검색 필터 적용된 farms 만 표시 (빈 결과 → empty state)
 */

const cellClass = (farm: Farm): string => {
  const rental = farm.current_rental;
  if (!rental) return 'bg-gray-50 border-gray-200';

  // 만료 임박 30일 체크 (kk Q4)
  const today = new Date();
  const threshold = new Date(today);
  threshold.setDate(today.getDate() + 30);
  if (rental.end_date && new Date(rental.end_date) <= threshold) {
    return 'bg-amber-50 border-amber-200';
  }
  return 'bg-emerald-50 border-emerald-200';
};

export default function FarmsBoardMatrix({ farms, zones, onFarmClick }: Props) {
  // zone 별 grouping
  const farmsByZone = useMemo(() => {
    const map = new Map<string, Farm[]>();
    for (const z of zones) {
      map.set(
        z.id,
        farms.filter((f) => f.zone_id === z.id).sort((a, b) => a.number - b.number),
      );
    }
    return map;
  }, [farms, zones]);

  if (farms.length === 0) {
    return (
      <div className="bg-card border rounded-xl p-10 text-center text-sm text-text-secondary">
        검색 결과가 없습니다.
      </div>
    );
  }

  const operationalZones = zones.filter((z) => z.is_operational);
  if (operationalZones.length === 0) {
    return (
      <div className="bg-card border rounded-xl p-10 text-center text-sm text-text-secondary">
        운영 중인 zone 이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="farms-board-matrix">
      {operationalZones.map((zone) => {
        const zoneFarms = farmsByZone.get(zone.id) ?? [];
        if (zoneFarms.length === 0) return null;
        return (
          <section key={zone.id} className="bg-card border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">{zone.name}</h3>
              <span className="text-xs text-text-secondary">
                {zoneFarms.length}개 농장
              </span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {zoneFarms.map((f) => {
                const rental = f.current_rental;
                return (
                  <button
                    key={f.id}
                    onClick={() => onFarmClick(f)}
                    className={`rounded-lg p-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer border ${cellClass(f)}`}
                    type="button"
                    aria-label={`${f.number}번 농장 ${rental?.customer?.name ?? '비어있음'}`}
                  >
                    <p className="text-xs font-bold">{f.number}번</p>
                    <p className="text-[11px] text-text-secondary truncate mt-0.5">
                      {rental?.customer?.name ?? '비어있음'}
                    </p>
                    {rental?.end_date && (
                      <p className="text-[10px] text-text-tertiary mt-0.5">
                        ~ {rental.end_date.slice(5).replace('-', '.')}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
