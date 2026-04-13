import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';

export const dynamic = 'force-dynamic';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0" style={{ marginLeft: '16rem' }}>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/40 px-4 sticky top-0 z-20 bg-background">
          <TopBar />
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
