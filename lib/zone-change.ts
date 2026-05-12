/**
 * 064 Zone 변경 — 사유 상수 + 타입
 */

export const ZONE_CHANGE_REASONS = [
  { value: 'member_request', label: '회원 요청' },
  { value: 'facility_issue', label: '시설 문제 (그늘/배수 등)' },
  { value: 'operational', label: '운영 조정' },
  { value: 'maintenance', label: '정비/공사' },
  { value: 'other', label: '기타 (메모 필수)' },
] as const;

export type ZoneChangeReason = typeof ZONE_CHANGE_REASONS[number]['value'];

export interface ValidateZoneChangeResult {
  ok: boolean;
  error_code: string | null;
  error_message: string | null;
  current_zone_name: string | null;
  current_farm_number: number | null;
  new_zone_name: string | null;
  new_farm_number: number | null;
  membership_end_date: string | null;
  conflict_member_id: string | null;
  conflict_member_name: string | null;
  pending_service_orders: number;
}

export interface AvailableFarm {
  farm_id: string;
  farm_number: number;
  zone_id: string;
  zone_name: string;
}
