import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MembershipsPageClient from '@/components/admin-memberships/MembershipsPageClient';

export const dynamic = 'force-dynamic';

export default async function MembershipsPage({
  searchParams,
}: {
  searchParams: Promise<{ member_id?: string; expiring?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') redirect('/dashboard');

  const sp = await searchParams;

  return (
    <MembershipsPageClient
      initialMemberId={sp.member_id}
      initialExpiring={sp.expiring === '30'}
    />
  );
}
