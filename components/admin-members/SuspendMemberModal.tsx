'use client';

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { X, AlertTriangle } from 'lucide-react';
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

export default function SuspendMemberModal({ isOpen, onClose, memberId, memberName, onSuccess }: Props) {
  const supabase = createClient();
  const [reason, setReason] = useState<MemberActionReason | ''>('');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setReason('');
      setMemo('');
      setSubmitting(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => cancelRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const requiresMemo = reason === 'other';
  const canSubmit = reason && (!requiresMemo || memo.trim().length > 0) && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !reason) return;
    setSubmitting(true);
    const { error } = await supabase.rpc('suspend_member', {
      p_member_id: memberId,
      p_reason_category: reason,
      p_reason_memo: memo.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error('비활성화 실패: ' + error.message);
      return;
    }
    toast.success(`${memberName} 비활성화 완료`);
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
        aria-labelledby="suspend-title"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl w-[90vw] max-w-md z-50 shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-600" aria-hidden="true" />
            <h2 id="suspend-title" className="text-base font-semibold text-text-primary">회원 비활성화</h2>
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
            <strong className="text-text-primary">{memberName}</strong> 회원을 비활성화하시겠습니까?
          </p>
          <ul className="text-[12px] text-text-tertiary list-disc pl-4 space-y-0.5">
            <li>로그인 차단</li>
            <li>미래 예약 자동 취소</li>
            <li>언제든 재활성화 가능</li>
          </ul>

          <div>
            <label className="block text-xs font-medium text-text-primary mb-1.5">사유 <span className="text-red-500">*</span></label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value as MemberActionReason)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            >
              <option value="">선택하세요</option>
              {MEMBER_ACTION_REASONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {(requiresMemo || reason) && (
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1.5">
                메모 {requiresMemo && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={memo}
                onChange={e => setMemo(e.target.value)}
                rows={2}
                placeholder={requiresMemo ? '구체적 사유를 입력해주세요' : '추가 메모 (선택)'}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              ref={cancelRef}
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm text-text-secondary hover:bg-accent rounded-lg disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? '처리 중...' : '비활성화'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
