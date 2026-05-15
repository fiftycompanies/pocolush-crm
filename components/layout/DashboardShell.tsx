'use client';

import { useState, useEffect, useCallback } from 'react';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

// U2: feature flag — 미설정 시 기존 동작(데스크탑/모바일 모두 사이드바 고정) 유지
// Vercel env 에서 `NEXT_PUBLIC_SIDEBAR_MOBILE_V2=1` 로 켜면 모바일에서 햄버거 토글 가능
const MOBILE_V2 = process.env.NEXT_PUBLIC_SIDEBAR_MOBILE_V2 === '1';

interface DashboardShellProps {
  isAdmin: boolean;
  unackedWarnings: number;
  children: React.ReactNode;
}

export default function DashboardShell({
  isAdmin,
  unackedWarnings,
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  // ESC 닫기 (V2 활성 시만)
  useEffect(() => {
    if (!MOBILE_V2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 모바일 사이드바 열렸을 때 body 스크롤 잠금
  useEffect(() => {
    if (!MOBILE_V2) return;
    if (sidebarOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [sidebarOpen]);

  // V2 OFF: 기존 레이아웃 (데스크탑 마진 16rem 고정)
  if (!MOBILE_V2) {
    return (
      <div className="flex min-h-screen">
        <Sidebar isAdmin={isAdmin} unackedWarnings={unackedWarnings} />
        <div className="flex-1 min-w-0" style={{ marginLeft: '16rem' }}>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/40 px-4 sticky top-0 z-20 bg-background">
            <TopBar />
          </header>
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    );
  }

  // V2 ON: 모바일 햄버거 + backdrop
  return (
    <div className="flex min-h-screen">
      <Sidebar
        isAdmin={isAdmin}
        unackedWarnings={unackedWarnings}
        mobileEnabled
        mobileOpen={sidebarOpen}
        onLinkClick={closeSidebar}
      />

      {/* Mobile backdrop — 사이드바 외부 클릭 시 닫기 */}
      {sidebarOpen ? (
        <div
          className="md:hidden fixed inset-0 z-20 bg-black/40 transition-opacity"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      ) : null}

      <div className="flex-1 min-w-0 md:ml-64">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/40 px-4 sticky top-0 z-20 bg-background">
          {/* 햄버거 — 모바일만 노출 (md 이상에선 숨김) */}
          <button
            type="button"
            onClick={toggleSidebar}
            className="md:hidden size-9 flex items-center justify-center rounded-md hover:bg-accent transition-all -ml-2"
            aria-label={sidebarOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={sidebarOpen}
            aria-controls="dashboard-sidebar"
          >
            {sidebarOpen ? (
              <X className="size-5" strokeWidth={1.8} />
            ) : (
              <Menu className="size-5" strokeWidth={1.8} />
            )}
          </button>
          <TopBar />
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
