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
  if (farm.status === 'maintenance') return { bg: '#F3F4F6', border: '#D1D5DB', text: '#6B7280' };
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
      <h3 className="text-[16px] font-semibold text-text-primary mb-4">농장 배치도</h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {sorted.map((farm) => {
          const colors = getFarmColors(farm);
          const rental = farm.current_rental;
          const daysLeft = rental ? differenceInDays(new Date(rental.end_date), new Date()) : null;

          return (
            <button
              key={farm.id}
              onClick={() => onFarmClick(farm)}
              className={`relative rounded-xl p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
                (colors as { pulse?: boolean }).pulse ? 'animate-pulse' : ''
              }`}
              style={{
                backgroundColor: colors.bg,
                border: `1.5px solid ${colors.border}`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[14px] font-bold" style={{ color: colors.text }}>
                  {farm.number}번
                </span>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.text }} />
              </div>

              {farm.status === 'rented' && rental ? (
                <div>
                  <p className="text-[14px] text-text-primary font-medium truncate">
                    {rental.customer?.name || '임차인'}
                  </p>
                  {daysLeft !== null && (
                    <p className="text-[12px] mt-0.5" style={{ color: colors.text }}>
                      {daysLeft <= 0 ? '만료됨' : `D-${daysLeft}`}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[14px]" style={{ color: colors.text }}>
                  {FARM_STATUS[farm.status]?.label || farm.status}
                </p>
              )}
              <p className="text-[12px] text-text-secondary mt-1">{farm.area_pyeong}평</p>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-border">
        {[
          { color: '#059669', label: '임대중' },
          { color: '#16A34A', label: '비어있음' },
          { color: '#D97706', label: '만료임박(30일)' },
          { color: '#DC2626', label: '만료임박(7일)' },
          { color: '#6B7280', label: '관리중' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="text-[12px] text-text-secondary">{item.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
