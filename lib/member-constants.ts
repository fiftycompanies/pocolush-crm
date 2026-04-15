// 회원 서비스 상수

export const MEMBER_STATUS = {
  pending: { label: '승인대기', color: '#D97706', bg: '#FFFBEB' },
  approved: { label: '승인', color: '#059669', bg: '#ECFDF5' },
  suspended: { label: '정지', color: '#DC2626', bg: '#FEF2F2' },
  withdrawn: { label: '탈퇴', color: '#6B7280', bg: '#F3F4F6' },
} as const;

export const RESERVATION_STATUS = {
  confirmed: { label: '예약확정', color: '#059669', bg: '#ECFDF5' },
  cancelled: { label: '취소', color: '#6B7280', bg: '#F3F4F6' },
  completed: { label: '이용완료', color: '#3B82F6', bg: '#EFF6FF' },
  no_show: { label: '노쇼', color: '#DC2626', bg: '#FEF2F2' },
} as const;

export const TIME_SLOTS = {
  1: { label: '1타임', time: '11:00 ~ 13:50' },
  2: { label: '2타임', time: '14:00 ~ 16:50' },
  3: { label: '3타임', time: '17:00 ~ 19:50' },
} as const;

export const ORDER_STATUS = {
  pending: { label: '대기', color: '#D97706', bg: '#FFFBEB' },
  processing: { label: '처리중', color: '#3B82F6', bg: '#EFF6FF' },
  completed: { label: '완료', color: '#059669', bg: '#ECFDF5' },
  cancelled: { label: '취소', color: '#6B7280', bg: '#F3F4F6' },
} as const;

export const PAYMENT_STATUS = {
  '대기': { label: '대기', color: '#D97706', bg: '#FFFBEB' },
  '납부완료': { label: '납부완료', color: '#059669', bg: '#ECFDF5' },
  '미납': { label: '미납', color: '#DC2626', bg: '#FEF2F2' },
} as const;

export const PRODUCT_CATEGORIES = {
  service: { label: '농장 관리', emoji: '🌱' },
  seed: { label: '씨앗', emoji: '🌰' },
  supply: { label: '농자재', emoji: '🧰' },
  etc: { label: '기타', emoji: '📦' },
} as const;

export const COUPON_STATUS = {
  issued: { label: '발급됨', color: '#3B82F6', bg: '#EFF6FF' },
  used: { label: '사용완료', color: '#6B7280', bg: '#F3F4F6' },
  expired: { label: '만료', color: '#DC2626', bg: '#FEF2F2' },
} as const;

export const NOTICE_CATEGORIES = {
  notice: { label: '공지', color: '#3B82F6', bg: '#EFF6FF' },
  orientation: { label: '오리엔테이션', color: '#059669', bg: '#ECFDF5' },
  event: { label: '이벤트', color: '#D97706', bg: '#FFFBEB' },
  info: { label: '안내', color: '#8B5CF6', bg: '#F5F3FF' },
} as const;

export const NOTIFICATION_TYPES = {
  approval: { label: '회원 승인', icon: '✅' },
  reservation: { label: '예약 확정', icon: '📅' },
  reservation_cancel: { label: '예약 취소', icon: '❌' },
  service_request: { label: '서비스 신청', icon: '📩' },
  service_complete: { label: '서비스 완료', icon: '✅' },
  coupon: { label: '쿠폰 발급', icon: '🎟️' },
  notice: { label: '공지사항', icon: '📢' },
  withdrawal: { label: '탈퇴 신청', icon: '👋' },
} as const;

export const DEFAULT_BENEFITS = [
  '풀빌라 평일 객실 이용료 50% 할인 (성수기 제외)',
  '워터룸 5만원 할인권',
  '어린이 놀이터 무료 이용',
  '동물 먹이주기 체험 무료 이용',
  '전기·수도·농기구 무상이용',
];
