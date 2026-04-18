'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';

interface AuditLogRow {
  id: string;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  actor?: { id: string; name: string | null } | null;
}

const ACTION_LABEL: Record<string, string> = {
  csv_export_pii: 'CSV PII 내보내기',
  suspend_membership: '회원권 정지',
  resume_membership: '회원권 재개',
  delete_membership: '회원권 삭제',
  issue_membership_manual: '회원권 수동 발급',
  reactivate_member: '회원 재개',
  change_member_status: '회원 상태 변경',
  cancel_membership_via_payment: '결제 변경→회원권 정지',
  bulk_extend_memberships: '회원권 일괄 연장',
  bulk_suspend_memberships: '회원권 일괄 정지',
};

const RESOURCE_LABEL: Record<string, string> = {
  membership: '회원권',
  member: '회원',
  membership_list: '회원권 리스트',
};

const actionClass = (action: string): string => {
  if (action.includes('delete') || action.includes('suspend') || action.includes('cancel')) {
    return 'bg-red-50 text-red-700 border-red-200';
  }
  if (action.includes('resume') || action.includes('issue') || action.includes('reactivate')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (action.includes('bulk') || action.includes('extend')) {
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }
  if (action.includes('export')) {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  return 'bg-gray-100 text-gray-700 border-gray-200';
};

export default function AuditLogsPageClient() {
  const supabase = createClient();
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [resourceFilter, setResourceFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('audit_logs')
      .select('*, actor:profiles(id, name)')
      .order('created_at', { ascending: false })
      .limit(500);

    if (actionFilter !== 'all') q = q.eq('action', actionFilter);
    if (resourceFilter !== 'all') q = q.eq('resource_type', resourceFilter);
    if (fromDate) q = q.gte('created_at', fromDate);
    if (toDate) q = q.lte('created_at', toDate + 'T23:59:59Z');

    const { data, error } = await q;
    if (error) {
      console.warn('audit_logs fetch error', error.message);
      setRows([]);
    } else {
      setRows((data as unknown as AuditLogRow[]) || []);
    }
    setLoading(false);
  }, [supabase, actionFilter, resourceFilter, fromDate, toDate]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.action.toLowerCase().includes(q) ||
        r.resource_type.toLowerCase().includes(q) ||
        (r.resource_id || '').toLowerCase().includes(q) ||
        (r.actor?.name || '').toLowerCase().includes(q) ||
        JSON.stringify(r.metadata || {}).toLowerCase().includes(q)
    );
  }, [rows, search]);

  const uniqueActions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.action))).sort(),
    [rows]
  );
  const uniqueResources = useMemo(
    () => Array.from(new Set(rows.map((r) => r.resource_type))).sort(),
    [rows]
  );

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-5" style={{ maxWidth: '1400px' }}>
      <div>
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight">감사 로그</h1>
        <p className="text-sm text-text-secondary mt-1">
          총 {rows.length}건 {filtered.length !== rows.length && `(필터 적용 ${filtered.length}건)`}
        </p>
      </div>

      <div className="bg-card border rounded-xl p-3 flex flex-wrap items-center gap-2">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="h-9 px-3 border border-border rounded-lg text-sm"
        >
          <option value="all">액션 전체</option>
          {uniqueActions.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABEL[a] || a}
            </option>
          ))}
        </select>

        <select
          value={resourceFilter}
          onChange={(e) => setResourceFilter(e.target.value)}
          className="h-9 px-3 border border-border rounded-lg text-sm"
        >
          <option value="all">리소스 전체</option>
          {uniqueResources.map((r) => (
            <option key={r} value={r}>
              {RESOURCE_LABEL[r] || r}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <span className="text-xs text-text-tertiary">기간</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-9 px-2 border border-border rounded-lg text-sm"
          />
          <span className="text-xs text-text-tertiary">~</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-9 px-2 border border-border rounded-lg text-sm"
          />
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="액션/리소스/메타 검색"
            className="w-full pl-10 pr-3 h-9 border border-border rounded-lg text-sm"
          />
        </div>

        {(actionFilter !== 'all' ||
          resourceFilter !== 'all' ||
          fromDate ||
          toDate ||
          search) && (
          <button
            onClick={() => {
              setActionFilter('all');
              setResourceFilter('all');
              setFromDate('');
              setToDate('');
              setSearch('');
            }}
            className="h-9 px-3 text-xs text-text-secondary hover:text-text-primary border border-border rounded-lg"
          >
            초기화
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-center text-sm text-text-secondary py-10">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-text-tertiary py-10">로그가 없습니다.</p>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="w-8 px-2 py-3"></th>
                <th className="px-3 py-3 font-medium text-text-secondary">시간</th>
                <th className="px-3 py-3 font-medium text-text-secondary">작업자</th>
                <th className="px-3 py-3 font-medium text-text-secondary">액션</th>
                <th className="px-3 py-3 font-medium text-text-secondary">리소스</th>
                <th className="px-3 py-3 font-medium text-text-secondary">메타 요약</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isOpen = expanded.has(r.id);
                const metaSummary = r.metadata
                  ? Object.entries(r.metadata)
                      .slice(0, 3)
                      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                      .join(' · ')
                  : '';
                return (
                  <Fragment key={r.id}>
                    <tr
                      className="border-b border-border last:border-0 hover:bg-accent/30 cursor-pointer"
                      onClick={() => toggleExpand(r.id)}
                    >
                      <td className="px-2 py-3 text-text-tertiary">
                        {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </td>
                      <td className="px-3 py-3 text-xs text-text-secondary">
                        {new Date(r.created_at).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-3 py-3 text-text-primary">
                        {r.actor?.name || <span className="text-text-tertiary">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full border ${actionClass(r.action)}`}
                        >
                          {ACTION_LABEL[r.action] || r.action}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-text-secondary">
                        {RESOURCE_LABEL[r.resource_type] || r.resource_type}
                        {r.resource_id && (
                          <span className="font-mono ml-1 text-text-tertiary">
                            {r.resource_id.slice(0, 8)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-text-tertiary truncate max-w-md">
                        {metaSummary || '—'}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-accent/10 border-b border-border">
                        <td colSpan={6} className="px-6 py-3">
                          <pre className="text-[11px] font-mono overflow-x-auto whitespace-pre-wrap">
{JSON.stringify(
  {
    id: r.id,
    actor_id: r.actor_id,
    resource_id: r.resource_id,
    metadata: r.metadata,
    ip: r.ip,
    user_agent: r.user_agent,
  },
  null,
  2
)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
