import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import DiagnosticsSummary from '@/components/diagnostics/DiagnosticsSummary';
import ErrorLogTable from '@/components/diagnostics/ErrorLogTable';
import RefreshButton from '@/components/diagnostics/RefreshButton';
import { AckAllButton } from '@/components/diagnostics/AckControls';
import type { TriggerErrorLog, TriggerErrorMonthlySummary } from '@/types';

export const dynamic = 'force-dynamic';

export default async function WarningPage() {
  const supabase = await createClient();

  // 1. Auth + admin check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  // 2. Fetch monthly summary, recent 50, unacked count in parallel
  const [summaryRes, logsRes, countRes] = await Promise.all([
    supabase.rpc('trigger_error_monthly_summary'),
    supabase
      .from('trigger_error_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.rpc('get_unacked_error_count'),
  ]);

  if (summaryRes.error || logsRes.error || countRes.error) {
    throw new Error(
      '진단 데이터 조회 실패: ' +
        (summaryRes.error?.message ||
          logsRes.error?.message ||
          countRes.error?.message ||
          'unknown')
    );
  }

  const summary = (summaryRes.data ?? []) as TriggerErrorMonthlySummary[];
  const logs = (logsRes.data ?? []) as TriggerErrorLog[];
  const unackedTotal = (countRes.data ?? 0) as number;

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-text-secondary" />
          <h1 className="text-[20px] font-bold text-text-primary tracking-tight">
            시스템 경고
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {unackedTotal > 0 && <AckAllButton />}
          <RefreshButton />
        </div>
      </div>

      {/* Summary cards + chart */}
      <DiagnosticsSummary rows={summary} unackedTotal={unackedTotal} />

      {/* Recent logs */}
      <div>
        <h2 className="text-[14px] font-semibold text-text-primary mb-3">
          최근 오류 (최대 50건)
        </h2>
        <ErrorLogTable rows={logs} />
      </div>
    </div>
  );
}
