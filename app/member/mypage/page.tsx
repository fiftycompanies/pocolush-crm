'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Edit3, Ticket, LogOut, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import MembershipCard from '@/components/member/MembershipCard';
import { DEFAULT_BENEFITS } from '@/lib/member-constants';
import type { Member, Membership, Farm } from '@/types';

export default function MyPage() {
  const router = useRouter();
  const supabase = createClient();
  const [member, setMember] = useState<Member | null>(null);
  const [membership, setMembership] = useState<(Membership & { farm?: Farm }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: m } = await supabase.from('members').select('*').eq('user_id', user.id).maybeSingle();
      if (m) {
        setMember(m);
        // active 우선, 없으면 expired
        const { data: activeMs } = await supabase
          .from('memberships')
          .select('*, farm:farms(*, zone:farm_zones(name))')
          .eq('member_id', m.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (activeMs) {
          setMembership(activeMs);
        } else {
          const { data: latestMs } = await supabase
            .from('memberships')
            .select('*, farm:farms(*, zone:farm_zones(name))')
            .eq('member_id', m.id)
            .in('status', ['expired', 'cancelled'])
            .order('end_date', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (latestMs) setMembership(latestMs);
        }
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/m/login');
    router.refresh();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-sm text-text-secondary">불러오는 중...</p></div>;
  }

  const benefits = (membership?.benefits as string[])?.length > 0
    ? membership!.benefits as string[]
    : DEFAULT_BENEFITS;

  const menus = [
    { href: '/member/mypage/edit', icon: Edit3, label: '회원정보 수정' },
    { href: '/member/store/coupons', icon: Ticket, label: '내 쿠폰함' },
    { href: '/member/mypage/withdraw', icon: AlertTriangle, label: '회원탈퇴 신청', danger: true },
  ];

  return (
    <div className="space-y-5">
      {/* 회원권 카드 */}
      {membership && member && (
        <MembershipCard membership={membership} memberName={member.name} />
      )}

      {/* 회원 혜택 */}
      <div className="bg-white border border-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">회원 혜택</h3>
        <div className="space-y-2.5">
          {benefits.map((benefit, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="text-[#16A34A] text-sm mt-0.5">✓</span>
              <span className="text-[13px] text-text-secondary leading-relaxed">{benefit}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 메뉴 */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        {menus.map((menu, i) => {
          const Icon = menu.icon;
          return (
            <Link key={menu.href} href={menu.href}
              className={`flex items-center justify-between px-5 py-4 hover:bg-bg-hover transition-colors ${
                i > 0 ? 'border-t border-border' : ''
              }`}>
              <div className="flex items-center gap-3">
                <Icon className={`size-4 ${menu.danger ? 'text-red' : 'text-text-secondary'}`} strokeWidth={1.8} />
                <span className={`text-sm ${menu.danger ? 'text-red' : 'text-text-primary'}`}>{menu.label}</span>
              </div>
              <ChevronRight className="size-4 text-text-tertiary" />
            </Link>
          );
        })}
      </div>

      {/* 로그아웃 */}
      <button onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3 text-text-secondary text-sm hover:text-text-primary transition-colors">
        <LogOut className="size-4" strokeWidth={1.8} />
        로그아웃
      </button>
    </div>
  );
}
