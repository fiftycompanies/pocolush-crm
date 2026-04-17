'use client';

import { useMemo, useState } from 'react';
import { Plus, Download, FileWarning } from 'lucide-react';
import toast from 'react-hot-toast';
import MembershipStatsCards from './MembershipStatsCards';
import MembershipFilters from './MembershipFilters';
import MembershipTable from './MembershipTable';
import MembershipDrawer from './MembershipDrawer';
import BulkActionBar from './BulkActionBar';
import IssueMembershipModal from './IssueMembershipModal';
import { useMembershipsList, type MembershipRow, type MembershipFilters as F } from '@/lib/use-memberships-list';
import { auditLog } from '@/lib/audit-log';

interface Props {
  initialMemberId?: string;
  initialExpiring?: boolean;
}

export default function MembershipsPageClient({ initialMemberId, initialExpiring }: Props) {
  const today = new Date();
  const thirtyDays = new Date(today.getTime() + 30 * 86400_000).toISOString().slice(0, 10);

  const [filters, setFilters] = useState<F>({
    status: 'all',
    memberId: initialMemberId,
    endBefore: initialExpiring ? thirtyDays : undefined,
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerRow, setDrawerRow] = useState<MembershipRow | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);

  const { rows, loading, refetch } = useMembershipsList(filters);

  const stats = useMemo(() => {
    const now = today.toISOString().slice(0, 10);
    return {
      active: rows.filter(r => r.status === 'active' && r.end_date >= now).length,
      expiringSoon: rows.filter(
        r => r.status === 'active' && r.end_date >= now && r.end_date <= thirtyDays
      ).length,
      cancelled: rows.filter(r => r.status === 'cancelled').length,
      newThisMonth: rows.filter(
        r => r.created_at.slice(0, 7) === today.toISOString().slice(0, 7)
      ).length,
    };
  }, [rows, today, thirtyDays]);

  const handleSelect = (id: string, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) {
        if (next.size >= 100) {
          toast.error('최대 100건까지 선택할 수 있습니다');
          return prev;
        }
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const sample = rows.slice(0, 100).map(r => r.id);
      if (rows.length > 100) toast('상위 100건만 선택됐습니다', { icon: '⚠️' });
      setSelected(new Set(sample));
    } else {
      setSelected(new Set());
    }
  };

  const handleCsvExport = async (includePII: boolean) => {
    if (includePII) {
      const ok = window.confirm(
        '민감정보(전화/이메일/주소)가 포함된 CSV를 내보냅니다.\n' +
          '감사 로그에 기록됩니다. 계속하시겠습니까?'
      );
      if (!ok) return;
      // PII 방지: filters에서 회원 검색어(이름/전화/코드) 제외, 비식별 필드만 기록
      await auditLog({
        action: 'csv_export_pii',
        resource_type: 'membership_list',
        metadata: {
          row_count: rows.length,
          filters: {
            status: filters.status,
            plan_name: filters.planName,
            end_before: filters.endBefore,
            end_after: filters.endAfter,
            member_id: filters.memberId,
          },
        },
      });
    }
    const header = includePII
      ? ['코드', '회원명', '전화', '플랜', '농장', '기간', '상태']
      : ['코드', '회원명', '플랜', '농장', '기간', '상태'];
    const lines = rows.map(r => {
      const base = [
        r.membership_code,
        r.member?.name || '',
        r.plan_name || '',
        r.farm?.number ? `#${r.farm.number}` : '',
        `${r.start_date}~${r.end_date}`,
        r.status,
      ];
      if (includePII) base.splice(2, 0, r.member?.phone || '');
      return base.map(s => `"${String(s).replace(/"/g, '""')}"`).join(',');
    });
    const csv = '\ufeff' + [header.join(','), ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memberships_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5" style={{ maxWidth: '1400px' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">회원권 관리</h1>
          <p className="text-sm text-text-secondary mt-1">총 {rows.length}건</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCsvExport(false)}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-sm hover:bg-accent/50"
          >
            <Download className="size-4" /> CSV
          </button>
          <button
            onClick={() => handleCsvExport(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-red-300 text-red-700 rounded-xl text-sm hover:bg-red-50"
            title="전화/이메일 등 민감정보 포함"
          >
            <FileWarning className="size-4" /> PII 포함
          </button>
          <button
            onClick={() => setIssueOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary-dark"
          >
            <Plus className="size-4" /> 신규 발급
          </button>
        </div>
      </div>

      <MembershipStatsCards stats={stats} />

      <MembershipFilters filters={filters} setFilters={setFilters} />

      <MembershipTable
        rows={rows}
        loading={loading}
        selected={selected}
        onSelect={handleSelect}
        onSelectAll={handleSelectAll}
        onRowClick={setDrawerRow}
      />

      {selected.size > 0 && (
        <BulkActionBar
          selectedIds={Array.from(selected)}
          rows={rows}
          onDone={() => {
            setSelected(new Set());
            refetch();
          }}
        />
      )}

      {drawerRow && (
        <MembershipDrawer
          row={drawerRow}
          onClose={() => setDrawerRow(null)}
          onRefetch={refetch}
        />
      )}

      {issueOpen && (
        <IssueMembershipModal
          onClose={() => setIssueOpen(false)}
          onSuccess={() => {
            setIssueOpen(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
