'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Search, CheckCircle, Clock, FileText, Plus, Award, RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  type MemberWithStatusRow,
  type MemberDerivedStatus,
  deriveMemberStatus,
  LABEL_OF,
  BADGE_CLASS,
  DERIVED_FILTER_TABS,
  daysUntil,
} from '@/lib/member-derived-status';
import ExportButton from '@/components/ui/ExportButton';
import AddMemberModal from '@/components/admin-members/AddMemberModal';
import { auditLog } from '@/lib/audit-log';

type Row = MemberWithStatusRow & { derived: MemberDerivedStatus };

export default function MembersPage() {
  const supabase = createClient();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_members_list_admin');
    if (error) {
      toast.error('회원 목록 조회 실패: ' + error.message);
      setRows([]);
    } else {
      const list = ((data as MemberWithStatusRow[]) || []).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setRows(list.map(m => ({ ...m, derived: deriveMemberStatus(m) })));
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const filtered = rows.filter(m => {
    if (tab !== 'all' && m.derived !== tab) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      (m.phone || '').includes(q) ||
      (m.email || '').toLowerCase().includes(q)
    );
  });

  const pendingCount = rows.filter(m => m.derived === 'pending').length;

  const handleApprove = async (member: Row, goToRental: boolean = false) => {
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

    if (goToRental && member.phone) {
      const { data: customer } = await supabase.from('customers')
        .select('id').eq('phone', member.phone).maybeSingle();
      if (customer) {
        router.push(`/dashboard/rentals/new?customerId=${customer.id}`);
        return;
      }
    }
    fetchMembers();
  };

  const handleCreateRental = async (member: Row) => {
    if (!member.phone) { toast.error('전화번호가 없어 고객 레코드 생성 불가'); return; }
    const { data: customer } = await supabase.from('customers')
      .select('id').eq('phone', member.phone).maybeSingle();
    if (!customer) {
      const { data: newCust, error } = await supabase.from('customers')
        .insert({ name: member.name, phone: member.phone }).select().single();
      if (error || !newCust) { toast.error('고객 레코드 생성 실패'); return; }
      router.push(`/dashboard/rentals/new?customerId=${newCust.id}`);
    } else {
      router.push(`/dashboard/rentals/new?customerId=${customer.id}`);
    }
  };

  const handleIssueMembership = async (member: Row) => {
    const { data: rentals } = await supabase
      .from('farm_rentals')
      .select('id')
      .eq('member_id', member.id)
      .eq('status', 'active')
      .limit(1);
    if (!rentals || rentals.length === 0) {
      toast.error('활성 계약을 찾을 수 없습니다 (member_id 연결 확인)');
      return;
    }
    const { error } = await supabase.rpc('issue_membership', { p_rental_id: rentals[0].id });
    if (error) { toast.error('회원권 발급 실패: ' + error.message); return; }
    toast.success('회원권이 발급되었습니다');
    fetchMembers();
  };

  const handleReactivate = async (member: Row) => {
    const ok = window.confirm(
      `${member.name}님을 재개하시겠습니까?\n\n` +
      `활성 계약이 있으면 새 회원권이 자동 발급됩니다.\n` +
      `기존 취소된 회원권은 이력으로 그대로 유지됩니다.`
    );
    if (!ok) return;
    const { error } = await supabase.rpc('reactivate_member', {
      p_member_id: member.id,
      p_reason: '리스트에서 재개',
    });
    if (error) { toast.error('재개 실패: ' + error.message); return; }
    await auditLog({
      action: 'reactivate_member',
      resource_type: 'member',
      resource_id: member.id,
      metadata: { member_name: member.name, reason: '리스트에서 재개' },
    });
    toast.success(`${member.name}님이 재개되었습니다`);
    fetchMembers();
  };

  return (
    <div className="space-y-5" style={{ maxWidth: '1200px' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">회원 관리</h1>
          <p className="text-sm text-text-secondary mt-1">
            전체 {rows.length}명{pendingCount > 0 && ` · 승인 대기 ${pendingCount}명`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            target="members"
            params={{ status: tab === 'all' ? '' : tab, search }}
            dateField="created_at"
          />
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary-dark"
          >
            <Plus className="size-4" /> 회원 추가
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {DERIVED_FILTER_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative whitespace-nowrap ${
              tab === t.key ? 'text-primary' : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            {t.label}
            {t.key === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 bg-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
            {tab === t.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-tertiary" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="이름 / 연락처 / 이메일 검색..."
          className="w-full pl-10 pr-4 h-10 border border-border rounded-xl text-sm placeholder-text-tertiary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
        />
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
                <th className="px-4 py-3 font-medium text-text-secondary">상태</th>
                <th className="px-4 py-3 font-medium text-text-secondary">계약/회원권</th>
                <th className="px-4 py-3 font-medium text-text-secondary">가입일</th>
                <th className="px-4 py-3 font-medium text-text-secondary">액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(member => {
                const remain = daysUntil(member.nearest_membership_end);
                return (
                  <tr
                    key={member.id}
                    className="border-b border-border last:border-0 hover:bg-accent/30 cursor-pointer"
                    onClick={() => router.push(`/dashboard/members/${member.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-text-primary">{member.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{member.phone || '-'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ${BADGE_CLASS[member.derived]}`}
                      >
                        {LABEL_OF[member.derived]}
                        {(member.derived === 'active' || member.derived === 'expired') &&
                          remain !== null &&
                          ` · ${remain >= 0 ? `D-${remain}` : `${Math.abs(remain)}일 경과`}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      계약 {member.active_rental_count} · 회원권 {member.active_membership_count}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {new Date(member.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 flex-wrap">
                        {member.derived === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(member)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-light text-green hover:bg-green/10"
                            >
                              <CheckCircle className="size-3.5" /> 승인
                            </button>
                            <button
                              onClick={() => handleApprove(member, true)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-light text-blue hover:bg-blue/10"
                              title="승인 후 임대계약 바로 등록"
                            >
                              <FileText className="size-3.5" /> 승인+계약
                            </button>
                          </>
                        )}
                        {member.derived === 'approved_no_rental' && (
                          <button
                            onClick={() => handleCreateRental(member)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-light text-blue hover:bg-blue/10"
                          >
                            <FileText className="size-3.5" /> 임대계약
                          </button>
                        )}
                        {member.derived === 'rental_no_membership' && (
                          <button
                            onClick={() => handleIssueMembership(member)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200"
                          >
                            <Award className="size-3.5" /> 회원권 발급
                          </button>
                        )}
                        {member.derived === 'active' && (
                          <Link
                            href={`/dashboard/memberships?member_id=${member.id}`}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          >
                            <Award className="size-3.5" /> 회원권
                          </Link>
                        )}
                        {member.derived === 'expired' && (
                          <Link
                            href={`/dashboard/memberships?member_id=${member.id}`}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                          >
                            <RotateCcw className="size-3.5" /> 연장
                          </Link>
                        )}
                        {member.derived === 'suspended' && (
                          <button
                            onClick={() => handleReactivate(member)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100"
                          >
                            <RotateCcw className="size-3.5" /> 재개
                          </button>
                        )}
                        {member.withdrawal_requested_at && member.derived !== 'withdrawn' && (
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

      <AddMemberModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={fetchMembers}
      />
    </div>
  );
}
