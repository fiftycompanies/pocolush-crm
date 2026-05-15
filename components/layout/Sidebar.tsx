'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MessageSquare, Map, FileText, FileEdit, Settings, UserCheck, ShoppingBag, Ticket, Megaphone, Bell, CreditCard, ClipboardList, AlertTriangle, Award, ClipboardCheck, LayoutGrid, Settings2, Package } from 'lucide-react';

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

const mainNav = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/dashboard/inquiries', label: '문의 관리', icon: MessageSquare },
  { href: '/dashboard/farms', label: '농장 관리', icon: Map },
  { href: '/dashboard/rentals', label: '임대 계약', icon: FileText },
];

const memberNav = [
  { href: '/dashboard/members', label: '회원 관리', icon: UserCheck },
  { href: '/dashboard/memberships', label: '회원권 관리', icon: Award },
  { href: '/dashboard/requests', label: '신청 관리', icon: ClipboardList },
  { href: '/dashboard/bbq-board', label: '평상 예약 현황', icon: LayoutGrid },
  { href: '/dashboard/bbq', label: '평상 시설·운영시간', icon: Settings2 },
  { href: '/dashboard/bbq-products', label: '평상 메뉴·이벤트', icon: Package },
  { href: '/dashboard/store', label: '스토어 설정', icon: ShoppingBag },
  { href: '/dashboard/plans', label: '플랜 관리', icon: CreditCard },
  { href: '/dashboard/coupons', label: '쿠폰 설정', icon: Ticket },
  { href: '/dashboard/notices', label: '공지 관리', icon: Megaphone },
];

const contentNav = [
  { href: '/dashboard/blog', label: '블로그 관리', icon: FileEdit },
];

const bottomNavBase = [
  { href: '/dashboard/audit-logs', label: '감사 로그', icon: ClipboardCheck },
  { href: '/dashboard/notifications', label: '알림 설정', icon: Bell },
  { href: '/dashboard/settings', label: '설정', icon: Settings },
];

const warningNav = [
  { href: '/dashboard/warning', label: '경고', icon: AlertTriangle },
];

// G1: ALL_NAV_HREFS 자동 생성 — 새 메뉴 추가 시 단일 소스 (mainNav 등) 만 갱신
const ALL_NAV_HREFS: string[] = [
  ...mainNav, ...memberNav, ...contentNav, ...bottomNavBase, ...warningNav,
].map(i => i.href);

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

  const renderItem = (item: typeof mainNav[0]) => {
    // active 매칭 — 더 긴 prefix 우선 (e.g. `/dashboard/bbq` 가 `/dashboard/bbq-board` 매칭 안 함)
    let isActive: boolean;
    if (item.href === '/dashboard') {
      isActive = pathname === '/dashboard';
    } else if (pathname === item.href) {
      isActive = true;
    } else if (pathname.startsWith(item.href + '/')) {
      // 다른 메뉴 href 중 현 pathname 을 더 정확히 매칭하는 게 있으면 양보
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

  // U2 모바일 V2: enabled 일 때만 transform 토글, off 면 기존 고정 동작
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
        <Link href="/dashboard" className="flex items-center gap-2">
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
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
        {mainNav.map(renderItem)}

        <div className="mx-1 my-2 h-px bg-sidebar-border" />
        <p className="px-3 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-1">회원 서비스</p>
        {memberNav.map(renderItem)}

        <div className="mx-1 my-2 h-px bg-sidebar-border" />
        <p className="px-3 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-1">콘텐츠</p>
        {contentNav.map(renderItem)}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-sidebar-border flex flex-col gap-1">
        {bottomNav.map(renderItem)}
      </div>
    </aside>
  );
}
