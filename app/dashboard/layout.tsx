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
      <div className="flex-1 ml-60">
        <TopBar />
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
