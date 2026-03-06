'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MessageSquare, Users, Map, FileText, Settings } from 'lucide-react';

const mainNav = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/dashboard/inquiries', label: '문의 관리', icon: MessageSquare },
  { href: '/dashboard/customers', label: '고객 관리', icon: Users },
  { href: '/dashboard/farms', label: '농장 관리', icon: Map },
  { href: '/dashboard/rentals', label: '임대 계약', icon: FileText },
];

const bottomNav = [
  { href: '/dashboard/settings', label: '설정', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  const renderItem = (item: typeof mainNav[0]) => {
    const isActive =
      item.href === '/dashboard'
        ? pathname === '/dashboard'
        : pathname.startsWith(item.href);
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[14px] transition-all h-10 ${
          isActive
            ? 'bg-primary-light text-primary font-semibold'
            : 'text-[#374151] hover:bg-bg-hover'
        }`}
      >
        <Icon className="w-4 h-4" strokeWidth={isActive ? 2.5 : 2} />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-[220px] bg-white border-r border-border flex flex-col z-30">
      {/* Logo */}
      <div className="px-5 h-[60px] flex items-center">
        <Link href="/dashboard" className="flex items-center gap-1.5">
          <span className="font-bold text-[16px] text-text-primary tracking-tight">
            POCO
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="font-bold text-[16px] text-text-primary tracking-tight">
            CRM
          </span>
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {mainNav.map(renderItem)}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-border space-y-0.5">
        {bottomNav.map(renderItem)}
      </div>
    </aside>
  );
}
