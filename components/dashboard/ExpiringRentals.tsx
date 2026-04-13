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
      <div className="flex items-center gap-2.5 px-6 py-4">
        <div className="size-8 rounded-md bg-yellow-light flex items-center justify-center">
          <AlertTriangle className="size-4 text-yellow" />
        </div>
        <h3 className="text-sm font-semibold">만료 임박 계약</h3>
        <span className="text-xs font-semibold text-yellow bg-yellow-light px-2 py-0.5 rounded-full">
          {rentals.length}
        </span>
      </div>
      <div>
        {rentals.map((r, i) => {
          const daysLeft = differenceInDays(new Date(r.end_date), new Date());
          const isDanger = daysLeft <= EXPIRY_DANGER_DAYS;
          const badgeColor = isDanger ? '#EF4444' : '#F59E0B';
          const badgeBg = isDanger ? '#FEF2F2' : '#FFFBEB';
          const badgeLabel = daysLeft <= 0 ? '오늘 만료' : `D-${daysLeft}`;

          return (
            <div
              key={r.id}
              onClick={() => router.push(`/dashboard/rentals/${r.id}`)}
              className={`flex items-center gap-3 px-6 py-3 hover:bg-muted/20 cursor-pointer transition-all ${
                'border-t border-border/40'
              }`}
            >
              <span className="text-sm font-bold text-foreground">{r.farm?.number}번 농장</span>
              <span className="text-sm font-medium">{r.customer?.name}</span>
              <span className="text-xs text-muted-foreground hidden sm:block">{r.customer?.phone}</span>
              <Badge label={badgeLabel} color={badgeColor} bg={badgeBg} className={isDanger ? 'animate-pulse' : ''} />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = `tel:${r.customer?.phone}`;
                }}
                className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-all cursor-pointer bg-accent px-2.5 py-1.5 rounded-md hover:bg-accent/80"
              >
                <Phone className="size-3.5" />
                연락
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
