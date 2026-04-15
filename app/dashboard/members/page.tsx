'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Search, CheckCircle, Clock, XCircle, FileText, Plus, ChevronDown } from 'lucide-react';
import { MEMBER_STATUS } from '@/lib/member-constants';
import toast from 'react-hot-toast';
import type { Member, MemberStatus } from '@/types';
import ExportButton from '@/components/ui/ExportButton';
import AddMemberModal from '@/components/admin-members/AddMemberModal';
import StatusChangeModal from '@/components/admin-members/StatusChangeModal';

const TABS = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '승인 대기' },
  { key: 'approved', label: '승인' },
  { key: 'suspended', label: '정지' },
  { key: 'withdrawn', label: '탈퇴' },
] as const;

function getAvailableTransitions(current: MemberStatus): MemberStatus[] {
  switch (current) {
    case 'pending':    return ['approved'];
    case 'approved':   return ['suspended', 'withdrawn'];
    case 'suspended':  return ['approved', 'withdrawn'];
    case 'withdrawn':  return [];
    default:           return [];
  }
}

export default function MembersPage() {
  const supabase = createClient();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [statusModal, setStatusModal] = useState<{ member: Member; newStatus: MemberStatus } | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('members').select('*').order('created_at', { ascending: false });
    if (tab !== 'all') query = query.eq('status', tab);
    const { data } = await query;
    setMembers(data || []);
    setLoading(false);
  }, [supabase, tab]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const filtered = members.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.phone.includes(q) || m.email.toLowerCase().includes(q);
  });

  const handleApprove = async (member: Member, goToRental: boolean = false) => {
    const { data: { user: adminUser } } = await supabase.auth.getUser();
    const { error } = await supabase.from('members').update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: adminUser?.id || null,
    }).eq('id', member.id);

    if (error) { toast.error('승인에 실패했습니다.'); return; }

    if (member.phone) {
      await supabase.from('customers').upsert(
        { name: member.name, phone: member.phone },
        { onConflict: 'phone' }
      );
    }

    toast.success(`${member.name}님이 승인되었습니다.`);

    if (goToRental) {
      const { data: customer } = await supabase.from('customers').select('id').eq('phone', member.phone).maybeSingle();
      if (customer) { router.push(`/dashboard/rentals/new?customerId=${customer.id}`); return; }
    }
    fetchMembers();
  };

  const handleCreateRental = async (member: Member) => {
    const { data: customer } = await supabase.from('customers').select('id').eq('phone', member.phone).maybeSingle();
    if (!customer) {
      const { data: newCust, error } = await supabase.from('customers').insert({ name: member.name, phone: member.phone }).select().single();
      if (error || !newCust) { toast.error('고객 레코드 생성 실패'); return; }
      router.push(`/dashboard/rentals/new?customerId=${newCust.id}`);
    } else {
      router.push(`/dashboard/rentals/new?customerId=${customer.id}`);
    }
  };

  const openStatusChange = (member: Member, newStatus: MemberStatus) => {
    setStatusModal({ member, newStatus });
  };

  const pendingCount = members.filter(m => m.status === 'pending').length;

  return (
    <div className="space-y-5" style={{ maxWidth: '1200px' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">회원 관리</h1>
          <p className="text-sm text-text-secondary mt-1">전체 {members.length}명{pendingCount > 0 && ` · 승인 대기 ${pendingCount}명`}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton target="members" params={{ status: tab === 'all' ? '' : tab, search }} dateField="created_at" />
          <button onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary-dark">
            <Plus className="size-4" /> 회원 추가
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              tab === t.key ? 'text-primary' : 'text-text-tertiary hover:text-text-primary'
            }`}>
            {t.label}
            {t.key === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 bg-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
            {tab === t.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-tertiary" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="이름 / 연락처 / 이메일 검색..."
          className="w-full pl-10 pr-4 h-10 border border-border rounded-xl text-sm placeholder-text-tertiary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
      </div>

      {loading ? (
        <p className="text-center text-sm text-text-secondary py-10">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-text-tertiary py-10">해당하는 회원이 없습니다.</p>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-text-secondary">이름</th>
                <th className="px-4 py-3 font-medium text-text-secondary">연락처</th>
                <th className="px-4 py-3 font-medium text-text-secondary">이메일</th>
                <th className="px-4 py-3 font-medium text-text-secondary">상태</th>
                <th className="px-4 py-3 font-medium text-text-secondary">가입일</th>
                <th className="px-4 py-3 font-medium text-text-secondary">액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(member => {
                const status = MEMBER_STATUS[member.status];
                const transitions = getAvailableTransitions(member.status);
                return (
                  <tr key={member.id} className="border-b border-border last:border-0 hover:bg-accent/30 cursor-pointer"
                    onClick={() => router.push(`/dashboard/members/${member.id}`)}>
                    <td className="px-4 py-3 font-medium text-text-primary">{member.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{member.phone}</td>
                    <td className="px-4 py-3 text-text-secondary">{member.email}</td>
                    <td className="px-4 py-3">
                      {transitions.length > 0 ? (
                        <div className="relative inline-block" onClick={e => e.stopPropagation()}>
                          <select
                            value={member.status}
                            onChange={e => openStatusChange(member, e.target.value as MemberStatus)}
                            className="text-[11px] font-medium pl-2 pr-5 py-0.5 rounded-full appearance-none cursor-pointer border-0 focus:outline-none focus:ring-1 focus:ring-primary"
                            style={{ color: status.color, backgroundColor: status.bg }}>
                            <option value={member.status}>{status.label}</option>
                            {transitions.map(s => (
                              <option key={s} value={s}>{MEMBER_STATUS[s].label}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 size-2.5 pointer-events-none" style={{ color: status.color }} />
                        </div>
                      ) : (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{ color: status.color, backgroundColor: status.bg }}>
                          {status.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {new Date(member.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {member.status === 'pending' && (
                          <>
                            <button onClick={() => handleApprove(member)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-light text-green hover:bg-green/10">
                              <CheckCircle className="size-3.5" /> 승인
                            </button>
                            <button onClick={() => handleApprove(member, true)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-light text-blue hover:bg-blue/10"
                              title="승인 후 임대계약 바로 등록">
                              <FileText className="size-3.5" /> 승인+계약
                            </button>
                          </>
                        )}
                        {member.status === 'approved' && (
                          <button onClick={() => handleCreateRental(member)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-light text-blue hover:bg-blue/10">
                            <FileText className="size-3.5" /> 임대계약
                          </button>
                        )}
                        {member.withdrawal_requested_at && member.status !== 'withdrawn' && (
                          <span className="flex items-center gap-1 text-[10px] text-red">
                            <Clock className="size-3" /> 탈퇴 요청
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddMemberModal open={addModalOpen} onClose={() => setAddModalOpen(false)} onSuccess={fetchMembers} />
      <StatusChangeModal
        open={!!statusModal}
        member={statusModal?.member || null}
        newStatus={statusModal?.newStatus || null}
        onClose={() => setStatusModal(null)}
        onSuccess={fetchMembers}
      />
    </div>
  );
}
