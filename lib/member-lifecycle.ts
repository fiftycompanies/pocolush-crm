/**
 * 063 회원 라이프사이클 — RPC 호출 + 사유 상수
 * 풀스택 권고: 어드민 1-2명 환경, 사유 5종, 30일 grace
 */

import type { MemberActionReason } from '@/types';

export const MEMBER_ACTION_REASONS: { value: MemberActionReason; label: string; requiresMemo?: boolean }[] = [
  { value: 'member_request', label: '회원 요청' },
  { value: 'long_inactive', label: '장기 미사용' },
  { value: 'abuse', label: '부정사용' },
  { value: 'duplicate', label: '중복가입' },
  { value: 'other', label: '기타 (메모 필수)', requiresMemo: true },
];

export const MEMBER_STATUS_LABELS = {
  pending: { label: '승인 대기', color: '#F59E0B', bg: '#FEF3C7' },
  approved: { label: '정상', color: '#16A34A', bg: '#DCFCE7' },
  suspended: { label: '비활성화', color: '#64748B', bg: '#F1F5F9' },
  pending_deletion: { label: '삭제 대기', color: '#EA580C', bg: '#FFEDD5' },
  deleted: { label: '삭제됨', color: '#DC2626', bg: '#FEE2E2' },
} as const;

/** 30일 grace 남은 일수 계산 */
export function daysUntilPurge(deletionRequestedAt: string | null): number | null {
  if (!deletionRequestedAt) return null;
  const requested = new Date(deletionRequestedAt).getTime();
  const purgeAt = requested + 30 * 24 * 60 * 60 * 1000;
  const remaining = Math.ceil((purgeAt - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(0, remaining);
}
