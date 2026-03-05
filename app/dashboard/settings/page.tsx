'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import type { Profile } from '@/types';

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [inquiryCounts, setInquiryCounts] = useState<Record<string, number>>({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setCurrentUser(profile);
        // Redirect if not admin
        if (profile.role !== 'admin') {
          toast.error('관리자 권한이 필요합니다');
          router.push('/dashboard');
          return;
        }
      }

      const { data: allStaff } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });
      if (allStaff) {
        setStaff(allStaff);

        // Fetch inquiry counts per assignee
        const counts: Record<string, number> = {};
        for (const s of allStaff) {
          const { count } = await supabase
            .from('inquiries')
            .select('id', { count: 'exact', head: true })
            .eq('assignee_id', s.id);
          counts[s.id] = count ?? 0;
        }
        setInquiryCounts(counts);
      }

      setLoading(false);
    };
    fetchData();
  }, [supabase, router]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);

    // Note: Invite requires admin/service role key in production
    // This is a client-side placeholder
    toast.success(`${inviteEmail}로 초대 이메일을 발송합니다. (Supabase 대시보드에서 직접 추가해주세요)`);
    setInviteEmail('');
    setInviting(false);
  };

  if (loading) {
    return <div className="text-center py-20 text-text-muted">불러오는 중...</div>;
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return null;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">설정</h1>
        <p className="text-sm text-text-muted mt-1">직원 관리 및 시스템 설정</p>
      </div>

      {/* Invite */}
      <div className="bg-bg-card border border-border rounded-xl p-6">
        <h2 className="text-sm font-medium text-text-secondary mb-4">신규 직원 초대</h2>
        <div className="flex gap-3">
          <input
            type="email"
            placeholder="이메일 주소"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold/50 transition-colors"
          />
          <Button onClick={handleInvite} variant="gold" disabled={inviting}>
            {inviting ? '발송 중...' : '초대'}
          </Button>
        </div>
      </div>

      {/* Staff list */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-medium text-text-secondary">직원 목록</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">이름</th>
                <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">역할</th>
                <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">담당 문의수</th>
                <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">가입일</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-bg-hover transition-colors">
                  <td className="px-6 py-3 text-sm text-text-primary font-medium">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold text-sm font-medium">
                        {s.name.charAt(0)}
                      </div>
                      {s.name}
                      {s.id === currentUser.id && (
                        <span className="text-xs text-text-muted">(나)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <Badge
                      label={s.role === 'admin' ? '관리자' : '직원'}
                      color={s.role === 'admin' ? '#E8A045' : '#6B7280'}
                    />
                  </td>
                  <td className="px-6 py-3 text-sm text-gold font-medium">
                    {inquiryCounts[s.id] || 0}
                  </td>
                  <td className="px-6 py-3 text-sm text-text-muted">
                    {new Date(s.created_at).toLocaleDateString('ko-KR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
