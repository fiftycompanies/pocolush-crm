'use client';

import { useRouter } from 'next/navigation';
import { differenceInDays } from 'date-fns';
import { AlertTriangle, Phone } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { EXPIRY_DANGER_DAYS } from '@/lib/constants';
import { useExpiringRentals } from '@/lib/use-data';

export default function ExpiringRentals() {
  const router = useRouter();
  const { data: rentals } = useExpiringRentals();

  if (rentals.length === 0) return null;

  return (
    <Card padding={false}>
      <div className="flex items-center gap-2 px-6 py-4">
        <AlertTriangle className="w-4 h-4 text-yellow" />
        <h3 className="text-[16px] font-semibold text-text-primary">만료 임박 계약</h3>
        <span className="text-[12px] font-medium text-yellow bg-yellow-light px-2 py-0.5 rounded-md">
          {rentals.length}
        </span>
      </div>
      <div>
        {rentals.map((r) => {
          const daysLeft = differenceInDays(new Date(r.end_date), new Date());
          const isDanger = daysLeft <= EXPIRY_DANGER_DAYS;
          const badgeColor = isDanger ? '#EF4444' : '#F59E0B';
          const badgeBg = isDanger ? '#FEF2F2' : '#FFFBEB';
          const badgeLabel = daysLeft <= 0 ? '오늘 만료' : `D-${daysLeft}`;

          return (
            <div
              key={r.id}
              onClick={() => router.push(`/dashboard/rentals/${r.id}`)}
              className="flex items-center gap-4 px-6 py-3.5 hover:bg-bg-hover cursor-pointer transition-colors border-t border-[#F3F4F6]"
            >
              <span className="text-[14px] font-bold text-primary">{r.farm?.number}번 농장</span>
              <span className="text-[14px] font-medium text-text-primary">{r.customer?.name}</span>
              <span className="text-[13px] text-text-secondary">{r.customer?.phone}</span>
              <Badge label={badgeLabel} color={badgeColor} bg={badgeBg} className={isDanger ? 'animate-pulse' : ''} />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = `tel:${r.customer?.phone}`;
                }}
                className="ml-auto flex items-center gap-1 text-[12px] text-primary hover:text-primary-dark transition-colors cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5" />
                연락
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
