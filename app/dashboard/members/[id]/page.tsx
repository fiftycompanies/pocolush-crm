'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText, ShoppingBag, Ticket, Flame, LayoutDashboard } from 'lucide-react';
import { useMemberDetail } from '@/lib/use-member-detail';
import MemberSidebar from '@/components/admin-members/MemberSidebar';
import MemberOverviewTab from '@/components/admin-members/MemberOverviewTab';
import MemberRentalsTab from '@/components/admin-members/MemberRentalsTab';
import MemberOrdersTab from '@/components/admin-members/MemberOrdersTab';
import MemberCouponsTab from '@/components/admin-members/MemberCouponsTab';
import MemberBBQTab from '@/components/admin-members/MemberBBQTab';

const TABS = [
  { key: 'overview', label: '개요', icon: LayoutDashboard },
  { key: 'rentals', label: '임대계약', icon: FileText },
  { key: 'orders', label: '스토어', icon: ShoppingBag },
  { key: 'coupons', label: '쿠폰', icon: Ticket },
  { key: 'bbq', label: 'BBQ', icon: Flame },
] as const;

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id as string;
  const [tab, setTab] = useState<string>('overview');

  const data = useMemberDetail(memberId);

  // 윈도우 포커스 복귀 시 데이터 새로고침 (다른 탭에서 상태 변경 후 돌아올 때)
  useEffect(() => {
    const handleFocus = () => data.refetch();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [data]);

  if (data.loading) {
    return <div className="py-20 text-center text-sm text-text-secondary">불러오는 중...</div>;
  }

  if (!data.member) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-text-tertiary">회원을 찾을 수 없습니다.</p>
        <button onClick={() => router.push('/dashboard/members')} className="mt-3 text-sm text-primary hover:underline">목록으로</button>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* 상단 헤더 */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.push('/dashboard/members')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight">{data.member.name} 님</h1>
      </div>

      {/* 2-Column: Sidebar + Main */}
      <div className="flex gap-6">
        {/* Left Sidebar (320px) */}
        <div className="w-80 shrink-0">
          <MemberSidebar data={data} />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* 탭 */}
          <div className="flex gap-1 border-b border-border mb-5">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium relative ${
                    tab === t.key ? 'text-primary' : 'text-text-tertiary hover:text-text-primary'
                  }`}>
                  <Icon className="size-3.5" />
                  {t.label}
                  {tab === t.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
                </button>
              );
            })}
          </div>

          {/* 탭 콘텐츠 */}
          {tab === 'overview' && <MemberOverviewTab data={data} />}
          {tab === 'rentals' && <MemberRentalsTab rentals={data.rentals} />}
          {tab === 'orders' && <MemberOrdersTab orders={data.orders} />}
          {tab === 'coupons' && <MemberCouponsTab coupons={data.coupons} />}
          {tab === 'bbq' && <MemberBBQTab reservations={data.reservations} />}
        </div>
      </div>
    </div>
  );
}
