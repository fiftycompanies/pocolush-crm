export interface Profile {
  id: string;
  name: string;
  role: 'admin' | 'staff';
  created_at: string;
  email?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  inquiry_count?: number;
  last_inquiry_at?: string;
}

export interface Inquiry {
  id: string;
  customer_id: string;
  type: string;
  status: InquiryStatus;
  assignee_id: string | null;
  data: Record<string, unknown> | null;
  tags: string[] | null;
  source: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  assignee?: Profile;
}

export type InquiryStatus = 'new' | 'contacted' | 'consulted' | 'converted' | 'cancelled';

export interface InquiryNote {
  id: string;
  inquiry_id: string;
  author_id: string;
  content: string;
  note_type: 'memo' | 'call' | 'visit' | 'status_change';
  created_at: string;
  author?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  inquiry_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface FarmZone {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  farms?: Farm[];
}

export interface Farm {
  id: string;
  number: number;
  name: string;
  area_pyeong: number;
  area_sqm: number;
  status: 'available' | 'rented' | 'maintenance';
  zone_id: string;
  position_x: number;
  position_y: number;
  notes?: string;
  created_at: string;
  zone?: FarmZone;
  current_rental?: FarmRental & { customer: Customer };
}

export interface FarmRental {
  id: string;
  farm_id: string;
  customer_id: string;
  member_id?: string;
  start_date: string;
  end_date: string;
  plan?: '씨앗' | '새싹' | '자람';
  monthly_fee: number;
  payment_method: '계좌이체' | '카드' | '현금';
  payment_status: '납부완료' | '미납' | '대기';
  status: 'active' | 'expired' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
  farm?: Farm;
  customer?: Customer;
}

export interface ExpiringRental extends FarmRental {
  days_until_expiry: number;
  farm: Farm;
  customer: Customer;
}

// ═══════════════════════════════════════
// 회원 서비스 타입
// ═══════════════════════════════════════

export type MemberStatus = 'pending' | 'approved' | 'suspended' | 'withdrawn';

export interface Member {
  id: string;
  user_id: string;
  email: string;
  name: string;
  phone: string;
  address: string;
  farming_experience: boolean;
  interested_crops: string[];
  family_size: number | null;
  car_number: string | null;
  memo: string | null;
  status: MemberStatus;
  agreed_at: string | null;
  push_token: string | null;
  push_platform: 'ios' | 'android' | 'web' | null;
  push_enabled: boolean;
  approved_at: string | null;
  approved_by: string | null;
  withdrawal_requested_at: string | null;
  withdrawal_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: string;
  member_id: string;
  membership_code: string;
  farm_id: string | null;
  plots: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'expired' | 'cancelled';
  benefits: string[];
  created_at: string;
  updated_at: string;
  member?: Member;
  farm?: Farm;
}

export interface BBQFacility {
  id: string;
  number: number;
  name: string;
  is_active: boolean;
  price: number;
  notes: string | null;
  created_at: string;
}

export type ReservationStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export interface BBQReservation {
  id: string;
  member_id: string;
  reservation_date: string;
  time_slot: 1 | 2 | 3;
  bbq_number: number;
  party_size: number;
  status: ReservationStatus;
  price: number;
  memo: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  member?: Member;
}

export interface StoreProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: 'service' | 'seed' | 'supply' | 'etc';
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled';

export interface ServiceOrder {
  id: string;
  member_id: string;
  product_id: string;
  farm_id: string | null;
  quantity: number;
  total_price: number;
  status: OrderStatus;
  payment_method: '계좌이체' | '카드' | '현금';
  payment_status: '대기' | '납부완료' | '미납';
  admin_note: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  member?: Member & { phone?: string };
  product?: StoreProduct;
}

export interface Coupon {
  id: string;
  name: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  target_service: string | null;
  valid_from: string | null;
  valid_until: string | null;
  max_issues: number | null;
  is_active: boolean;
  created_at: string;
  issued_count?: number;
}

export interface CouponIssue {
  id: string;
  coupon_id: string;
  member_id: string;
  coupon_code: string;
  status: 'issued' | 'used' | 'expired';
  used_at: string | null;
  used_by: string | null;
  requested_at: string;
  created_at: string;
  coupon?: Coupon;
  member?: Member;
}

export type NoticeCategory = 'notice' | 'orientation' | 'event' | 'info';

export interface Notice {
  id: string;
  title: string;
  content: string;
  category: NoticeCategory;
  is_published: boolean;
  is_push_sent: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  plots: number;
  price: number;
  duration_months: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type NotificationType = 'approval' | 'reservation' | 'reservation_cancel' | 'service_request' | 'service_complete' | 'coupon' | 'notice' | 'withdrawal';

export interface MemberNotification {
  id: string;
  member_id: string;
  title: string;
  message: string;
  type: NotificationType;
  reference_id: string | null;
  reference_type: string | null;
  is_read: boolean;
  created_at: string;
}
