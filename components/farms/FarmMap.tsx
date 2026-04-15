'use client';

import { differenceInDays, format } from 'date-fns';
import { FARM_STATUS, EXPIRY_WARNING_DAYS, EXPIRY_DANGER_DAYS } from '@/lib/constants';
import { Wrench, Plus } from 'lucide-react';
import Card from '@/components/ui/Card';
import type { Farm, FarmZone, ServiceOrder } from '@/types';

const ZONE_COLORS = [
  { accent: '#059669', headerBg: '#ECFDF5', border: '#86EFAC' },
  { accent: '#2563EB', headerBg: '#EFF6FF', border: '#93C5FD' },
  { accent: '#D97706', headerBg: '#FFFBEB', border: '#FCD34D' },
  { accent: '#DC2626', headerBg: '#FEF2F2', border: '#FCA5A5' },
  { accent: '#7C3AED', headerBg: '#F5F3FF', border: '#C4B5FD' },
  { accent: '#0891B2', headerBg: '#ECFEFF', border: '#67E8F9' },
];

interface FarmMapProps {
  farms: Farm[];
  zones?: FarmZone[];
  pendingOrders?: (ServiceOrder & { product?: { name: string }; member?: { name: string } })[];
  onFarmClick: (farm: Farm) => void;
  onAddSite?: (zoneId: string) => void;
}

function getCellColors(farm: Farm) {
  if (farm.status === 'maintenance') return { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' };
  if (farm.status === 'available') return { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' };
  const rental = farm.current_rental;
  if (rental) {
    const d = differenceInDays(new Date(rental.end_date), new Date());
    if (d <= EXPIRY_DANGER_DAYS) return { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' };
    if (d <= EXPIRY_WARNING_DAYS) return { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' };
  }
  return { bg: '#DCFCE7', text: '#059669', border: '#86EFAC' };
}

function buildTooltip(farm: Farm, orders: (ServiceOrder & { product?: { name: string } })[]) {
  const lines: string[] = [`${farm.number}번 · ${farm.area_pyeong}평`];
  const rental = farm.current_rental;
  if (rental) {
    lines.push(`${rental.customer?.name || '-'}`);
    lines.push(`${format(new Date(rental.start_date), 'yy.M.d')} ~ ${format(new Date(rental.end_date), 'yy.M.d')}`);
    const d = differenceInDays(new Date(rental.end_date), new Date());
    lines.push(`${d <= 0 ? '만료' : 'D-' + d} · ${rental.payment_status}`);
  }
  if (orders.length > 0) lines.push(`작업: ${orders.map(o => o.product?.name).join(', ')}`);
  return lines.join('\n');
}

export default function FarmMap({ farms, zones = [], pendingOrders = [], onFarmClick, onAddSite }: FarmMapProps) {
  // 농장별 주문 매핑
  const farmOrderMap = new Map<string, typeof pendingOrders>();
  pendingOrders.forEach(o => {
    if (o.farm_id) {
      const arr = farmOrderMap.get(o.farm_id) || [];
      arr.push(o);
      farmOrderMap.set(o.farm_id, arr);
    }
  });

  // 전체 통계
  const totalFarms = farms.length;
  const rentedCount = farms.filter(f => f.status === 'rented').length;
  const availableCount = farms.filter(f => f.status === 'available').length;
  const expiringCount = farms.filter(f => {
    if (f.status !== 'rented' || !f.current_rental) return false;
    return differenceInDays(new Date(f.current_rental.end_date), new Date()) <= EXPIRY_WARNING_DAYS;
  }).length;

  return (
    <Card padding={false}>
      {/* 헤더 */}
      <div className="px-6 pt-6 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">농장 배치도</h3>
          <p className="text-xs text-muted-foreground mt-0.5">총 {totalFarms}구좌</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {[
            { color: '#059669', label: '임대중', count: rentedCount },
            { color: '#16A34A', label: '비어있음', count: availableCount },
            { color: '#D97706', label: '만료임박', count: expiringCount },
            { color: '#64748B', label: '관리중', count: farms.filter(f => f.status === 'maintenance').length },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-semibold text-text-primary">{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 존별 그리드 */}
      <div className="px-6 pb-6 space-y-5 mt-4">
        {zones.map((zone, zi) => {
          const zc = ZONE_COLORS[zi % ZONE_COLORS.length];
          const zoneFarms = farms.filter(f => f.zone_id === zone.id).sort((a, b) => a.number - b.number);
          const zRented = zoneFarms.filter(f => f.status === 'rented').length;
          const zAvailable = zoneFarms.filter(f => f.status === 'available').length;

          return (
            <div key={zone.id}>
              {/* 존 헤더 */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded text-white" style={{ backgroundColor: zc.accent }}>
                  {zone.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {zoneFarms.length}구좌
                </span>
                <span className="text-xs text-green font-medium">{zRented} 임대</span>
                <span className="text-xs text-emerald-600 font-medium">{zAvailable} 공실</span>
              </div>

              {/* 사이트 그리드 */}
              <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-10 gap-1.5">
                {zoneFarms.map(farm => {
                  const colors = getCellColors(farm);
                  const orders = farmOrderMap.get(farm.id) || [];
                  const rental = farm.current_rental;
                  const hasOrders = orders.length > 0;

                  const daysLeft = rental ? differenceInDays(new Date(rental.end_date), new Date()) : null;
                  return (
                    <button
                      key={farm.id}
                      onClick={() => onFarmClick(farm)}
                      title={buildTooltip(farm, orders)}
                      className="rounded-lg p-2 text-left cursor-pointer transition-all hover:scale-[1.04] hover:shadow-md hover:z-10 relative"
                      style={{ backgroundColor: colors.bg, border: `1.5px solid ${colors.border}` }}
                    >
                      {/* 번호 + 작업점 */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold" style={{ color: colors.text }}>{farm.number}</span>
                        {hasOrders && <div className="size-1.5 rounded-full bg-orange-500 shrink-0" />}
                      </div>
                      {rental ? (
                        <>
                          <p className="text-[9px] font-medium truncate mt-0.5" style={{ color: colors.text }}>
                            {rental.customer?.name}
                          </p>
                          <p className="text-[8px] truncate mt-0.5 opacity-60" style={{ color: colors.text }}>
                            {format(new Date(rental.start_date), 'yy.M')}~{format(new Date(rental.end_date), 'yy.M')}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[8px] font-bold" style={{ color: colors.text }}>
                              {daysLeft !== null && (daysLeft <= 0 ? '만료' : `D-${daysLeft}`)}
                            </span>
                            <span className={`text-[7px] px-1 rounded ${
                              rental.payment_status === '납부완료' ? 'bg-green/15 text-green' :
                              rental.payment_status === '미납' ? 'bg-red/15 text-red' :
                              'bg-yellow/15 text-yellow-700'
                            }`}>{rental.payment_status}</span>
                          </div>
                        </>
                      ) : (
                        <p className="text-[9px] truncate mt-0.5" style={{ color: colors.text, opacity: 0.7 }}>
                          {FARM_STATUS[farm.status]?.label}
                        </p>
                      )}
                    </button>
                  );
                })}

                {/* + 추가 버튼 */}
                {onAddSite && (
                  <button
                    onClick={() => onAddSite(zone.id)}
                    className="rounded-lg border-2 border-dashed border-border/60 flex flex-col items-center justify-center text-text-tertiary hover:border-primary hover:text-primary hover:bg-primary/5 cursor-pointer transition-all p-2"
                  >
                    <Plus className="size-4" />
                    <span className="text-[8px] mt-0.5">추가</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
