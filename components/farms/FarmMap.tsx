'use client';

import { differenceInDays, format } from 'date-fns';
import { FARM_STATUS, EXPIRY_WARNING_DAYS, EXPIRY_DANGER_DAYS } from '@/lib/constants';
import { Wrench, Droplets, Scissors, Package } from 'lucide-react';
import Card from '@/components/ui/Card';
import type { Farm, FarmZone, ServiceOrder } from '@/types';

const ZONE_COLORS = [
  { border: '#86EFAC', accent: '#059669', bg: '#F0FDF410', headerBg: '#ECFDF5' },
  { border: '#93C5FD', accent: '#2563EB', bg: '#EFF6FF10', headerBg: '#EFF6FF' },
  { border: '#FCD34D', accent: '#D97706', bg: '#FFFBEB10', headerBg: '#FFFBEB' },
  { border: '#FCA5A5', accent: '#DC2626', bg: '#FEF2F210', headerBg: '#FEF2F2' },
  { border: '#C4B5FD', accent: '#7C3AED', bg: '#F5F3FF10', headerBg: '#F5F3FF' },
  { border: '#67E8F9', accent: '#0891B2', bg: '#ECFEFF10', headerBg: '#ECFEFF' },
];

interface FarmMapProps {
  farms: Farm[];
  zones?: FarmZone[];
  pendingOrders?: (ServiceOrder & { product?: { name: string }; member?: { name: string } })[];
  onFarmClick: (farm: Farm) => void;
}

function getFarmColors(farm: Farm) {
  if (farm.status === 'maintenance') return { bg: '#F1F5F9', border: '#CBD5E1', text: '#64748B' };
  if (farm.status === 'available') return { bg: '#F0FDF4', border: '#86EFAC', text: '#16A34A' };
  const rental = farm.current_rental;
  if (rental) {
    const daysLeft = differenceInDays(new Date(rental.end_date), new Date());
    if (daysLeft <= EXPIRY_DANGER_DAYS) return { bg: '#FEF2F2', border: '#FCA5A5', text: '#DC2626', pulse: true };
    if (daysLeft <= EXPIRY_WARNING_DAYS) return { bg: '#FFFBEB', border: '#FCD34D', text: '#D97706', pulse: true };
  }
  return { bg: '#DCFCE7', border: '#86EFAC', text: '#059669' };
}

function getOrderIcon(productName: string) {
  const n = productName.toLowerCase();
  if (n.includes('물주기') || n.includes('water')) return Droplets;
  if (n.includes('잡초') || n.includes('weed')) return Scissors;
  return Package;
}

function FarmCard({ farm, farmOrders, onFarmClick }: {
  farm: Farm;
  farmOrders: (ServiceOrder & { product?: { name: string } })[];
  onFarmClick: (farm: Farm) => void;
}) {
  const colors = getFarmColors(farm);
  const rental = farm.current_rental;
  const daysLeft = rental ? differenceInDays(new Date(rental.end_date), new Date()) : null;

  return (
    <button
      onClick={() => onFarmClick(farm)}
      className={`relative rounded-xl p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-pointer ${
        (colors as { pulse?: boolean }).pulse ? 'animate-pulse' : ''
      }`}
      style={{ backgroundColor: colors.bg, border: `1.5px solid ${colors.border}` }}
    >
      <div className="flex items-baseline gap-1 mb-1.5">
        <span className="text-sm font-bold" style={{ color: colors.text }}>{farm.number}번</span>
        <span className="text-[10px] text-muted-foreground">{farm.area_pyeong}평</span>
      </div>

      {farm.status === 'rented' && rental ? (
        <div className="space-y-0.5">
          <p className="text-[11px] font-medium truncate">{rental.customer?.name || '임차인'}</p>
          <p className="text-[9px] text-muted-foreground">
            {format(new Date(rental.start_date), 'yy.M.d')} ~ {format(new Date(rental.end_date), 'yy.M.d')}
          </p>
          <div className="flex items-center gap-1.5">
            {daysLeft !== null && (
              <span className="text-[10px] font-bold" style={{ color: colors.text }}>
                {daysLeft <= 0 ? '만료' : `D-${daysLeft}`}
              </span>
            )}
            <span className={`text-[8px] font-medium px-1 py-0.5 rounded ${
              rental.payment_status === '납부완료' ? 'bg-green/10 text-green' :
              rental.payment_status === '미납' ? 'bg-red/10 text-red' :
              'bg-yellow/10 text-yellow-700'
            }`}>{rental.payment_status}</span>
          </div>
        </div>
      ) : (
        <p className="text-[11px] font-medium" style={{ color: colors.text }}>
          {FARM_STATUS[farm.status]?.label || farm.status}
        </p>
      )}

      {farmOrders.length > 0 && (
        <div className="mt-1.5 pt-1.5 border-t border-black/5">
          {farmOrders.slice(0, 2).map(o => {
            const Icon = getOrderIcon(o.product?.name || '');
            return (
              <div key={o.id} className="flex items-center gap-1 text-[9px] text-orange-700">
                <Icon className="size-2.5 shrink-0" />
                <span className="truncate">{o.product?.name}</span>
                <span className={`shrink-0 px-1 rounded text-[7px] font-medium ${
                  o.status === 'processing' ? 'bg-blue/10 text-blue' : 'bg-orange-100 text-orange-600'
                }`}>{o.status === 'processing' ? '진행' : '대기'}</span>
              </div>
            );
          })}
          {farmOrders.length > 2 && (
            <p className="text-[8px] text-orange-500 mt-0.5">+{farmOrders.length - 2}건</p>
          )}
        </div>
      )}
    </button>
  );
}

export default function FarmMap({ farms, zones = [], pendingOrders = [], onFarmClick }: FarmMapProps) {
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
    <Card>
      {/* 상단 요약 */}
      <div className="px-6 flex items-center justify-between">
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
              {/* 사이트 그리드 */}
              <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {zoneFarms.length === 0 ? (
                  <p className="col-span-full text-center text-xs text-text-tertiary py-4">사이트가 없습니다.</p>
                ) : (
                  zoneFarms.map(farm => (
                    <FarmCard
                      key={farm.id}
                      farm={farm}
                      farmOrders={farmOrderMap.get(farm.id) || []}
                      onFarmClick={onFarmClick}
                    />
                  ))
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
            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
              {unzonedFarms.map(farm => (
                <FarmCard key={farm.id} farm={farm} farmOrders={farmOrderMap.get(farm.id) || []} onFarmClick={onFarmClick} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 범례 */}
      <div className="px-6 flex flex-wrap gap-4 pt-4 border-t">
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
          <Wrench className="size-3 text-orange-500" />
          <span className="text-[11px] text-muted-foreground">서비스 작업</span>
        </div>
      </div>
    </Card>
  );
}
