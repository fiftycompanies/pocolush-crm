'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Stats {
  todayNew: number;
  unprocessed: number;
  monthConverted: number;
  total: number;
}

const cards = [
  { key: 'todayNew', label: '오늘 신규', icon: '📥', color: '#3B82F6' },
  { key: 'unprocessed', label: '미처리', icon: '⏳', color: '#F59E0B' },
  { key: 'monthConverted', label: '이달 계약', icon: '✅', color: '#10B981' },
  { key: 'total', label: '누적 문의', icon: '📊', color: '#8B5CF6' },
] as const;

export default function StatsCards() {
  const supabase = createClient();
  const [stats, setStats] = useState<Stats>({
    todayNew: 0,
    unprocessed: 0,
    monthConverted: 0,
    total: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

      const [todayRes, unprocessedRes, convertedRes, totalRes] = await Promise.all([
        supabase
          .from('inquiries')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', todayStr),
        supabase
          .from('inquiries')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'new'),
        supabase
          .from('inquiries')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'converted')
          .gte('updated_at', monthStart),
        supabase
          .from('inquiries')
          .select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        todayNew: todayRes.count ?? 0,
        unprocessed: unprocessedRes.count ?? 0,
        monthConverted: convertedRes.count ?? 0,
        total: totalRes.count ?? 0,
      });
    };

    fetchStats();
  }, [supabase]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.key}
          className="bg-bg-card border border-border rounded-xl p-5 hover:border-border-light transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl">{card.icon}</span>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ color: card.color, backgroundColor: `${card.color}15` }}
            >
              {card.label}
            </span>
          </div>
          <p className="text-3xl font-bold text-text-primary">
            {stats[card.key]}
          </p>
        </div>
      ))}
    </div>
  );
}
