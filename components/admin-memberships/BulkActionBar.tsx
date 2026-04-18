'use client';

import { useState } from 'react';
import { Pause, Calendar, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { auditLog } from '@/lib/audit-log';
import type { MembershipRow } from '@/lib/use-memberships-list';

interface Props {
  selectedIds: string[];
  rows: MembershipRow[];
  onDone: () => void;
}

export default function BulkActionBar({ selectedIds, rows, onDone }: Props) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendMonths, setExtendMonths] = useState(3);
  const [reason, setReason] = useState('');

  const handleBulkExtend = async () => {
    setBusy(true);
    const selectedRows = rows.filter(r => selectedIds.includes(r.id));
    const results = await Promise.allSettled(
      selectedRows.map(async r => {
        const d = new Date(r.end_date);
        d.setMonth(d.getMonth() + extendMonths);
        const { error } = await supabase.rpc('update_membership_period', {
          p_membership_id: r.id,
          p_start_date: r.start_date,
          p_end_date: d.toISOString().slice(0, 10),
          p_reason: reason || `일괄 ${extendMonths}개월 연장`,
        });
        if (error) throw new Error(error.message);
        return r.id;
      })
    );
    setBusy(false);
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const fail = results.length - ok;
    await auditLog({
      action: 'bulk_extend_memberships',
      resource_type: 'membership',
      metadata: { total: results.length, success: ok, fail, months: extendMonths, reason: reason || null },
    });
    if (fail > 0) {
      toast.error(`${ok}건 성공 / ${fail}건 실패. 실패 행을 확인하세요.`);
    } else {
      toast.success(`${ok}건 기간 연장 완료`);
    }
    setExtendOpen(false);
    onDone();
  };

  const handleBulkSuspend = async () => {
    const r = window.prompt(`${selectedIds.length}건 정지. 사유:`, '');
    if (r === null) return;
    setBusy(true);
    const results = await Promise.allSettled(
      selectedIds.map(id =>
        supabase.rpc('suspend_membership', { p_membership_id: id, p_reason: r || null })
      )
    );
    setBusy(false);
    const ok = results.filter(x => x.status === 'fulfilled').length;
    const fail = results.length - ok;
    await auditLog({
      action: 'bulk_suspend_memberships',
      resource_type: 'membership',
      metadata: { total: results.length, success: ok, fail, reason: r || null },
    });
    if (fail > 0) toast.error(`${ok}건 성공 / ${fail}건 실패`);
    else toast.success(`${ok}건 정지 완료`);
    onDone();
  };

  return (
    <>
      <div className="sticky bottom-4 flex items-center justify-between gap-3 bg-background border border-border shadow-lg rounded-xl px-4 py-3">
        <span className="text-sm font-medium">선택된 {selectedIds.length}건</span>
        <div className="flex items-center gap-2">
          <button
            disabled={busy}
            onClick={() => setExtendOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-light text-blue hover:bg-blue/10 disabled:opacity-50"
          >
            <Calendar className="size-3.5" /> 기간 연장
          </button>
          <button
            disabled={busy}
            onClick={handleBulkSuspend}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            <Pause className="size-3.5" /> 정지
          </button>
          <button onClick={onDone} className="p-1 hover:bg-accent rounded">
            <X className="size-4" />
          </button>
        </div>
      </div>

      {extendOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setExtendOpen(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-xl w-[90vw] max-w-md z-50 p-4 shadow-xl">
            <h3 className="text-sm font-semibold mb-3">일괄 기간 연장</h3>
            <p className="text-xs text-text-secondary mb-3">{selectedIds.length}건의 end_date를 연장합니다.</p>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs text-text-tertiary">연장 기간(개월)</label>
                <select
                  value={extendMonths}
                  onChange={e => setExtendMonths(Number(e.target.value))}
                  className="w-full h-10 px-3 border border-border rounded-lg"
                >
                  {[1, 3, 6, 12].map(m => (
                    <option key={m} value={m}>{m}개월</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-text-tertiary">사유</label>
                <input
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="예: 운영자 프로모션"
                  className="w-full h-10 px-3 border border-border rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setExtendOpen(false)}
                className="px-4 py-2 border border-border rounded-lg text-sm"
              >
                취소
              </button>
              <button
                onClick={handleBulkExtend}
                disabled={busy}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary-dark disabled:opacity-50"
              >
                {busy ? '처리 중...' : '연장 실행'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
