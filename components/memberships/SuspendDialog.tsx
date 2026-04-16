'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';

interface Props {
  open: boolean;
  membershipId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SuspendDialog({ open, membershipId, onClose, onSuccess }: Props) {
  const supabase = createClient();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSuspend = async () => {
    setSaving(true);
    const { error } = await supabase.rpc('suspend_membership', {
      p_membership_id: membershipId,
      p_reason: reason.trim() || null,
    });
    if (error) {
      toast.error(error.message === 'FORBIDDEN' ? '권한이 없습니다' : '정지 실패: ' + error.message);
    } else {
      toast.success('회원권이 정지되었습니다');
      setReason('');
      onSuccess();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border rounded-2xl p-6 w-96 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">회원권 정지</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-lg">
            <X className="size-4" />
          </button>
        </div>

        <p className="text-xs text-yellow-700 bg-yellow-50 rounded-lg p-2.5 mb-3">
          정지된 회원권은 &apos;재개&apos; 버튼으로 복원할 수 있습니다 (만료일 이전에 한함).
        </p>

        <div className="mb-4">
          <label className="text-xs font-medium text-text-secondary mb-1 block">사유 (선택)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="정지 사유를 입력해주세요."
            className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary resize-none"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-xl text-sm">
            취소
          </button>
          <button
            onClick={handleSuspend}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red disabled:opacity-40"
          >
            {saving ? '처리 중...' : '정지'}
          </button>
        </div>
      </div>
    </div>
  );
}
