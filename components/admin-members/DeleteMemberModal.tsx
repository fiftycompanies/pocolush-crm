'use client';

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { X, AlertOctagon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { MEMBER_ACTION_REASONS } from '@/lib/member-lifecycle';
import type { MemberActionReason } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  onSuccess: () => void;
}

/**
 * 회원 삭제 신청 (30일 grace) — 3단계 confirm
 * - 사유 선택 + 이름 정확 일치 입력 → 빨강 버튼 활성
 * - 기본 포커스: 이름 입력 필드 (Enter 한 번 삭제 차단)
 */
export default function DeleteMemberModal({ isOpen, onClose, memberId, memberName, onSuccess }: Props) {
  const supabase = createClient();
  const [reason, setReason] = useState<MemberActionReason | ''>('');
  const [memo, setMemo] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setReason(''); setMemo(''); setConfirmName(''); setSubmitting(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    // 의도적으로 이름 필드에 포커스 → Enter 한 번 삭제 방지
    requestAnimationFrame(() => nameInputRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const requiresMemo = reason === 'other';
  const nameMatches = confirmName.trim() === memberName;
  const canSubmit = reason && nameMatches && (!requiresMemo || memo.trim().length > 0) && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !reason) return;
    setSubmitting(true);
    const { error } = await supabase.rpc('request_member_deletion', {
      p_member_id: memberId,
      p_reason_category: reason,
      p_reason_memo: memo.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error('삭제 신청 실패: ' + error.message);
      return;
    }
    toast.success(`${memberName} 삭제 신청 완료 (30일 grace)`);
    onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl w-[90vw] max-w-md z-50 shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-red-100 bg-red-50/50">
          <div className="flex items-center gap-2">
            <AlertOctagon className="size-5 text-red-600" aria-hidden="true" />
            <h2 id="delete-title" className="text-base font-semibold text-red-900">계정 삭제 신청</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="size-10 inline-flex items-center justify-center rounded-lg text-text-secondary hover:bg-accent"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-text-secondary">
            <strong className="text-text-primary">{memberName}</strong> 회원의 삭제를 신청합니다.
          </p>
          <ul className="text-[12px] text-text-tertiary list-disc pl-4 space-y-0.5">
            <li><strong className="text-text-primary">30일 후 개인정보 자동 파기</strong> (PIPA)</li>
            <li>거래·정산 기록은 5년 분리 보관 (전자상거래법)</li>
            <li>30일 내 [복원] 가능</li>
            <li>활성 멤버십 자동 취소 (수동 재발급 필요)</li>
          </ul>

          <div>
            <label className="block text-xs font-medium text-text-primary mb-1.5">사유 <span className="text-red-500">*</span></label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value as MemberActionReason)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10"
            >
              <option value="">선택하세요</option>
              {MEMBER_ACTION_REASONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {requiresMemo && (
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1.5">
                메모 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={memo}
                onChange={e => setMemo(e.target.value)}
                rows={2}
                placeholder="구체적 사유를 입력해주세요"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:border-red-500"
              />
            </div>
          )}

          <div>
            <label htmlFor="confirm-name" className="block text-xs font-medium text-text-primary mb-1.5">
              확인을 위해 회원명 <strong className="text-red-600">{memberName}</strong> 을(를) 입력하세요 <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              id="confirm-name"
              type="text"
              value={confirmName}
              onChange={e => setConfirmName(e.target.value)}
              placeholder={memberName}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10"
              autoComplete="off"
            />
            {confirmName.length > 0 && !nameMatches && (
              <p className="text-[11px] text-red-600 mt-1">이름이 일치하지 않습니다</p>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm text-text-secondary hover:bg-accent rounded-lg disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '처리 중...' : '삭제 신청'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
