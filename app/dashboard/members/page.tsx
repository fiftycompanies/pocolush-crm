'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Search, CheckCircle, Clock, XCircle, FileText } from 'lucide-react';
import { MEMBER_STATUS } from '@/lib/member-constants';
import toast from 'react-hot-toast';
import type { Member } from '@/types';
import ExportButton from '@/components/ui/ExportButton';

const TABS = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '승인 대기' },
  { key: 'approved', label: '승인' },
  { key: 'suspended', label: '정지' },
  { key: 'withdrawn', label: '탈퇴' },
] as const;

export default function MembersPage() {
  const supabase = createClient();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

    if (error) {
      toast.error('승인에 실패했습니다.');
      return;
    }

    // customers 테이블에 upsert (phone 기준, 임대 계약 연동)
    if (member.phone) {
      await supabase.from('customers').upsert(
        { name: member.name, phone: member.phone },
        { onConflict: 'phone' }
      );
    }

    toast.success(`${member.name}님이 승인되었습니다.`);

    if (goToRental) {
      // 해당 회원의 customer_id 조회 후 임대계약 페이지로 이동
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', member.phone)
        .maybeSingle();
      if (customer) {
        router.push(`/dashboard/rentals/new?customerId=${customer.id}`);
        return;
      }
    }
    fetchMembers();
  };

  const handleCreateRental = async (member: Member) => {
    // 승인된 회원의 customer_id 조회
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', member.phone)
      .maybeSingle();

    if (!customer) {
      // customer 레코드가 없으면 생성
      const { data: newCust, error } = await supabase
        .from('customers')
        .insert({ name: member.name, phone: member.phone })
        .select()
        .single();
      if (error || !newCust) {
        toast.error('고객 레코드 생성 실패');
        return;
      }
      router.push(`/dashboard/rentals/new?customerId=${newCust.id}`);
    } else {
      router.push(`/dashboard/rentals/new?customerId=${customer.id}`);
    }
  };

  const handleSuspend = async (member: Member) => {
    const { error } = await supabase.from('members').update({ status: 'suspended' }).eq('id', member.id);
    if (error) toast.error('처리에 실패했습니다.');
    else { toast.success('정지 처리되었습니다.'); fetchMembers(); }
  };

  const pendingCount = members.filter(m => m.status === 'pending').length;

  return (
    <div className="space-y-5" style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">회원 관리</h1>
          <p className="text-sm text-text-secondary mt-1">전체 {members.length}명{pendingCount > 0 && ` · 승인 대기 ${pendingCount}명`}</p>
        </div>
        <ExportButton target="members" params={{ status: tab === 'all' ? '' : tab, search }} />
      </div>

      {/* Tabs */}
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-tertiary" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="이름 / 연락처 / 이메일 검색..."
          className="w-full pl-10 pr-4 h-10 border border-border rounded-xl text-sm placeholder-text-tertiary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
      </div>

      {/* Table */}
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
                return (
                  <tr key={member.id} className="border-b border-border last:border-0 hover:bg-accent/30 cursor-pointer"
                    onClick={() => setSelectedId(selectedId === member.id ? null : member.id)}>
                    <td className="px-4 py-3 font-medium text-text-primary">{member.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{member.phone}</td>
                    <td className="px-4 py-3 text-text-secondary">{member.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{ color: status.color, backgroundColor: status.bg }}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {new Date(member.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {member.status === 'pending' && (
                          <>
                            <button onClick={() => handleApprove(member)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-light text-green hover:bg-green/10 transition-colors">
                              <CheckCircle className="size-3.5" /> 승인
                            </button>
                            <button onClick={() => handleApprove(member, true)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-light text-blue hover:bg-blue/10 transition-colors"
                              title="승인 후 임대계약 바로 등록">
                              <FileText className="size-3.5" /> 승인+계약
                            </button>
                          </>
                        )}
                        {member.status === 'approved' && (
                          <>
                            <button onClick={() => handleCreateRental(member)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-light text-blue hover:bg-blue/10 transition-colors">
                              <FileText className="size-3.5" /> 임대계약
                            </button>
                            <button onClick={() => handleSuspend(member)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-light text-gray hover:bg-gray/10 transition-colors">
                              <XCircle className="size-3.5" /> 정지
                            </button>
                          </>
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

      {/* 상세 정보 (선택 시) */}
      {selectedId && (() => {
        const member = filtered.find(m => m.id === selectedId);
        if (!member) return null;
        return (
          <div className="bg-card border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">{member.name} 상세 정보</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-text-tertiary">주소:</span> <span className="text-text-primary">{member.address}</span></div>
              <div><span className="text-text-tertiary">차량번호:</span> <span className="text-text-primary">{member.car_number || '-'}</span></div>
              <div><span className="text-text-tertiary">텃밭경험:</span> <span className="text-text-primary">{member.farming_experience ? '있음' : '없음'}</span></div>
              <div><span className="text-text-tertiary">가족 수:</span> <span className="text-text-primary">{member.family_size || '-'}</span></div>
              <div className="col-span-2"><span className="text-text-tertiary">관심작물:</span> <span className="text-text-primary">{member.interested_crops?.join(', ') || '-'}</span></div>
              {member.withdrawal_reason && (
                <div className="col-span-2"><span className="text-red">탈퇴 사유:</span> <span className="text-text-primary">{member.withdrawal_reason}</span></div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
