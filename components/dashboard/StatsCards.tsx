'use client';

import { Map, AlertCircle, MessageSquare, CalendarClock, Banknote } from 'lucide-react';
import { useDashboardStats } from '@/lib/use-data';

export default function StatsCards() {
  const { data: s, loading } = useDashboardStats();

  if (loading) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><div className="h-28 bg-card border rounded-xl animate-pulse" /><div className="h-28 bg-card border rounded-xl animate-pulse" /><div className="h-28 bg-card border rounded-xl animate-pulse" /><div className="h-28 bg-card border rounded-xl animate-pulse" /><div className="h-28 bg-card border rounded-xl animate-pulse" /></div>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {/* 농장 임대율 */}
      <div className="bg-card border rounded-xl p-5">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium text-muted-foreground">농장 임대율</p>
          <div className="size-8 rounded-lg bg-green/10 flex items-center justify-center">
            <Map className="size-4 text-green" />
          </div>
        </div>
        <p className="text-2xl font-bold tracking-tight mt-2">{s.rentedFarms}/{s.totalFarms}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-green rounded-full transition-all" style={{ width: `${s.rentalRate}%` }} />
          </div>
          <span className="text-xs font-bold text-green">{s.rentalRate}%</span>
        </div>
      </div>

      {/* 미처리 문의 */}
      <div className="bg-card border rounded-xl p-5">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium text-muted-foreground">미처리 문의</p>
          <div className="size-8 rounded-lg bg-blue/10 flex items-center justify-center">
            <MessageSquare className="size-4 text-blue" />
          </div>
        </div>
        <p className="text-2xl font-bold tracking-tight mt-2">{s.unprocessedInquiries}<span className="text-sm font-normal text-muted-foreground ml-1">건</span></p>
        <p className="text-[11px] text-muted-foreground mt-1">신규 문의 대기</p>
      </div>

      {/* 미처리 관리 */}
      <div className="bg-card border rounded-xl p-5">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium text-muted-foreground">미처리 관리</p>
          <div className="size-8 rounded-lg bg-orange/10 flex items-center justify-center">
            <AlertCircle className="size-4 text-orange-500" />
          </div>
        </div>
        <p className="text-2xl font-bold tracking-tight mt-2">{s.pendingTotal}<span className="text-sm font-normal text-muted-foreground ml-1">건</span></p>
        <div className="flex gap-2 mt-1 text-[11px] text-muted-foreground">
          {s.pendingBBQ > 0 && <span>BBQ {s.pendingBBQ}</span>}
          {s.pendingOrders > 0 && <span>스토어 {s.pendingOrders}</span>}
          {s.pendingCoupons > 0 && <span>쿠폰 {s.pendingCoupons}</span>}
          {s.pendingTotal === 0 && <span>처리 완료</span>}
        </div>
      </div>

      {/* 이달 만료 */}
      <div className="bg-card border rounded-xl p-5">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium text-muted-foreground">이달 만료</p>
          <div className="size-8 rounded-lg bg-red/10 flex items-center justify-center">
            <CalendarClock className="size-4 text-red" />
          </div>
        </div>
        <p className="text-2xl font-bold tracking-tight mt-2">{s.expiringThisMonth}<span className="text-sm font-normal text-muted-foreground ml-1">건</span></p>
        <p className="text-[11px] text-muted-foreground mt-1">임대 계약 만료 예정</p>
      </div>

      {/* 이달 매출 */}
      <div className="bg-card border rounded-xl p-5">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium text-muted-foreground">이달 매출</p>
          <div className="size-8 rounded-lg bg-violet/10 flex items-center justify-center">
            <Banknote className="size-4 text-violet-600" />
          </div>
        </div>
        <p className="text-2xl font-bold tracking-tight mt-2">{s.monthlyRevenue.toLocaleString()}<span className="text-sm font-normal text-muted-foreground ml-1">원</span></p>
        <p className="text-[11px] text-muted-foreground mt-1">납부완료 기준</p>
      </div>
    </div>
  );
}
