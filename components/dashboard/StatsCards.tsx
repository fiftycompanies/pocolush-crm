'use client';

import { MessageSquare, AlertCircle, CheckCircle, MapPin } from 'lucide-react';
import Card from '@/components/ui/Card';
import { useDashboardStats } from '@/lib/use-data';

const cards = [
  { key: 'todayNew' as const, label: '오늘 신규', icon: MessageSquare, iconColor: '#3B82F6', iconBg: '#EFF6FF' },
  { key: 'unprocessed' as const, label: '미처리', icon: AlertCircle, iconColor: '#EF4444', iconBg: '#FEF2F2' },
  { key: 'monthConverted' as const, label: '이달 계약', icon: CheckCircle, iconColor: '#10B981', iconBg: '#ECFDF5' },
  { key: 'rentedFarms' as const, label: '임대중 농장', icon: MapPin, iconColor: '#F59E0B', iconBg: '#FFFBEB' },
];

export default function StatsCards() {
  const { data: stats } = useDashboardStats();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.key}>
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: card.iconBg }}
              >
                <Icon className="w-5 h-5" style={{ color: card.iconColor }} />
              </div>
              <span className="text-[13px] text-text-secondary">{card.label}</span>
            </div>
            <p className="text-[32px] font-bold text-text-primary leading-none">
              {stats[card.key]}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
