'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard', label: '대시보드', icon: '📊' },
  { href: '/dashboard/inquiries', label: '문의 관리', icon: '📋' },
  { href: '/dashboard/customers', label: '고객 관리', icon: '👤' },
  { href: '/dashboard/settings', label: '설정', icon: '⚙️' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-bg-sidebar border-r border-border flex flex-col z-30">
      {/* Logo */}
      <div className="px-6 h-16 flex items-center border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="font-bold text-lg text-text-primary tracking-tight">
            POCO
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-gold" />
          <span className="font-bold text-lg text-text-primary tracking-tight">
            CRM
          </span>
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? 'bg-gold/10 text-gold'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border">
        <p className="text-xs text-text-muted">POCOLUSH CRM v1.0</p>
      </div>
    </aside>
  );
}
