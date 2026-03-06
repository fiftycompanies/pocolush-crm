export const INQUIRY_TYPES: Record<string, { label: string; color: string; emoji: string }> = {
  jaramter_inquiry:   { label: '자람터 분양',       color: '#16A34A', emoji: '🌱' },
  janchimaru_consult: { label: '잔치마루 상담',     color: '#EC4899', emoji: '💐' },
  campnic_notify:     { label: '캠프닉 알림신청',   color: '#EA580C', emoji: '🔥' },
  kids_notify:        { label: '어린이놀이터 알림', color: '#3B82F6', emoji: '🎠' },
};

export const INQUIRY_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  new:       { label: '신규',     color: '#2563EB', bg: '#EFF6FF' },
  contacted: { label: '연락중',   color: '#D97706', bg: '#FFFBEB' },
  consulted: { label: '상담완료', color: '#7C3AED', bg: '#F5F3FF' },
  converted: { label: '계약완료', color: '#059669', bg: '#ECFDF5' },
  cancelled: { label: '취소',     color: '#6B7280', bg: '#F3F4F6' },
};

export const STATUS_OPTIONS = Object.entries(INQUIRY_STATUS).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

export const TYPE_OPTIONS = Object.entries(INQUIRY_TYPES).map(([value, meta]) => ({
  value,
  label: `${meta.emoji} ${meta.label}`,
}));

export const FARM_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  available:   { label: '비어있음', color: '#16A34A', bg: '#DCFCE7' },
  rented:      { label: '임대중',   color: '#059669', bg: '#ECFDF5' },
  maintenance: { label: '관리중',   color: '#6B7280', bg: '#F3F4F6' },
};

export const PAYMENT_METHODS = ['계좌이체', '카드', '현금'] as const;

export const PAYMENT_STATUS: Record<string, { color: string; bg: string }> = {
  '납부완료': { color: '#059669', bg: '#ECFDF5' },
  '미납':     { color: '#DC2626', bg: '#FEF2F2' },
  '대기':     { color: '#D97706', bg: '#FFFBEB' },
};

export const RENTAL_PLANS: Record<string, { area: string; fee: number }> = {
  '씨앗': { area: '1평', fee: 79000 },
  '새싹': { area: '2평', fee: 119000 },
  '자람': { area: '3평', fee: 179000 },
};

export const EXPIRY_WARNING_DAYS = 30;
export const EXPIRY_DANGER_DAYS = 7;

export const RENTAL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: '임대중', color: '#059669', bg: '#ECFDF5' },
  expired:   { label: '만료',   color: '#DC2626', bg: '#FEF2F2' },
  cancelled: { label: '취소',   color: '#6B7280', bg: '#F3F4F6' },
};
