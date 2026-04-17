'use client';

import Link from 'next/link';
import { FileText, ShoppingBag, Ticket, Flame, UserCheck, CreditCard, ExternalLink } from 'lucide-react';
import type { useMemberDetail } from '@/lib/use-member-detail';

const ACTIVITY_ICONS: Record<string, { icon: typeof FileText; color: string }> = {
  rental: { icon: FileText, color: '#3B82F6' },
  order: { icon: ShoppingBag, color: '#D97706' },
  coupon: { icon: Ticket, color: '#8B5CF6' },
  bbq: { icon: Flame, color: '#DC2626' },
  status: { icon: UserCheck, color: '#059669' },
  membership: { icon: CreditCard, color: '#0891B2' },
};

interface Props {
  data: ReturnType<typeof useMemberDetail>;
}

export default function MemberOverviewTab({ data }: Props) {
  const { rentals, orders, coupons, reservations, activities, membership, member } = data;
  const planName = (membership as { plan_name?: string } | null)?.plan_name || null;

  const activeRentals = rentals.filter(r => r.status === 'active').length;
  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'processing').length;
  const completedOrders = orders.filter(o => o.status === 'completed').length;
  const issuedCoupons = coupons.filter(c => c.status === 'issued').length;
  const usedCoupons = coupons.filter(c => c.status === 'used').length;

  const membershipLabel = membership
    ? membership.status === 'active' ? '활성'
    : membership.status === 'cancelled' ? '정지'
    : '만료'
    : '미발급';
  const membershipSub = membership
    ? `${membership.membership_code}${planName ? ` · ${planName}` : ''}`
    : '계약 후 자동 발급';
  const membershipColor = !membership
    ? '#6B7280'
    : membership.status === 'active' ? '#0891B2'
    : membership.status === 'cancelled' ? '#DC2626'
    : '#6B7280';

  const metrics = [
    { label: '회원권', value: membershipLabel, sub: membershipSub, color: membershipColor, bg: '#F0FDFF' },
    { label: '임대계약', value: `${activeRentals}건 활성`, sub: `총 ${rentals.length}건`, color: '#3B82F6', bg: '#EFF6FF' },
    { label: '서비스 신청', value: `${pendingOrders}건 진행`, sub: `${completedOrders}건 완료`, color: '#D97706', bg: '#FFFBEB' },
    { label: '쿠폰', value: `${issuedCoupons}장 보유`, sub: `${usedCoupons}장 사용`, color: '#8B5CF6', bg: '#F5F3FF' },
  ];

  return (
    <div className="space-y-5">
      {/* 메트릭 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map(m => {
          const isMembershipCard = m.label === '회원권' && member;
          return (
            <div key={m.label} className="bg-card border rounded-xl p-4 flex flex-col">
              <p className="text-xs text-text-tertiary mb-1">{m.label}</p>
              <p className="text-lg font-bold" style={{ color: m.color }}>{m.value}</p>
              <p className="text-[11px] text-text-tertiary mt-0.5">{m.sub}</p>
              {isMembershipCard && (
                <Link
                  href={`/dashboard/memberships?member_id=${member.id}`}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  회원권 관리 <ExternalLink className="size-3" />
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* 최근 활동 타임라인 */}
      <div className="bg-card border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">최근 활동</h3>
        {activities.length === 0 ? (
          <p className="text-xs text-text-tertiary text-center py-4">활동 내역이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {activities.slice(0, 15).map(act => {
              const config = ACTIVITY_ICONS[act.type] || ACTIVITY_ICONS.status;
              const Icon = config.icon;
              return (
                <div key={act.id + act.type} className="flex items-start gap-3">
                  <div className="size-7 rounded-full shrink-0 flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: config.color + '15' }}>
                    <Icon className="size-3.5" style={{ color: config.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-text-primary">{act.title}</p>
                      <p className="text-[10px] text-text-tertiary shrink-0 ml-2">
                        {new Date(act.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                      </p>
                    </div>
                    <p className="text-[11px] text-text-secondary mt-0.5">{act.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
