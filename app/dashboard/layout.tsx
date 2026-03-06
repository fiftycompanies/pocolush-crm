import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';

export const dynamic = 'force-dynamic';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-bg-page">
      <Sidebar />
      <div className="flex-1 ml-[220px]">
        <TopBar />
        <div className="p-8">{children}</div>
      </div>
    </div>
  );
}
