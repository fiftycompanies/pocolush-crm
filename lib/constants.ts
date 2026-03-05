export const INQUIRY_TYPES: Record<string, { label: string; color: string; emoji: string }> = {
  jaramter_inquiry:   { label: '자람터 분양',       color: '#3D6B47', emoji: '🌱' },
  janchimaru_consult: { label: '잔치마루 상담',     color: '#8B5468', emoji: '💐' },
  campnic_notify:     { label: '캠프닉 알림신청',   color: '#8B3A1A', emoji: '🔥' },
  kids_notify:        { label: '어린이놀이터 알림', color: '#4A7AC4', emoji: '🎠' },
};

export const INQUIRY_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  new:       { label: '신규',     color: '#3B82F6', bg: '#1D4ED820' },
  contacted: { label: '연락중',   color: '#F59E0B', bg: '#92400E20' },
  consulted: { label: '상담완료', color: '#8B5CF6', bg: '#5B21B620' },
  converted: { label: '계약완료', color: '#10B981', bg: '#06522420' },
  cancelled: { label: '취소',     color: '#6B7280', bg: '#37415120' },
};

export const STATUS_OPTIONS = Object.entries(INQUIRY_STATUS).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

export const TYPE_OPTIONS = Object.entries(INQUIRY_TYPES).map(([value, meta]) => ({
  value,
  label: `${meta.emoji} ${meta.label}`,
}));
