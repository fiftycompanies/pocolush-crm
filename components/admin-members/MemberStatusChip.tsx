'use client';

import { MEMBER_STATUS_LABELS } from '@/lib/member-lifecycle';
import type { MemberStatus } from '@/types';
import { daysUntilPurge } from '@/lib/member-lifecycle';

interface Props {
  status: MemberStatus;
  deletionRequestedAt?: string | null;
  size?: 'sm' | 'md';
}

export default function MemberStatusChip({ status, deletionRequestedAt, size = 'md' }: Props) {
  const meta = MEMBER_STATUS_LABELS[status];
  const daysLeft = status === 'pending_deletion' ? daysUntilPurge(deletionRequestedAt ?? null) : null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-2.5 py-1'
      }`}
      style={{ color: meta.color, backgroundColor: meta.bg }}
      aria-label={`회원 상태: ${meta.label}`}
    >
      {meta.label}
      {daysLeft !== null && (
        <span className="text-[10px] opacity-80">D-{daysLeft}</span>
      )}
    </span>
  );
}
