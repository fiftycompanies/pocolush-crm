'use client';

import { MessageSquare, AlertCircle, CheckCircle, MapPin } from 'lucide-react';
import { useDashboardStats } from '@/lib/use-data';

const cards = [
  { key: 'todayNew' as const, label: '오늘 신규', icon: MessageSquare, emoji: '📩' },
  { key: 'unprocessed' as const, label: '미처리', icon: AlertCircle, emoji: '🔴' },
  { key: 'monthConverted' as const, label: '이달 계약', icon: CheckCircle, emoji: '✅' },
  { key: 'rentedFarms' as const, label: '임대중 농장', icon: MapPin, emoji: '🌱' },
];

export default function StatsCards() {
  const { data: stats } = useDashboardStats();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.key}
          className="bg-card text-card-foreground rounded-xl border shadow-sm"
        >
          <div className="p-5">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
              <span className="text-xl">{card.emoji}</span>
            </div>
            <div className="mt-2">
              <p className="text-2xl font-bold tracking-tight">
                {stats[card.key]}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
