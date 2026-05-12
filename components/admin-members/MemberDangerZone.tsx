'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Ban, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { daysUntilPurge } from '@/lib/member-lifecycle';
import SuspendMemberModal from './SuspendMemberModal';
import DeleteMemberModal from './DeleteMemberModal';
import type { Member } from '@/types';

interface Props {
  member: Member;
  onRefresh: () => void;
}

/**
 * 회원 상세 페이지 하단 위험 영역.
 * - approved/pending → 비활성화, 삭제 신청
 * - suspended → 재활성화, 삭제 신청
 * - pending_deletion → 복원 (30일 grace 내), D-N 배너
 * - deleted → 표시 안 함 (계정 마스킹 완료)
 */
export default function MemberDangerZone({ member, onRefresh }: Props) {
  const supabase = createClient();
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actioning, setActioning] = useState(false);

  if (member.status === 'deleted') return null;

  const handleUnsuspend = async () => {
    if (!confirm(`${member.name} 회원을 재활성화하시겠습니까?`)) return;
    setActioning(true);
    const { error } = await supabase.rpc('unsuspend_member', { p_member_id: member.id });
    setActioning(false);
    if (error) {
      toast.error('재활성화 실패: ' + error.message);
      return;
    }
    toast.success(`${member.name} 재활성화 완료`);
    onRefresh();
  };

  const handleRestore = async () => {
    if (!confirm(`${member.name} 회원의 삭제 신청을 취소하시겠습니까?`)) return;
    setActioning(true);
    const { error } = await supabase.rpc('restore_member_deletion', { p_member_id: member.id });
    setActioning(false);
    if (error) {
      toast.error('복원 실패: ' + error.message);
      return;
    }
    toast.success(`${member.name} 복원 완료`);
    onRefresh();
  };

  const daysLeft = daysUntilPurge(member.deletion_requested_at);
  const isPendingDeletion = member.status === 'pending_deletion';
  // deletion_requested_at + 30일을 안정적으로 계산 (Date.now() 렌더 중 호출 방지)
  const purgeDateLabel = member.deletion_requested_at
    ? new Date(new Date(member.deletion_requested_at).getTime() + 30 * 86400000).toLocaleDateString('ko-KR')
    : '';

  return (
    <>
      {/* 삭제 대기 배너 */}
      {isPendingDeletion && daysLeft !== null && (
        <div className="bg-orange-50 border border-orange-300 rounded-xl p-4 flex items-start gap-3" role="alert">
          <AlertTriangle className="size-5 text-orange-600 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-orange-900">
              삭제 대기 중 — D-{daysLeft} ({purgeDateLabel} 자동 파기)
            </p>
            <p className="text-xs text-orange-800 mt-0.5">
              30일 내 복원 가능. 이후 개인정보 마스킹 + 거래기록 5년 분리 보관 (PIPA).
            </p>
            {member.deletion_reason && (
              <p className="text-[11px] text-orange-700 mt-1">사유: {member.deletion_reason}</p>
            )}
          </div>
          <button
            onClick={handleRestore}
            disabled={actioning}
            className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-orange-700 hover:text-orange-900 bg-white border border-orange-300 hover:bg-orange-100 rounded-lg px-3 py-1.5 disabled:opacity-50"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" /> 복원
          </button>
        </div>
      )}

      {/* Danger Zone */}
      <fieldset className="border border-red-200 rounded-xl bg-red-50/30 p-5 space-y-4">
        <legend className="px-2 text-xs font-semibold text-red-700 flex items-center gap-1">
          <AlertTriangle className="size-3.5" aria-hidden="true" /> 위험 구역
        </legend>

        {/* 비활성화 (suspended 가 아닌 경우만) */}
        {member.status !== 'suspended' && !isPendingDeletion && (
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-text-primary">계정 비활성화</h4>
              <p className="text-[12px] text-text-secondary mt-0.5">
                로그인 차단 + 활성 예약 일시정지. 언제든 재활성화 가능.
              </p>
            </div>
            <button
              onClick={() => setSuspendOpen(true)}
              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-white border border-amber-300 hover:bg-amber-50 rounded-lg px-3 py-2"
            >
              <Ban className="size-3.5" aria-hidden="true" /> 비활성화
            </button>
          </div>
        )}

        {/* 재활성화 (suspended 인 경우) */}
        {member.status === 'suspended' && (
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-text-primary">계정 재활성화</h4>
              <p className="text-[12px] text-text-secondary mt-0.5">
                비활성 상태 해제. 로그인 가능 + 예약 권한 복원.
              </p>
              {member.suspended_reason && (
                <p className="text-[11px] text-text-tertiary mt-1">비활성 사유: {member.suspended_reason}</p>
              )}
            </div>
            <button
              onClick={handleUnsuspend}
              disabled={actioning}
              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-white border border-emerald-300 hover:bg-emerald-50 rounded-lg px-3 py-2 disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" /> 재활성화
            </button>
          </div>
        )}

        {/* 삭제 신청 (pending_deletion 이 아닌 경우만) */}
        {!isPendingDeletion && (
          <div className="flex items-start justify-between gap-4 pt-3 border-t border-red-100">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-700">계정 삭제 신청</h4>
              <p className="text-[12px] text-text-secondary mt-0.5">
                30일 후 개인정보 자동 파기. 거래기록은 5년 분리 보관.
              </p>
            </div>
            <button
              onClick={() => setDeleteOpen(true)}
              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg px-3 py-2"
            >
              <Trash2 className="size-3.5" aria-hidden="true" /> 삭제 신청
            </button>
          </div>
        )}
      </fieldset>

      <SuspendMemberModal
        isOpen={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        memberId={member.id}
        memberName={member.name}
        onSuccess={onRefresh}
      />
      <DeleteMemberModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        memberId={member.id}
        memberName={member.name}
        onSuccess={onRefresh}
      />
    </>
  );
}
