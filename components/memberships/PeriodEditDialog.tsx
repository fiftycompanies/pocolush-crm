'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import Input from '@/components/ui/Input';
import type { Membership } from '@/types';

interface Props {
  open: boolean;
  membership: Membership;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PeriodEditDialog({ open, membership, onClose, onSuccess }: Props) {
  const supabase = createClient();
  const [startDate, setStartDate] = useState(membership.start_date);
  const [endDate, setEndDate] = useState(membership.end_date);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStartDate(membership.start_date);
    setEndDate(membership.end_date);
  }, [membership]);

  if (!open) return null;

  const handleUpdate = async () => {
    if (new Date(endDate) <= new Date(startDate)) {
      toast.error('종료일은 시작일 이후여야 합니다');
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc('update_membership_period', {
      p_membership_id: membership.id,
      p_start_date: startDate,
      p_end_date: endDate,
    });
    if (error) {
      const msg =
        error.message === 'FORBIDDEN' ? '권한이 없습니다' :
        error.message === 'INVALID_PERIOD' ? '유효하지 않은 기간입니다' :
        '기간 수정 실패: ' + error.message;
      toast.error(msg);
    } else {
      toast.success('기간이 수정되었습니다');
      onSuccess();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border rounded-2xl p-6 w-96 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">회원권 기간 수정</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-lg">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 mb-4">
          <Input
            label="시작일"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="종료일"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-xl text-sm">
            취소
          </button>
          <button
            onClick={handleUpdate}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-primary disabled:opacity-40"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
