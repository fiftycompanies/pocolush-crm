'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MessageSquare, Map, FileText, FileEdit, Settings, UserCheck, Flame, ShoppingBag, Ticket, Megaphone, Bell, CreditCard, ClipboardList, AlertTriangle, Award } from 'lucide-react';

interface SidebarProps {
  isAdmin?: boolean;
  unackedWarnings?: number;
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
  { href: '/dashboard/bbq', label: '바베큐 설정', icon: Flame },
  { href: '/dashboard/store', label: '스토어 설정', icon: ShoppingBag },
  { href: '/dashboard/plans', label: '플랜 관리', icon: CreditCard },
  { href: '/dashboard/coupons', label: '쿠폰 설정', icon: Ticket },
  { href: '/dashboard/notices', label: '공지 관리', icon: Megaphone },
];

const contentNav = [
  { href: '/dashboard/blog', label: '블로그 관리', icon: FileEdit },
];

const bottomNavBase = [
  { href: '/dashboard/notifications', label: '알림 설정', icon: Bell },
  { href: '/dashboard/settings', label: '설정', icon: Settings },
];

export default function Sidebar({ isAdmin = false, unackedWarnings = 0 }: SidebarProps) {
  const pathname = usePathname();

  const bottomNav = isAdmin
    ? [{ href: '/dashboard/warning', label: '경고', icon: AlertTriangle }, ...bottomNavBase]
    : bottomNavBase;

  const renderItem = (item: typeof mainNav[0]) => {
    const isActive =
      item.href === '/dashboard'
        ? pathname === '/dashboard'
        : pathname.startsWith(item.href);
    const Icon = item.icon;
    const isWarning = item.href === '/dashboard/warning';
    const showBadge = isWarning && unackedWarnings > 0;

    return (
      <Link
        key={item.href}
        href={item.href}
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

  return (
    <aside
      className="fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border flex flex-col z-30"
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
