'use client';

import StatsCards from '@/components/dashboard/StatsCards';
import DashboardList from '@/components/dashboard/DashboardList';

export default function DashboardPage() {
  const today = new Date();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
          <p className="text-sm text-muted-foreground mt-1">포코러쉬 농장 운영 현황</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {today.getFullYear()}.{today.getMonth() + 1}.{today.getDate()} ({dayNames[today.getDay()]})
        </p>
      </div>

      <StatsCards />
      <DashboardList />
    </div>
  );
}
