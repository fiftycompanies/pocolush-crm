'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CalendarCheck, ShoppingBag, Bell, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import MembershipCard from '@/components/member/MembershipCard';
import { TIME_SLOTS, RESERVATION_STATUS, NOTICE_CATEGORIES } from '@/lib/member-constants';
import type { Member, Membership, Farm, BBQReservation, Notice } from '@/types';

export default function MemberHomePage() {
  const supabase = createClient();
  const [member, setMember] = useState<Member | null>(null);
  const [membership, setMembership] = useState<(Membership & { farm?: Farm }) | null>(null);
  const [nextReservation, setNextReservation] = useState<BBQReservation | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 회원 정보
      const { data: m } = await supabase
        .from('members')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (m) setMember(m);

      // 회원권 (active 우선, 없으면 expired도 표시)
      if (m) {
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

        // 다음 예약
        const today = new Date().toISOString().split('T')[0];
        const { data: res } = await supabase
          .from('bbq_reservations')
          .select('*')
          .eq('member_id', m.id)
          .eq('status', 'confirmed')
          .gte('reservation_date', today)
          .order('reservation_date', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (res) setNextReservation(res);
      }

      // 최근 공지 (고정 우선: pin_order ASC NULLS LAST → published_at DESC)
      const { data: n } = await supabase
        .from('notices')
        .select('*')
        .eq('is_published', true)
        .order('pin_order', { ascending: true, nullsFirst: false })
        .order('published_at', { ascending: false })
        .limit(2);
      if (n) setNotices(n);

      setLoading(false);
    }
    load();
  }, [supabase]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-sm text-text-secondary">불러오는 중...</p></div>;
  }

  const quickMenus = [
    { href: '/member/reservation', icon: CalendarCheck, label: '예약하기', color: '#3B82F6' },
    { href: '/member/store', icon: ShoppingBag, label: '스토어', color: '#D97706' },
    { href: '/member/notice', icon: Bell, label: '공지사항', color: '#8B5CF6' },
  ];

  return (
    <div className="space-y-5">
      {/* 회원권 카드 */}
      {membership && member ? (
        membership.status === 'active' ? (
          <Link href="/member/mypage">
            <MembershipCard membership={membership} memberName={member.name} />
            <p className="text-[12px] text-text-tertiary text-center mt-2">
              탭하여 회원권 전체보기 →
            </p>
          </Link>
        ) : (
          /* 만료/취소 멤버십 — 연장 유도 */
          <div className="relative overflow-hidden rounded-2xl border border-orange-200 bg-gradient-to-b from-orange-50 to-white">
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="size-8 rounded-full bg-orange-100 flex items-center justify-center">
                  <span className="text-orange-600 text-sm">!</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">회원권이 만료되었습니다</p>
                  <p className="text-[11px] text-text-tertiary">
                    {membership.membership_code} · {membership.end_date.replace(/-/g, '.')} 만료
                  </p>
                </div>
              </div>

              <div className="bg-white border border-orange-100 rounded-xl p-3.5 mb-3">
                <p className="text-xs font-semibold text-text-secondary mb-2">만료된 혜택</p>
                <div className="space-y-1">
                  {(membership.benefits as string[] || []).slice(0, 3).map((b, i) => (
                    <p key={i} className="text-[11px] text-text-tertiary line-through">{b}</p>
                  ))}
                  {(membership.benefits as string[] || []).length > 3 && (
                    <p className="text-[11px] text-text-tertiary">외 {(membership.benefits as string[]).length - 3}건</p>
                  )}
                </div>
              </div>

              <a href="tel:054-971-5274"
                className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors active:scale-[0.98]">
                연장 신청 문의하기
              </a>
              <p className="text-[10px] text-text-tertiary text-center mt-2">054-971-5274 (관리사무소)</p>
            </div>
          </div>
        )
      ) : (
        <div className="bg-white border border-border rounded-2xl p-5 text-center">
          <p className="text-sm text-text-secondary">회원권이 없습니다.</p>
          <p className="text-xs text-text-tertiary mt-1">관리자에게 문의해주세요.</p>
        </div>
      )}

      {/* 퀵 메뉴 */}
      <div className="grid grid-cols-3 gap-3">
        {quickMenus.map((menu) => {
          const Icon = menu.icon;
          return (
            <Link key={menu.href} href={menu.href}
              className="bg-white border border-border rounded-2xl p-4 flex flex-col items-center gap-2 hover:shadow-sm transition-shadow active:scale-[0.98]">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: menu.color + '10' }}>
                <Icon className="size-5" style={{ color: menu.color }} strokeWidth={1.8} />
              </div>
              <span className="text-[12px] font-medium text-text-primary">{menu.label}</span>
            </Link>
          );
        })}
      </div>

      {/* 다음 예약 */}
      <div className="bg-white border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">다음 예약</h3>
          <Link href="/member/reservation" className="text-[12px] text-text-tertiary hover:text-text-primary flex items-center gap-0.5">
            전체보기 <ChevronRight className="size-3" />
          </Link>
        </div>
        {nextReservation ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">바베큐장 {nextReservation.bbq_number}번</p>
              <p className="text-[12px] text-text-secondary mt-0.5">
                {nextReservation.reservation_date.replace(/-/g, '/')} · {TIME_SLOTS[nextReservation.time_slot]?.label} {TIME_SLOTS[nextReservation.time_slot]?.time}
              </p>
            </div>
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full"
              style={{
                color: RESERVATION_STATUS[nextReservation.status]?.color,
                backgroundColor: RESERVATION_STATUS[nextReservation.status]?.bg,
              }}>
              {RESERVATION_STATUS[nextReservation.status]?.label}
            </span>
          </div>
        ) : (
          <p className="text-[13px] text-text-tertiary">예정된 예약이 없습니다.</p>
        )}
      </div>

      {/* 공지사항 */}
      <div className="bg-white border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">공지사항</h3>
          <Link href="/member/notice" className="text-[12px] text-text-tertiary hover:text-text-primary flex items-center gap-0.5">
            더보기 <ChevronRight className="size-3" />
          </Link>
        </div>
        {notices.length > 0 ? (
          <div className="space-y-2.5">
            {notices.map((notice) => (
              <Link key={notice.id} href={`/member/notice/${notice.id}`}
                className="flex items-center gap-2.5 group">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    color: NOTICE_CATEGORIES[notice.category]?.color,
                    backgroundColor: NOTICE_CATEGORIES[notice.category]?.bg,
                  }}>
                  {NOTICE_CATEGORIES[notice.category]?.label}
                </span>
                <span className="text-[13px] text-text-primary truncate group-hover:text-[#16A34A] transition-colors">
                  {notice.title}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-text-tertiary">공지사항이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
