'use client';

import { differenceInDays, format } from 'date-fns';
import { FARM_STATUS, EXPIRY_WARNING_DAYS, EXPIRY_DANGER_DAYS } from '@/lib/constants';
import { Wrench } from 'lucide-react';
import Card from '@/components/ui/Card';
import type { Farm, FarmZone, ServiceOrder } from '@/types';

const ZONE_COLORS = [
  { border: '#86EFAC', accent: '#059669', headerBg: '#ECFDF5' },
  { border: '#93C5FD', accent: '#2563EB', headerBg: '#EFF6FF' },
  { border: '#FCD34D', accent: '#D97706', headerBg: '#FFFBEB' },
  { border: '#FCA5A5', accent: '#DC2626', headerBg: '#FEF2F2' },
  { border: '#C4B5FD', accent: '#7C3AED', headerBg: '#F5F3FF' },
  { border: '#67E8F9', accent: '#0891B2', headerBg: '#ECFEFF' },
];

interface FarmMapProps {
  farms: Farm[];
  zones?: FarmZone[];
  pendingOrders?: (ServiceOrder & { product?: { name: string }; member?: { name: string } })[];
  onFarmClick: (farm: Farm) => void;
  onAddSite?: (zoneId: string) => void;
}

function getCellStyle(farm: Farm): { bg: string; text: string; border: string } {
  if (farm.status === 'maintenance') return { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' };
  if (farm.status === 'available') return { bg: '#F0FDF4', text: '#16A34A', border: '#86EFAC' };
  const rental = farm.current_rental;
  if (rental) {
    const d = differenceInDays(new Date(rental.end_date), new Date());
    if (d <= EXPIRY_DANGER_DAYS) return { bg: '#FEF2F2', text: '#DC2626', border: '#FCA5A5' };
    if (d <= EXPIRY_WARNING_DAYS) return { bg: '#FFFBEB', text: '#D97706', border: '#FCD34D' };
  }
  return { bg: '#DCFCE7', text: '#059669', border: '#86EFAC' };
}

function buildTooltip(farm: Farm, orders: (ServiceOrder & { product?: { name: string } })[]) {
  const lines: string[] = [`${farm.number}번 · ${farm.area_pyeong}평 · ${FARM_STATUS[farm.status]?.label}`];
  const rental = farm.current_rental;
  if (rental) {
    lines.push(`임차인: ${rental.customer?.name || '-'}`);
    lines.push(`기간: ${format(new Date(rental.start_date), 'yy.M.d')} ~ ${format(new Date(rental.end_date), 'yy.M.d')}`);
    const d = differenceInDays(new Date(rental.end_date), new Date());
    lines.push(`${d <= 0 ? '만료됨' : `D-${d}`} · ${rental.payment_status}`);
  }
  if (orders.length > 0) {
    lines.push(`작업: ${orders.map(o => o.product?.name).join(', ')}`);
  }
  return lines.join('\n');
}

export default function FarmMap({ farms, zones = [], pendingOrders = [], onFarmClick, onAddSite }: FarmMapProps) {
  const farmOrderMap = new Map<string, typeof pendingOrders>();
  pendingOrders.forEach(o => {
    if (o.farm_id) {
      const existing = farmOrderMap.get(o.farm_id) || [];
      existing.push(o);
      farmOrderMap.set(o.farm_id, existing);
    }
  });

  const totalFarms = farms.length;
  const rentedCount = farms.filter(f => f.status === 'rented').length;
  const availableCount = farms.filter(f => f.status === 'available').length;
  const expiringCount = farms.filter(f => {
    if (f.status !== 'rented' || !f.current_rental) return false;
    const d = differenceInDays(new Date(f.current_rental.end_date), new Date());
    return d <= EXPIRY_WARNING_DAYS && d > 0;
  }).length;
  const pendingOrderCount = pendingOrders.length;
  const unzonedFarms = farms.filter(f => !zones.find(z => z.id === f.zone_id));

  return (
    <Card padding={false}>
      {/* 상단 요약 */}
      <div className="px-6 pt-6 flex items-center justify-between">
        <h3 className="text-sm font-semibold">농장 현황 배치도</h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">총 <span className="font-bold text-text-primary">{totalFarms}</span>구좌</span>
          <span className="text-green font-medium">{rentedCount} 임대</span>
          <span className="text-emerald-600 font-medium">{availableCount} 비어있음</span>
          {expiringCount > 0 && <span className="text-yellow-600 font-medium">{expiringCount} 만료임박</span>}
          {pendingOrderCount > 0 && (
            <span className="flex items-center gap-1 text-orange-600 font-medium">
              <Wrench className="size-3" /> {pendingOrderCount}건 작업
            </span>
          )}
        </div>
      </div>

      {/* 존별 섹션 */}
      <div className="px-6 space-y-4">
        {zones.map((zone, zi) => {
          const zc = ZONE_COLORS[zi % ZONE_COLORS.length];
          const zoneFarms = farms.filter(f => f.zone_id === zone.id).sort((a, b) => a.number - b.number);
          const zoneRented = zoneFarms.filter(f => f.status === 'rented').length;

          return (
            <div key={zone.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${zc.border}40` }}>
              {/* 존 헤더 */}
              <div className="flex items-center justify-between px-4 py-2" style={{ backgroundColor: zc.headerBg }}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: zc.accent }}>
                    {zone.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {zoneFarms.length}구좌 · {zoneRented}임대 · {zoneFarms.length - zoneRented}비어있음
                  </span>
                </div>
              </div>

              {/* 10열 컴팩트 그리드 */}
              <div className="p-3 grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10 gap-1.5">
                {zoneFarms.map(farm => {
                  const style = getCellStyle(farm);
                  const orders = farmOrderMap.get(farm.id) || [];
                  const hasOrders = orders.length > 0;
                  return (
                    <button
                      key={farm.id}
                      onClick={() => onFarmClick(farm)}
                      title={buildTooltip(farm, orders)}
                      className="aspect-square rounded-lg flex items-center justify-center text-xs font-bold cursor-pointer transition-all hover:scale-105 hover:shadow-md hover:z-10 relative min-w-[44px] min-h-[44px]"
                      style={{ backgroundColor: style.bg, color: style.text, border: `1.5px solid ${style.border}` }}
                    >
                      {farm.number}
                      {hasOrders && (
                        <div className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-orange-500" />
                      )}
                    </button>
                  );
                })}

                {/* + 추가 버튼 (마지막 셀 옆) */}
                {onAddSite && (
                  <button
                    onClick={() => onAddSite(zone.id)}
                    className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center text-text-tertiary hover:border-primary hover:text-primary hover:bg-primary/5 cursor-pointer transition-all min-w-[44px] min-h-[44px] text-lg"
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* 미분류 */}
        {unzonedFarms.length > 0 && (
          <div className="rounded-xl overflow-hidden border border-yellow-200">
            <div className="flex items-center px-4 py-2 bg-yellow-50">
              <span className="text-xs font-bold text-yellow-700">미분류 ({unzonedFarms.length}구좌)</span>
            </div>
            <div className="p-3 grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10 gap-1.5">
              {unzonedFarms.map(farm => {
                const style = getCellStyle(farm);
                return (
                  <button key={farm.id} onClick={() => onFarmClick(farm)} title={buildTooltip(farm, [])}
                    className="aspect-square rounded-lg flex items-center justify-center text-xs font-bold cursor-pointer transition-all hover:scale-105 min-w-[44px] min-h-[44px]"
                    style={{ backgroundColor: style.bg, color: style.text, border: `1.5px solid ${style.border}` }}>
                    {farm.number}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 범례 */}
      <div className="px-6 pb-6 flex flex-wrap gap-4 pt-4 border-t">
        {[
          { color: '#059669', label: '임대중' },
          { color: '#16A34A', label: '비어있음' },
          { color: '#D97706', label: '만료임박' },
          { color: '#DC2626', label: '만료위험' },
          { color: '#64748B', label: '관리중' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-[11px] text-muted-foreground">{item.label}</span>
          </div>
        ))}
        <span className="text-[11px] text-muted-foreground">|</span>
        <div className="flex items-center gap-1.5">
          <div className="size-2 rounded-full bg-orange-500" />
          <span className="text-[11px] text-muted-foreground">서비스 작업</span>
        </div>
      </div>
    </Card>
  );
}
