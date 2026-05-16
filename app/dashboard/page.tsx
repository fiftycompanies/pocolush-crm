'use client';

import { useState, useEffect } from 'react';
import StatsCards from '@/components/dashboard/StatsCards';
import DashboardList from '@/components/dashboard/DashboardList';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;

export default function DashboardPage() {
  // SSR/hydration 자정 경계 mismatch 방지 (React #418)
  // 'use client' 라도 Next.js 는 server 에서 1회 렌더 후 client 에서 hydration.
  // 두 시점 사이의 ms 차이가 자정 ±2초에서 날짜 mismatch → React #418 발생.
  // useState 초기값 null + useEffect 로 client 마운트 후만 표시 → mismatch 0.
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []);

  const dateText = today
    ? `${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()} (${DAY_NAMES[today.getDay()]})`
    : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
          <p className="text-sm text-muted-foreground mt-1">포코러쉬 농장 운영 현황</p>
        </div>
        {/* suppressHydrationWarning: 첫 렌더 빈 표시 → mount 후 날짜 채움. 의도된 mismatch */}
        <p className="text-sm text-muted-foreground" suppressHydrationWarning>
          {dateText}
        </p>
      </div>

      <StatsCards />
      <DashboardList />
    </div>
  );
}
