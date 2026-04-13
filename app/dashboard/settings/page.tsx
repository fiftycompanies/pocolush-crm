'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
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
    toast.success(`${inviteEmail}로 초대 이메일을 발송합니다. (Supabase 대시보드에서 직접 추가해주세요)`);
    setInviteEmail('');
    setInviting(false);
  };

  if (loading) {
    return <div className="text-center py-20 text-text-tertiary">불러오는 중...</div>;
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return null;
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight">설정</h1>
        <p className="text-[14px] text-text-secondary mt-0.5">직원 관리 및 시스템 설정</p>
      </div>

      {/* Invite */}
      <Card>
        <h2 className="text-[14px] font-semibold text-text-primary mb-4">신규 직원 초대</h2>
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              type="email"
              placeholder="이메일 주소"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          <Button onClick={handleInvite} variant="primary" loading={inviting}>
            초대
          </Button>
        </div>
      </Card>

      {/* Staff list */}
      <div className="bg-white rounded-2xl shadow-xs border border-border/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-[14px] font-semibold text-text-primary">직원 목록</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-[12px] text-text-tertiary font-semibold uppercase tracking-wider">이름</th>
                <th className="text-left px-5 py-3 text-[12px] text-text-tertiary font-semibold uppercase tracking-wider">역할</th>
                <th className="text-left px-5 py-3 text-[12px] text-text-tertiary font-semibold uppercase tracking-wider">담당 문의수</th>
                <th className="text-left px-5 py-3 text-[12px] text-text-tertiary font-semibold uppercase tracking-wider">가입일</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-b border-border-light hover:bg-bg-hover transition-colors duration-150">
                  <td className="px-5 py-3.5 text-[14px] text-text-primary font-medium">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[13px] font-semibold">
                        {s.name.charAt(0)}
                      </div>
                      {s.name}
                      {s.id === currentUser.id && (
                        <span className="text-[11px] text-text-tertiary bg-bg-muted px-1.5 py-0.5 rounded">(나)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge
                      label={s.role === 'admin' ? '관리자' : '직원'}
                      color={s.role === 'admin' ? '#16A34A' : '#64748B'}
                      bg={s.role === 'admin' ? '#DCFCE7' : '#F1F5F9'}
                    />
                  </td>
                  <td className="px-5 py-3.5 text-[14px] text-primary font-semibold">
                    {inquiryCounts[s.id] || 0}
                  </td>
                  <td className="px-5 py-3.5 text-[14px] text-text-tertiary">
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
