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

export interface Farm {
  id: string;
  number: number;
  name: string;
  area_pyeong: number;
  area_sqm: number;
  status: 'available' | 'rented' | 'maintenance';
  position_x: number;
  position_y: number;
  notes?: string;
  created_at: string;
  current_rental?: FarmRental & { customer: Customer };
}

export interface FarmRental {
  id: string;
  farm_id: string;
  customer_id: string;
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
