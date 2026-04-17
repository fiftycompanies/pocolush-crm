'use client';

import { useEffect, useState } from 'react';
import { X, Pause, Calendar, Play, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { MembershipRow } from '@/lib/use-memberships-list';
import ExtendPeriodModal from './ExtendPeriodModal';

interface LogEntry {
  id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  from_start: string | null;
  to_start: string | null;
  from_end: string | null;
  to_end: string | null;
  reason: string | null;
  created_at: string;
}

interface Props {
  row: MembershipRow;
  onClose: () => void;
  onRefetch: () => void;
}

export default function MembershipDrawer({ row, onClose, onRefetch }: Props) {
  const supabase = createClient();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);

  useEffect(() => {
    supabase
      .from('membership_logs')
      .select('*')
      .eq('membership_id', row.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setLogs((data as LogEntry[]) || []));
  }, [supabase, row.id]);

  const handleSuspend = async () => {
    const reason = window.prompt('정지 사유를 입력하세요', '');
    if (reason === null) return;
    setBusy(true);
    const { error } = await supabase.rpc('suspend_membership', {
      p_membership_id: row.id,
      p_reason: reason || null,
    });
    setBusy(false);
    if (error) { toast.error('정지 실패: ' + error.message); return; }
    toast.success('회원권이 정지되었습니다');
    onRefetch();
    onClose();
  };

  const handleResume = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('resume_membership', { p_membership_id: row.id });
    setBusy(false);
    if (error) { toast.error('재개 실패: ' + error.message); return; }
    toast.success('회원권이 재개되었습니다');
    onRefetch();
    onClose();
  };

  const handleDelete = async () => {
    const ok = window.confirm(
      `회원권 ${row.membership_code}을(를) 영구 삭제합니다.\n` +
      `이력(membership_logs)도 함께 삭제됩니다.\n` +
      `되돌릴 수 없습니다. 계속하시겠습니까?`
    );
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.from('memberships').delete().eq('id', row.id);
    setBusy(false);
    if (error) { toast.error('삭제 실패: ' + error.message); return; }
    toast.success('회원권이 삭제되었습니다');
    onRefetch();
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l border-border shadow-lg z-50 overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background">
          <h2 className="text-sm font-semibold">회원권 {row.membership_code}</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm">
          <dl className="grid grid-cols-3 gap-y-2 text-xs">
            <dt className="text-text-tertiary">회원</dt>
            <dd className="col-span-2">{row.member?.name} ({row.member?.phone || '-'})</dd>
            <dt className="text-text-tertiary">플랜</dt>
            <dd className="col-span-2">{row.plan_name || '-'}</dd>
            <dt className="text-text-tertiary">농장</dt>
            <dd className="col-span-2">{row.farm?.number ? `#${row.farm.number}` : '-'}</dd>
            <dt className="text-text-tertiary">구좌</dt>
            <dd className="col-span-2">{row.plots}</dd>
            <dt className="text-text-tertiary">기간</dt>
            <dd className="col-span-2">{row.start_date} ~ {row.end_date}</dd>
            <dt className="text-text-tertiary">상태</dt>
            <dd className="col-span-2">{row.status}</dd>
          </dl>

          <div>
            <p className="text-xs text-text-tertiary mb-1">혜택</p>
            <ul className="text-xs space-y-0.5">
              {(row.benefits || []).map((b, i) => (
                <li key={i}>• {b}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            <button
              disabled={busy}
              onClick={() => setExtendOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-light text-blue hover:bg-blue/10 disabled:opacity-50"
            >
              <Calendar className="size-3.5" /> 기간 수정/연장
            </button>
            {row.status === 'active' && (
              <button
                disabled={busy}
                onClick={handleSuspend}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                <Pause className="size-3.5" /> 정지
              </button>
            )}
            {row.status === 'cancelled' && (
              <button
                disabled={busy}
                onClick={handleResume}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                title="end_date가 이미 지난 경우 실패합니다. 그럴 땐 기간 수정부터."
              >
                <Play className="size-3.5" /> 재개
              </button>
            )}
            {(row.status === 'cancelled' || row.status === 'expired') && (
              <button
                disabled={busy}
                onClick={handleDelete}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 disabled:opacity-50 ml-auto"
                title="취소/만료된 회원권만 영구 삭제 가능"
              >
                <Trash2 className="size-3.5" /> 삭제
              </button>
            )}
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-xs font-semibold mb-2">이력</p>
            {logs.length === 0 ? (
              <p className="text-xs text-text-tertiary">이력이 없습니다</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {logs.map(l => (
                  <li key={l.id} className="border-l-2 border-border pl-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{l.action}</span>
                      <span className="text-text-tertiary">
                        {new Date(l.created_at).toLocaleString('ko-KR')}
                      </span>
                    </div>
                    {(l.from_status || l.to_status) && (
                      <p className="text-text-secondary">
                        {l.from_status || '∅'} → {l.to_status || '∅'}
                      </p>
                    )}
                    {l.to_end && (
                      <p className="text-text-secondary">
                        기간 {l.from_start || '∅'}~{l.from_end || '∅'} → {l.to_start || '∅'}~{l.to_end}
                      </p>
                    )}
                    {l.reason && <p className="text-text-tertiary italic">{l.reason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>

      {extendOpen && (
        <ExtendPeriodModal
          membershipId={row.id}
          currentStart={row.start_date}
          currentEnd={row.end_date}
          onClose={() => setExtendOpen(false)}
          onSuccess={() => {
            setExtendOpen(false);
            onRefetch();
            onClose();
          }}
        />
      )}
    </>
  );
}
