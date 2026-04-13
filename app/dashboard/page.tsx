'use client';

import StatsCards from '@/components/dashboard/StatsCards';
import InquiryLineChart from '@/components/dashboard/InquiryLineChart';
import RecentInquiries from '@/components/dashboard/RecentInquiries';
import ExpiringRentals from '@/components/dashboard/ExpiringRentals';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
        <p className="text-sm text-muted-foreground mt-1">포코러쉬 문의 현황을 한눈에 확인하세요</p>
      </div>

      <StatsCards />
      <ExpiringRentals />

      <div className="grid gap-5 lg:grid-cols-2">
        <InquiryLineChart />
        <RecentInquiries />
      </div>
    </div>
  );
}
