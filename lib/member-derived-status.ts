// 회원 파생 상태(derived status)
// members.status(가입 라이프사이클) + 활성 계약/회원권 현황을 결합해
// 리스트 행의 액션과 뱃지를 결정하는 단일 소스

export type MemberDerivedStatus =
  | 'pending'
  | 'approved_no_rental'
  | 'rental_no_membership'
  | 'active'
  | 'expired'
  | 'suspended'
  | 'withdrawn';

export interface MemberWithStatusRow {
  id: string;
  user_id: string | null;
  email: string | null;
  name: string;
  phone: string | null;
  address: string | null;
  member_status: 'pending' | 'approved' | 'suspended' | 'withdrawn';
  farming_experience: boolean | null;
  interested_crops: string[] | null;
  family_size: number | null;
  car_number: string | null;
  memo: string | null;
  agreed_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  withdrawal_requested_at: string | null;
  withdrawal_reason: string | null;
  created_at: string;
  updated_at: string;
  active_rental_count: number;
  active_membership_count: number;
  nearest_membership_end: string | null;
}

export function deriveMemberStatus(m: {
  member_status: MemberWithStatusRow['member_status'];
  active_rental_count: number;
  active_membership_count: number;
  nearest_membership_end: string | null;
}): MemberDerivedStatus {
  if (m.member_status === 'pending') return 'pending';
  if (m.member_status === 'withdrawn') return 'withdrawn';
  if (m.member_status === 'suspended') return 'suspended';
  if (m.active_rental_count === 0) return 'approved_no_rental';
  if (m.active_membership_count === 0) return 'rental_no_membership';
  if (
    m.nearest_membership_end &&
    new Date(m.nearest_membership_end) < new Date(new Date().toDateString())
  ) {
    return 'expired';
  }
  return 'active';
}

export const LABEL_OF: Record<MemberDerivedStatus, string> = {
  pending: '가입대기',
  approved_no_rental: '승인(계약전)',
  rental_no_membership: '회원권미발급',
  active: '계약활성',
  expired: '회원권만료',
  suspended: '정지',
  withdrawn: '탈퇴',
};

export const BADGE_CLASS: Record<MemberDerivedStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  approved_no_rental: 'bg-blue-50 text-blue-700 border border-blue-200',
  rental_no_membership: 'bg-orange-50 text-orange-700 border border-orange-200',
  active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  expired: 'bg-gray-100 text-gray-600 border border-gray-200',
  suspended: 'bg-red-50 text-red-700 border border-red-200',
  withdrawn: 'bg-gray-100 text-gray-500 border border-gray-200',
};

// 필터 탭 순서
export const DERIVED_FILTER_TABS: Array<{
  key: 'all' | MemberDerivedStatus;
  label: string;
}> = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '가입대기' },
  { key: 'approved_no_rental', label: '승인(계약전)' },
  { key: 'active', label: '계약활성' },
  { key: 'rental_no_membership', label: '회원권미발급' },
  { key: 'expired', label: '만료' },
  { key: 'suspended', label: '정지' },
  { key: 'withdrawn', label: '탈퇴' },
];

// 만료까지 남은 일수 (음수면 이미 지남)
export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  const now = new Date(new Date().toDateString()).getTime();
  return Math.floor((target - now) / (1000 * 60 * 60 * 24));
}
