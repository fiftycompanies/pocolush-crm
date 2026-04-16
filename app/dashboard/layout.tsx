import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isAdmin = false;
  let unackedWarnings = 0;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    isAdmin = profile?.role === 'admin';
    if (isAdmin) {
      const { data: count } = await supabase.rpc('get_unacked_error_count');
      unackedWarnings = (count as number) ?? 0;
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar isAdmin={isAdmin} unackedWarnings={unackedWarnings} />
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
