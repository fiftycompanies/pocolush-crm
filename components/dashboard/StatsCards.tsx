'use client';

import Link from 'next/link';
import { Map, AlertCircle, MessageSquare, CalendarClock, Banknote } from 'lucide-react';
import { useDashboardStats } from '@/lib/use-data';

export default function StatsCards() {
  const { data: s, loading } = useDashboardStats();

  if (loading) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[...Array(5)].map((_, i) => <div key={i} className="h-28 bg-card border rounded-xl animate-pulse" />)}</div>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {/* 농장 임대율 */}
      <Link href="/dashboard/farms" className="bg-card border rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium text-muted-foreground">농장 임대율</p>
          <div className="size-8 rounded-lg bg-green/10 flex items-center justify-center"><Map className="size-4 text-green" /></div>
        </div>
        <p className="text-2xl font-bold tracking-tight mt-2">{s.rentedFarms}/{s.totalFarms}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-green rounded-full transition-all" style={{ width: `${s.rentalRate}%` }} />
          </div>
          <span className="text-xs font-bold text-green">{s.rentalRate}%</span>
        </div>
      </Link>

      {/* 미처리 문의 */}
      <Link href="/dashboard/inquiries?status=new" className="bg-card border rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium text-muted-foreground">미처리 문의</p>
          <div className="size-8 rounded-lg bg-blue/10 flex items-center justify-center"><MessageSquare className="size-4 text-blue" /></div>
        </div>
        <p className="text-2xl font-bold tracking-tight mt-2">{s.unprocessedInquiries}<span className="text-sm font-normal text-muted-foreground ml-1">건</span></p>
        <p className="text-[11px] text-muted-foreground mt-1">신규 문의 대기</p>
      </Link>

      {/* 미처리 관리 — 외부 Link 안에 Link 중첩 회피 (HTML invalid + hydration warning) */}
      <div className="bg-card border rounded-xl p-5 hover:shadow-md transition-shadow">
        <Link href="/dashboard/requests" className="block cursor-pointer">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-muted-foreground">미처리 관리</p>
            <div className="size-8 rounded-lg bg-orange/10 flex items-center justify-center"><AlertCircle className="size-4 text-orange-500" /></div>
          </div>
          <p className="text-2xl font-bold tracking-tight mt-2">{s.pendingTotal}<span className="text-sm font-normal text-muted-foreground ml-1">건</span></p>
        </Link>
        <div className="flex gap-2 mt-1 text-[11px]">
          {s.pendingBBQ > 0 && <Link href="/dashboard/requests?type=bbq&status=confirmed" className="text-red-600 hover:underline">BBQ {s.pendingBBQ}</Link>}
          {s.pendingOrders > 0 && <Link href="/dashboard/requests?type=order&status=pending" className="text-amber-600 hover:underline">스토어 {s.pendingOrders}</Link>}
          {s.pendingCoupons > 0 && <Link href="/dashboard/requests?type=coupon&status=pending" className="text-violet-600 hover:underline">쿠폰 {s.pendingCoupons}</Link>}
          {s.pendingTotal === 0 && <span className="text-muted-foreground">처리 완료</span>}
        </div>
      </div>

      {/* 임대 만료 임박 — D-7 / D-30 한 카드 2-값 (PR-C1, Q-C1=한카드2값) */}
      <Link href="/dashboard/rentals" className="bg-card border rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium text-muted-foreground">임대 만료 임박</p>
          <div className="size-8 rounded-lg bg-red/10 flex items-center justify-center"><CalendarClock className="size-4 text-red" /></div>
        </div>
        <div className="flex items-baseline gap-3 mt-2">
          <div>
            <p className="text-2xl font-bold tracking-tight text-red-600">{s.farmExpiringIn7}<span className="text-sm font-normal text-muted-foreground ml-1">건</span></p>
            <p className="text-[11px] text-red-600/80 mt-0.5">D-7</p>
          </div>
          <div className="opacity-60">
            <p className="text-xl font-semibold tracking-tight text-amber-600">{s.farmExpiringIn30}<span className="text-xs font-normal text-muted-foreground ml-1">건</span></p>
            <p className="text-[11px] text-amber-600/80 mt-0.5">D-30</p>
          </div>
        </div>
      </Link>

      {/* 이달 매출 */}
      <Link href="/dashboard/rentals" className="bg-card border rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium text-muted-foreground">이달 매출</p>
          <div className="size-8 rounded-lg bg-violet/10 flex items-center justify-center"><Banknote className="size-4 text-violet-600" /></div>
        </div>
        <p className="text-2xl font-bold tracking-tight mt-2">{s.monthlyRevenue.toLocaleString()}<span className="text-sm font-normal text-muted-foreground ml-1">원</span></p>
        <p className="text-[11px] text-muted-foreground mt-1">납부완료 기준</p>
      </Link>
    </div>
  );
}
