'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { MEMBER_STATUS } from '@/lib/member-constants';
import toast from 'react-hot-toast';
import type { Member, MemberStatus } from '@/types';

interface Props {
  open: boolean;
  member: Member | null;
  newStatus: MemberStatus | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StatusChangeModal({ open, member, newStatus, onClose, onSuccess }: Props) {
  const supabase = createClient();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChange = async () => {
    if (!member || !newStatus) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.rpc('change_member_status', {
      p_member_id: member.id,
      p_new_status: newStatus,
      p_reason: reason.trim() || null,
      p_changed_by: user?.id || null,
    });

    if (error) {
      toast.error(error.message === 'MEMBER_NOT_FOUND' ? '회원을 찾을 수 없습니다.' : '상태 변경에 실패했습니다.');
    } else {
      toast.success('상태가 변경되었습니다.');
      onSuccess();
      onClose();
      setReason('');
    }
    setSaving(false);
  };

  if (!open || !member || !newStatus) return null;

  const fromLabel = MEMBER_STATUS[member.status]?.label || member.status;
  const toLabel = MEMBER_STATUS[newStatus]?.label || newStatus;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border rounded-2xl p-6 w-96 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">회원 상태 변경</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-lg"><X className="size-4" /></button>
        </div>

        <p className="text-sm text-text-secondary mb-4">
          <span className="font-semibold text-text-primary">{member.name}</span> 님의 상태를<br/>
          <span className="font-semibold">[{fromLabel}]</span> → <span className="font-semibold text-primary">[{toLabel}]</span> 로 변경합니다.
        </p>

        {newStatus === 'suspended' && (
          <p className="text-xs text-yellow-700 bg-yellow-50 rounded-lg p-2.5 mb-3">
            정지 시 미래 BBQ 예약이 자동 취소되고, 활성 멤버십이 일시정지됩니다.
          </p>
        )}

        <div className="mb-4">
          <label className="text-xs font-medium text-text-secondary mb-1 block">사유 (선택)</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="변경 사유를 입력해주세요."
            className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" />
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-xl text-sm">취소</button>
          <button onClick={handleChange} disabled={saving}
            className={`px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40 ${
              newStatus === 'suspended' || newStatus === 'withdrawn' ? 'bg-red' : 'bg-primary'
            }`}>
            {saving ? '변경 중...' : '변경'}
          </button>
        </div>
      </div>
    </div>
  );
}
