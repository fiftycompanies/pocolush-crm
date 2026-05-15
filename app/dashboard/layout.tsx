import type { Metadata } from 'next';
import DashboardShell from '@/components/layout/DashboardShell';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'POCOLUSH CRM',
  description: '포코러쉬 운영 관리 시스템',
  robots: { index: false, follow: false },
};

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
    <DashboardShell isAdmin={isAdmin} unackedWarnings={unackedWarnings}>
      {children}
    </DashboardShell>
  );
}
