'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, RotateCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { requestSelfWithdrawal } from './actions';
import { MEMBER_ACTION_REASONS, daysUntilPurge } from '@/lib/member-lifecycle';
import type { MemberActionReason } from '@/types';

/**
 * 070 회원 self-service 탈퇴
 * - 30일 grace + PII 마스킹 (063 라이프사이클)
 * - 사유 5종 + memo (other 필수)
 * - IP/UA 수집 (Server Action)
 * - pending_deletion 상태에서 본인 복원 가능
 */
export default function WithdrawPage() {
  const router = useRouter();
  const supabase = createClient();
  const [reason, setReason] = useState<MemberActionReason | ''>('');
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberStatus, setMemberStatus] = useState<string | null>(null);
  const [deletionRequestedAt, setDeletionRequestedAt] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: m } = await supabase
        .from('members')
        .select('id, status, deletion_requested_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (m) {
        setMemberId(m.id);
        setMemberStatus(m.status);
        setDeletionRequestedAt(m.deletion_requested_at);
      }
    }
    load();
  }, [supabase]);

  const requiresMemo = reason === 'other';
  const canSubmit = reason && (!requiresMemo || memo.trim().length > 0) && !loading;

  const handleSubmit = async () => {
    if (!canSubmit || !reason) return;
    setLoading(true);
    const res = await requestSelfWithdrawal(reason, memo.trim() || null);
    setLoading(false);
    if (res.error) {
      toast.error('탈퇴 신청 실패: ' + res.error);
      return;
    }
    toast.success('탈퇴 신청이 접수되었습니다. 30일 내 복원 가능합니다.');
    // 페이지 재로드 — 새 상태 반영
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: m } = await supabase.from('members')
        .select('status, deletion_requested_at').eq('user_id', user.id).maybeSingle();
      if (m) {
        setMemberStatus(m.status);
        setDeletionRequestedAt(m.deletion_requested_at);
      }
    }
  };

  const handleRestore = async () => {
    if (!confirm('탈퇴 신청을 취소하고 계정을 복원하시겠습니까?')) return;
    setLoading(true);
    const { error } = await supabase.rpc('self_restore_member_deletion');
    setLoading(false);
    if (error) {
      toast.error('복원 실패: ' + error.message);
      return;
    }
    toast.success('계정이 복원되었습니다.');
    router.push('/member/mypage');
  };

  const isPendingDeletion = memberStatus === 'pending_deletion';
  const daysLeft = isPendingDeletion ? daysUntilPurge(deletionRequestedAt) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-text-secondary hover:text-text-primary" aria-label="뒤로 가기">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-lg font-bold text-text-primary">회원탈퇴</h1>
      </div>

      {isPendingDeletion ? (
        /* 탈퇴 신청 완료 상태 — 30일 grace */
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-300 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-6 text-orange-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <h2 className="text-base font-bold text-orange-900 mb-1">탈퇴 신청 접수됨 — D-{daysLeft}</h2>
                <p className="text-sm text-orange-800">
                  {daysLeft}일 후 ({deletionRequestedAt && new Date(new Date(deletionRequestedAt).getTime() + 30 * 86400000).toLocaleDateString('ko-KR')}) 개인정보가 자동 파기됩니다.
                </p>
                <ul className="text-[12px] text-orange-700 mt-2 list-disc pl-4 space-y-0.5">
                  <li>거래·정산 기록은 5년간 분리 보관됩니다 (전자상거래법 §6③)</li>
                  <li>30일 내 [복원]하시면 모든 정보가 그대로 유지됩니다</li>
                  <li>활성 회원권은 일시 정지된 상태입니다 (복원 시 자동 active)</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={handleRestore}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl h-12 transition-all disabled:opacity-40"
            data-testid="self-restore-button"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {loading ? '처리 중...' : '탈퇴 신청 취소 (복원)'}
          </button>
        </div>
      ) : (
        <>
          <div className="bg-red-light border border-red/20 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-red mb-2">탈퇴 시 유의사항 (PIPA)</h3>
            <ul className="space-y-1.5 text-[13px] text-text-secondary">
              <li>• 탈퇴 신청 후 <strong>30일 grace</strong> — 그 기간 내 복원 가능</li>
              <li>• 30일 후 <strong>개인정보 자동 파기</strong> (이름/연락처/주소 마스킹)</li>
              <li>• <strong>거래·정산 기록은 5년간 보관</strong> (전자상거래법 §6③)</li>
              <li>• 활성 회원권은 신청 즉시 일시 정지 (복원 시 자동 재개)</li>
              <li>• 진행 중인 예약은 자동 취소됩니다</li>
            </ul>
          </div>

          <div className="bg-white border border-border rounded-2xl p-5 space-y-3">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                탈퇴 사유 <span className="text-red-500">*</span>
              </label>
              <select
                value={reason}
                onChange={e => setReason(e.target.value as MemberActionReason)}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red/50 focus:ring-2 focus:ring-red/10"
                data-testid="withdraw-reason-select"
              >
                <option value="">선택하세요</option>
                {MEMBER_ACTION_REASONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                상세 사유 {requiresMemo && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={memo}
                onChange={e => setMemo(e.target.value)}
                placeholder={requiresMemo ? '구체적인 사유를 입력해주세요' : '추가 메모 (선택)'}
                rows={3}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm placeholder-text-tertiary focus:outline-none focus:border-red/50 focus:ring-2 focus:ring-red/10 resize-none"
                data-testid="withdraw-memo-textarea"
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full bg-red hover:bg-red/90 text-white font-semibold rounded-xl h-12 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="withdraw-submit-button"
          >
            {loading ? '처리 중...' : '탈퇴 신청 (30일 grace)'}
          </button>
        </>
      )}
    </div>
  );
}
