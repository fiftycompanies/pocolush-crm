'use client';

import { differenceInDays } from 'date-fns';
import { FARM_STATUS, EXPIRY_WARNING_DAYS, EXPIRY_DANGER_DAYS } from '@/lib/constants';
import Card from '@/components/ui/Card';
import type { Farm } from '@/types';

interface FarmMapProps {
  farms: Farm[];
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

export default function FarmMap({ farms, onFarmClick }: FarmMapProps) {
  const sorted = [...farms].sort((a, b) => a.position_y - b.position_y || a.position_x - b.position_x);

  return (
    <Card>
      <div className="px-6">
        <h3 className="text-sm font-semibold">농장 배치도</h3>
      </div>

      <div className="px-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {sorted.map((farm) => {
          const colors = getFarmColors(farm);
          const rental = farm.current_rental;
          const daysLeft = rental ? differenceInDays(new Date(rental.end_date), new Date()) : null;

          return (
            <button
              key={farm.id}
              onClick={() => onFarmClick(farm)}
              className={`relative rounded-lg p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
                (colors as { pulse?: boolean }).pulse ? 'animate-pulse' : ''
              }`}
              style={{
                backgroundColor: colors.bg,
                border: `1.5px solid ${colors.border}`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold" style={{ color: colors.text }}>
                  {farm.number}번
                </span>
                <div className="size-2 rounded-full" style={{ backgroundColor: colors.text }} />
              </div>

              {farm.status === 'rented' && rental ? (
                <div>
                  <p className="text-xs font-medium truncate">
                    {rental.customer?.name || '임차인'}
                  </p>
                  {daysLeft !== null && (
                    <p className="text-xs mt-0.5" style={{ color: colors.text }}>
                      {daysLeft <= 0 ? '만료됨' : `D-${daysLeft}`}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs" style={{ color: colors.text }}>
                  {FARM_STATUS[farm.status]?.label || farm.status}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">{farm.area_pyeong}평</p>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-6 flex flex-wrap gap-5 pt-4 border-t">
        {[
          { color: '#059669', label: '임대중' },
          { color: '#16A34A', label: '비어있음' },
          { color: '#D97706', label: '만료임박(30일)' },
          { color: '#DC2626', label: '만료임박(7일)' },
          { color: '#64748B', label: '관리중' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
