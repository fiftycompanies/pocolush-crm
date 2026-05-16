'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, MessageSquare, Map, FileText, FileEdit, Settings,
  UserCheck, ShoppingBag, Ticket, Megaphone, Bell, CreditCard,
  ClipboardList, AlertTriangle, Award, ClipboardCheck, LayoutGrid,
  Settings2, Grid3x3,
} from 'lucide-react';

// U2-IA: feature flag — 미설정 시 기존 단일 그룹(legacy) 동작 유지
// Vercel env `NEXT_PUBLIC_SIDEBAR_IA_V2=1` 일 때 6그룹 V2 활성
// trim() — vercel env add 가 stdin 줄바꿈 보존 시("1\n") 방어
const IA_V2 = process.env.NEXT_PUBLIC_SIDEBAR_IA_V2?.trim() === '1';

interface SidebarProps {
  isAdmin?: boolean;
  unackedWarnings?: number;
  /**
   * U2: 모바일 V2 모드 활성 여부. true 면 `mobileOpen` 기반으로 translate 토글.
   * false (기본) 면 기존 데스크탑 고정 사이드바 동작 유지.
   */
  mobileEnabled?: boolean;
  /** mobileEnabled=true 일 때만 의미. 모바일 열림 상태 */
  mobileOpen?: boolean;
  /** Link 클릭 시 호출 (모바일 자동 닫기) */
  onLinkClick?: () => void;
}

type NavItem = {
  href: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
};

// ───────────────────────────────────────────────────────────────
// Legacy (V1) — 기존 동작 보존 (flag OFF 시 사용)
// ───────────────────────────────────────────────────────────────
const legacyMainNav: NavItem[] = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/dashboard/inquiries', label: '문의 관리', icon: MessageSquare },
  { href: '/dashboard/farms', label: '농장 관리', icon: Map },
  { href: '/dashboard/rentals', label: '임대 계약', icon: FileText },
];

const legacyMemberNav: NavItem[] = [
  { href: '/dashboard/members', label: '회원 관리', icon: UserCheck },
  { href: '/dashboard/memberships', label: '회원권 관리', icon: Award },
  { href: '/dashboard/requests', label: '신청 관리', icon: ClipboardList },
  { href: '/dashboard/bbq-board', label: '평상 현황', icon: LayoutGrid },
  { href: '/dashboard/bbq', label: '평상 설정', icon: Settings2 },
  // 평상 메뉴 (bbq-products) 는 2026-05-16 평상 설정 §3 섹션으로 통합 (redirect 유지)
  { href: '/dashboard/store', label: '스토어 설정', icon: ShoppingBag },
  { href: '/dashboard/plans', label: '플랜 관리', icon: CreditCard },
  { href: '/dashboard/coupons', label: '쿠폰 설정', icon: Ticket },
  { href: '/dashboard/notices', label: '공지 관리', icon: Megaphone },
];

const legacyContentNav: NavItem[] = [
  { href: '/dashboard/blog', label: '블로그 관리', icon: FileEdit },
];

// ───────────────────────────────────────────────────────────────
// V2 — JTBD/빈도 기반 6 그룹 (안 A, kk Q1=A 결정)
// ───────────────────────────────────────────────────────────────
const dailyOpsNav: NavItem[] = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  // kk 2026-05-16: [일별 운영] 순서 변경 + "평상 현황" 라벨 단축
  { href: '/dashboard/farms-board', label: '농장 현황', icon: Grid3x3 },
  { href: '/dashboard/bbq-board', label: '평상 현황', icon: LayoutGrid },
  { href: '/dashboard/requests', label: '신청 관리', icon: ClipboardList },
  { href: '/dashboard/inquiries', label: '문의 관리', icon: MessageSquare },
];

const memberNav: NavItem[] = [
  { href: '/dashboard/members', label: '회원 관리', icon: UserCheck },
  { href: '/dashboard/memberships', label: '회원권 관리', icon: Award },
  { href: '/dashboard/notices', label: '공지 관리', icon: Megaphone },
];

const assetNav: NavItem[] = [
  { href: '/dashboard/farms', label: '농장 관리', icon: Map },
  { href: '/dashboard/rentals', label: '임대 계약', icon: FileText },
  // 평상 메뉴(bbq-products) 는 평상 설정 §3 섹션으로 통합 (2026-05-16)
  { href: '/dashboard/bbq', label: '평상 설정', icon: Settings2 },
];

const commerceNav: NavItem[] = [
  { href: '/dashboard/store', label: '스토어 설정', icon: ShoppingBag },
  { href: '/dashboard/plans', label: '플랜 관리', icon: CreditCard },
  { href: '/dashboard/coupons', label: '쿠폰 설정', icon: Ticket },
];

const contentNav: NavItem[] = [
  { href: '/dashboard/blog', label: '블로그 관리', icon: FileEdit },
];

// ───────────────────────────────────────────────────────────────
// 공통 (하단 영역)
// ───────────────────────────────────────────────────────────────
const bottomNavBase: NavItem[] = [
  { href: '/dashboard/audit-logs', label: '감사 로그', icon: ClipboardCheck },
  { href: '/dashboard/notifications', label: '알림 설정', icon: Bell },
  { href: '/dashboard/settings', label: '설정', icon: Settings },
];

const warningNav: NavItem[] = [
  { href: '/dashboard/warning', label: '경고', icon: AlertTriangle },
];

// G1: ALL_NAV_HREFS — 새 메뉴 추가 시 단일 소스 갱신
// V1/V2 양쪽 hrefs 합집합 (active 매칭 prefix 충돌 회피)
const ALL_NAV_HREFS: string[] = Array.from(
  new Set(
    [
      ...legacyMainNav, ...legacyMemberNav, ...legacyContentNav,
      ...dailyOpsNav, ...memberNav, ...assetNav, ...commerceNav, ...contentNav,
      ...bottomNavBase, ...warningNav,
    ].map(i => i.href),
  ),
);

export default function Sidebar({
  isAdmin = false,
  unackedWarnings = 0,
  mobileEnabled = false,
  mobileOpen = false,
  onLinkClick,
}: SidebarProps) {
  const pathname = usePathname();

  const bottomNav = isAdmin
    ? [...warningNav, ...bottomNavBase]
    : bottomNavBase;

  const renderItem = (item: NavItem) => {
    // active 매칭 — 더 긴 prefix 우선 (e.g. `/dashboard/bbq` 가 `/dashboard/bbq-board` 매칭 안 함)
    let isActive: boolean;
    if (item.href === '/dashboard') {
      isActive = pathname === '/dashboard';
    } else if (pathname === item.href) {
      isActive = true;
    } else if (pathname.startsWith(item.href + '/')) {
      const moreSpecific = ALL_NAV_HREFS.some(
        h => h !== item.href && h.startsWith(item.href) && (pathname === h || pathname.startsWith(h + '/')),
      );
      isActive = !moreSpecific;
    } else {
      isActive = false;
    }
    const Icon = item.icon;
    const isWarning = item.href === '/dashboard/warning';
    const showBadge = isWarning && unackedWarnings > 0;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onLinkClick}
        className={`flex items-center gap-2 h-9 px-3 rounded-md text-sm font-medium transition-all ${
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
            : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
        }`}
      >
        <Icon className="size-4 shrink-0" strokeWidth={isActive ? 2 : 1.8} />
        <span className="flex-1">{item.label}</span>
        {showBadge && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red text-white text-[10px] font-semibold">
            {unackedWarnings > 99 ? '99+' : unackedWarnings}
          </span>
        )}
      </Link>
    );
  };

  // V2 그룹 헤더 — 12px text-xs + 위 24 (mt-6, 첫 그룹은 mt-0) + 아래 8 (mb-2)
  const renderGroup = (label: string, items: NavItem[], isFirst = false) => (
    <div className={isFirst ? '' : 'mt-6'}>
      <p className="px-3 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-2">
        {label}
      </p>
      <div className="flex flex-col gap-1">
        {items.map(renderItem)}
      </div>
    </div>
  );

  // U2 모바일 V2: enabled 일 때만 transform 토글
  const transformCls = mobileEnabled
    ? `transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`
    : '';

  return (
    <aside
      id="dashboard-sidebar"
      role="navigation"
      aria-label="주 메뉴"
      className={`fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border flex flex-col z-30 ${transformCls}`}
      style={{ width: '16rem' }}
    >
      {/* Logo */}
      <div className="h-14 px-4 flex items-center">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={onLinkClick}>
          <div className="size-8 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold tracking-tight">P</span>
          </div>
          <span className="font-semibold text-sm text-sidebar-foreground tracking-tight">
            POCOLUSH CRM
          </span>
        </Link>
      </div>

      {/* Separator */}
      <div className="mx-4 h-px bg-sidebar-border" />

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {IA_V2 ? (
          // V2 — 6 그룹 (kk Q1=A 결정)
          <>
            {renderGroup('일별 운영', dailyOpsNav, true)}
            {renderGroup('회원', memberNav)}
            {renderGroup('자원·시설', assetNav)}
            {renderGroup('상거래', commerceNav)}
            {renderGroup('콘텐츠', contentNav)}
          </>
        ) : (
          // V1 (legacy) — 기존 단일 그룹 + 콘텐츠
          <div className="flex flex-col gap-1">
            {legacyMainNav.map(renderItem)}

            <div className="mx-1 my-2 h-px bg-sidebar-border" />
            <p className="px-3 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-1">
              회원 서비스
            </p>
            {legacyMemberNav.map(renderItem)}

            <div className="mx-1 my-2 h-px bg-sidebar-border" />
            <p className="px-3 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-1">
              콘텐츠
            </p>
            {legacyContentNav.map(renderItem)}
          </div>
        )}
      </nav>

      {/* Bottom — 시스템 영역 */}
      <div className={`px-3 py-4 border-t border-sidebar-border flex flex-col gap-1 ${IA_V2 ? '' : ''}`}>
        {IA_V2 && (
          <p className="px-3 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-2">
            시스템
          </p>
        )}
        {bottomNav.map(renderItem)}
      </div>
    </aside>
  );
}
