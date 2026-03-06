'use client';

import StatsCards from '@/components/dashboard/StatsCards';
import InquiryLineChart from '@/components/dashboard/InquiryLineChart';
import RecentInquiries from '@/components/dashboard/RecentInquiries';
import ExpiringRentals from '@/components/dashboard/ExpiringRentals';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-bold text-text-primary">대시보드</h1>
        <p className="text-[14px] text-text-secondary mt-1">포코러쉬 문의 현황을 한눈에 확인하세요</p>
      </div>

      <StatsCards />
      <ExpiringRentals />
      <InquiryLineChart />
      <RecentInquiries />
    </div>
  );
}
