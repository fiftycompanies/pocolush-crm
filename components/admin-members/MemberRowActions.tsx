'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Ban, Trash2, RotateCcw, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import SuspendMemberModal from './SuspendMemberModal';
import DeleteMemberModal from './DeleteMemberModal';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { MemberDerivedStatus } from '@/lib/member-derived-status';

interface Props {
  memberId: string;
  memberName: string;
  derived: MemberDerivedStatus;
  onAfterAction: () => void;
}

/**
 * 회원 리스트 행별 ⋮ 메뉴.
 * - 상세 보기
 * - 비활성화 (approved/active/expired/rental_no_membership 일 때)
 * - 재활성화 (suspended 일 때)
 * - 삭제 신청 (deleted/pending_deletion 외)
 * - 복원 (pending_deletion)
 */
export default function MemberRowActions({ memberId, memberName, derived, onAfterAction }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // 외부 클릭 + ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const canSuspend = ['approved_no_rental', 'rental_no_membership', 'active', 'expired'].includes(derived);
  const canUnsuspend = derived === 'suspended';
  const canDelete = derived !== 'deleted' && derived !== 'pending_deletion';
  const canRestore = derived === 'pending_deletion';
  const isDeleted = derived === 'deleted';

  const handleUnsuspend = async () => {
    if (!confirm(`${memberName} 회원을 재활성화하시겠습니까?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc('unsuspend_member', { p_member_id: memberId });
    setBusy(false);
    setOpen(false);
    if (error) {
      toast.error('재활성화 실패: ' + error.message);
      return;
    }
    toast.success(`${memberName} 재활성화 완료`);
    onAfterAction();
  };

  const handleRestore = async () => {
    if (!confirm(`${memberName} 회원의 삭제 신청을 취소하시겠습니까?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc('restore_member_deletion', { p_member_id: memberId });
    setBusy(false);
    setOpen(false);
    if (error) {
      toast.error('복원 실패: ' + error.message);
      return;
    }
    toast.success(`${memberName} 복원 완료`);
    onAfterAction();
  };

  return (
    <>
      <div className="relative inline-block">
        <button
          ref={triggerRef}
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
          aria-label={`${memberName} 액션 메뉴`}
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={busy}
          className="size-9 inline-flex items-center justify-center rounded-lg text-text-secondary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
        >
          <MoreVertical className="size-4" aria-hidden="true" />
        </button>

        {open && (
          <div
            ref={menuRef}
            role="menu"
            className="absolute right-0 top-full mt-1 w-44 bg-white border border-border rounded-lg shadow-lg py-1 z-30"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => { router.push(`/dashboard/members/${memberId}`); setOpen(false); }}
              className="w-full text-left text-xs px-3 py-2 hover:bg-accent flex items-center gap-2"
            >
              <Eye className="size-3.5 text-text-tertiary" aria-hidden="true" /> 상세 보기
            </button>

            {canSuspend && (
              <button
                type="button"
                role="menuitem"
                onClick={() => { setSuspendOpen(true); setOpen(false); }}
                className="w-full text-left text-xs px-3 py-2 hover:bg-amber-50 text-amber-700 flex items-center gap-2"
              >
                <Ban className="size-3.5" aria-hidden="true" /> 비활성화
              </button>
            )}

            {canUnsuspend && (
              <button
                type="button"
                role="menuitem"
                onClick={handleUnsuspend}
                disabled={busy}
                className="w-full text-left text-xs px-3 py-2 hover:bg-emerald-50 text-emerald-700 flex items-center gap-2 disabled:opacity-50"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" /> 재활성화
              </button>
            )}

            {canRestore && (
              <button
                type="button"
                role="menuitem"
                onClick={handleRestore}
                disabled={busy}
                className="w-full text-left text-xs px-3 py-2 hover:bg-orange-50 text-orange-700 flex items-center gap-2 disabled:opacity-50"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" /> 삭제 복원
              </button>
            )}

            {canDelete && (
              <>
                <div className="border-t border-border my-1" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setDeleteOpen(true); setOpen(false); }}
                  className="w-full text-left text-xs px-3 py-2 hover:bg-red-50 text-red-700 flex items-center gap-2"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" /> 삭제 신청
                </button>
              </>
            )}

            {isDeleted && (
              <p className="px-3 py-2 text-[11px] text-text-tertiary italic">
                마스킹 완료 (PIPA)
              </p>
            )}
          </div>
        )}
      </div>

      <SuspendMemberModal
        isOpen={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        memberId={memberId}
        memberName={memberName}
        onSuccess={onAfterAction}
      />
      <DeleteMemberModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        memberId={memberId}
        memberName={memberName}
        onSuccess={onAfterAction}
      />
    </>
  );
}
