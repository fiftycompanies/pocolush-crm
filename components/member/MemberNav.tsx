'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarCheck, ShoppingBag, Bell, User } from 'lucide-react';

const navItems = [
  { href: '/member', label: '홈', icon: Home, exact: true },
  { href: '/member/reservation', label: '예약', icon: CalendarCheck },
  { href: '/member/store', label: '스토어', icon: ShoppingBag },
  { href: '/member/notice', label: '공지', icon: Bell },
  { href: '/member/mypage', label: '마이', icon: User },
];

export default function MemberNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border safe-area-bottom">
      <div className="max-w-lg mx-auto flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 min-w-[56px] py-1 transition-colors ${
                isActive ? 'text-[#16A34A]' : 'text-text-tertiary'
              }`}
            >
              <Icon className="size-5" strokeWidth={isActive ? 2.2 : 1.5} />
              <span className={`text-[10px] ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
