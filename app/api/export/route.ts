import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createExcelBuffer, createExcelResponse, type ExcelColumn } from '@/lib/excel';
import {
  INQUIRY_TYPES,
  INQUIRY_STATUS,
  FARM_STATUS,
  RENTAL_STATUS,
  RENTAL_PLANS,
} from '@/lib/constants';
import { format } from 'date-fns';

// 전화번호 셀: 텍스트 강제 (010 → 10 변환 방지)
const PHONE_STYLE = { numFmt: '@' } as const;

const DATE_FMT = (v: string | null) =>
  v ? format(new Date(v), 'yyyy-MM-dd HH:mm') : '';

const DATE_ONLY = (v: string | null) =>
  v ? format(new Date(v), 'yyyy-MM-dd') : '';

// ═══════════════════════════════════════
// target별 설정
// ═══════════════════════════════════════

interface ExportConfig {
  sheetName: string;
  filename: string;
  columns: ExcelColumn[];
  query: (supabase: Awaited<ReturnType<typeof createClient>>, params: URLSearchParams) => Promise<unknown[]>;
  transform: (row: any) => Record<string, unknown>;
}

const MEMBER_STATUS_LABEL: Record<string, string> = {
  pending: '승인대기',
  approved: '승인',
  suspended: '정지',
  withdrawn: '탈퇴',
};

const NOTICE_CATEGORY_LABEL: Record<string, string> = {
  notice: '공지',
  orientation: '입주안내',
  event: '이벤트',
  info: '정보',
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: '대기',
  processing: '처리중',
  completed: '완료',
  cancelled: '취소',
};

const PRODUCT_CATEGORY_LABEL: Record<string, string> = {
  service: '서비스',
  seed: '씨앗/모종',
  supply: '농자재',
  etc: '기타',
};

const BBQ_TIME_SLOTS: Record<number, string> = {
  1: '10:00-13:00',
  2: '13:30-16:30',
  3: '17:00-20:00',
};

const BBQ_STATUS_LABEL: Record<string, string> = {
  confirmed: '예약확정',
  cancelled: '취소',
  completed: '이용완료',
  no_show: '노쇼',
};

const CONFIGS: Record<string, ExportConfig> = {
  // ─── 1. 문의 ───
  inquiries: {
    sheetName: '문의목록',
    filename: '포코러쉬_문의목록',
    columns: [
      { header: '유형', key: 'type_label', width: 18 },
      { header: '이름', key: 'name', width: 14 },
      { header: '연락처', key: 'phone', width: 16, style: PHONE_STYLE },
      { header: '상태', key: 'status_label', width: 12 },
      { header: '담당자', key: 'assignee_name', width: 12 },
      { header: '유입경로', key: 'source', width: 12 },
      { header: '접수일시', key: 'created_at', width: 18 },
      { header: '수정일시', key: 'updated_at', width: 18 },
    ],
    query: async (supabase, params) => {
      let q = supabase
        .from('inquiries')
        .select('*, customer:customers(*), assignee:profiles(*)')
        .order('created_at', { ascending: false });
      const type = params.get('type');
      const status = params.get('status');
      if (type) q = q.eq('type', type);
      if (status) q = q.eq('status', status);
      const { data } = await q;
      let rows = data || [];
      const search = params.get('search')?.toLowerCase();
      if (search) {
        rows = rows.filter(
          (r: any) =>
            r.customer?.name?.toLowerCase().includes(search) ||
            r.customer?.phone?.includes(search),
        );
      }
      return rows;
    },
    transform: (row) => ({
      type_label: INQUIRY_TYPES[row.type]?.label ?? row.type,
      name: row.customer?.name ?? '',
      phone: row.customer?.phone ?? '',
      status_label: INQUIRY_STATUS[row.status]?.label ?? row.status,
      assignee_name: row.assignee?.name ?? '',
      source: row.source ?? '',
      created_at: DATE_FMT(row.created_at),
      updated_at: DATE_FMT(row.updated_at),
    }),
  },

  // ─── 2. 고객 ───
  customers: {
    sheetName: '고객목록',
    filename: '포코러쉬_고객목록',
    columns: [
      { header: '이름', key: 'name', width: 14 },
      { header: '연락처', key: 'phone', width: 16, style: PHONE_STYLE },
      { header: '총 문의수', key: 'inquiry_count', width: 12 },
      { header: '첫 접촉일', key: 'created_at', width: 14 },
      { header: '최근 접촉일', key: 'last_inquiry_at', width: 14 },
    ],
    query: async (supabase, params) => {
      const { data: customers } = await supabase
        .from('customers')
        .select('*, inquiries:inquiries(created_at)')
        .order('created_at', { ascending: false });
      let rows = (customers || []).map((c: any) => ({
        ...c,
        inquiry_count: c.inquiries?.length ?? 0,
        last_inquiry_at:
          c.inquiries?.length > 0
            ? c.inquiries.sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))[0].created_at
            : null,
      }));
      const search = params.get('search')?.toLowerCase();
      if (search) {
        rows = rows.filter(
          (r: any) =>
            r.name?.toLowerCase().includes(search) ||
            r.phone?.includes(search),
        );
      }
      return rows;
    },
    transform: (row) => ({
      name: row.name ?? '',
      phone: row.phone ?? '',
      inquiry_count: row.inquiry_count ?? 0,
      created_at: DATE_ONLY(row.created_at),
      last_inquiry_at: DATE_ONLY(row.last_inquiry_at),
    }),
  },

  // ─── 3. 임대 계약 ───
  rentals: {
    sheetName: '임대계약',
    filename: '포코러쉬_임대계약',
    columns: [
      { header: '농장', key: 'farm_name', width: 14 },
      { header: '고객명', key: 'customer_name', width: 14 },
      { header: '연락처', key: 'phone', width: 16, style: PHONE_STYLE },
      { header: '플랜', key: 'plan', width: 10 },
      { header: '시작일', key: 'start_date', width: 14 },
      { header: '종료일', key: 'end_date', width: 14 },
      { header: '월 결제액', key: 'monthly_fee', width: 14 },
      { header: '결제상태', key: 'payment_status', width: 12 },
      { header: '상태', key: 'status_label', width: 10 },
    ],
    query: async (supabase, params) => {
      let q = supabase
        .from('farm_rentals')
        .select('*, farm:farms(number, name), customer:customers(name, phone)')
        .order('created_at', { ascending: false });
      const status = params.get('status');
      if (status) q = q.eq('status', status);
      const { data } = await q;
      let rows = data || [];
      const search = params.get('search')?.toLowerCase();
      if (search) {
        rows = rows.filter(
          (r: any) =>
            r.customer?.name?.toLowerCase().includes(search) ||
            r.customer?.phone?.includes(search),
        );
      }
      return rows;
    },
    transform: (row) => ({
      farm_name: row.farm ? `${row.farm.number}번 ${row.farm.name}` : '',
      customer_name: row.customer?.name ?? '',
      phone: row.customer?.phone ?? '',
      plan: row.plan ?? '',
      start_date: DATE_ONLY(row.start_date),
      end_date: DATE_ONLY(row.end_date),
      monthly_fee: row.monthly_fee ? `${Number(row.monthly_fee).toLocaleString()}원` : '',
      payment_status: row.payment_status ?? '',
      status_label: RENTAL_STATUS[row.status]?.label ?? row.status,
    }),
  },

  // ─── 4. 농장 ───
  farms: {
    sheetName: '농장관리',
    filename: '포코러쉬_농장관리',
    columns: [
      { header: '번호', key: 'number', width: 8 },
      { header: '이름', key: 'name', width: 14 },
      { header: '면적(평)', key: 'area_pyeong', width: 10 },
      { header: '면적(m²)', key: 'area_sqm', width: 10 },
      { header: '상태', key: 'status_label', width: 12 },
      { header: '임차인', key: 'renter', width: 14 },
      { header: '만료일', key: 'expiry', width: 14 },
    ],
    query: async (supabase) => {
      const { data } = await supabase
        .from('farms')
        .select('*, current_rental:farm_rentals(*, customer:customers(name))')
        .order('number', { ascending: true });
      return (data || []).map((f: any) => {
        const active = Array.isArray(f.current_rental)
          ? f.current_rental.find((r: any) => r.status === 'active')
          : f.current_rental?.status === 'active'
            ? f.current_rental
            : null;
        return { ...f, _active: active };
      });
    },
    transform: (row) => ({
      number: row.number,
      name: row.name ?? '',
      area_pyeong: row.area_pyeong,
      area_sqm: row.area_sqm,
      status_label: FARM_STATUS[row.status]?.label ?? row.status,
      renter: row._active?.customer?.name ?? '',
      expiry: row._active ? DATE_ONLY(row._active.end_date) : '',
    }),
  },

  // ─── 5. 회원 ───
  members: {
    sheetName: '회원목록',
    filename: '포코러쉬_회원목록',
    columns: [
      { header: '이름', key: 'name', width: 14 },
      { header: '연락처', key: 'phone', width: 16, style: PHONE_STYLE },
      { header: '이메일', key: 'email', width: 24 },
      { header: '상태', key: 'status_label', width: 10 },
      { header: '영농경험', key: 'farming_exp', width: 10 },
      { header: '관심작물', key: 'crops', width: 20 },
      { header: '가족수', key: 'family_size', width: 8 },
      { header: '가입일', key: 'created_at', width: 14 },
    ],
    query: async (supabase, params) => {
      let q = supabase.from('members').select('*').order('created_at', { ascending: false });
      const status = params.get('status');
      if (status) q = q.eq('status', status);
      const { data } = await q;
      let rows = data || [];
      const search = params.get('search')?.toLowerCase();
      if (search) {
        rows = rows.filter(
          (r: any) =>
            r.name?.toLowerCase().includes(search) ||
            r.phone?.includes(search) ||
            r.email?.toLowerCase().includes(search),
        );
      }
      return rows;
    },
    transform: (row) => ({
      name: row.name ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
      status_label: MEMBER_STATUS_LABEL[row.status] ?? row.status,
      farming_exp: row.farming_experience ? '있음' : '없음',
      crops: Array.isArray(row.interested_crops) ? row.interested_crops.join(', ') : '',
      family_size: row.family_size ?? '',
      created_at: DATE_ONLY(row.created_at),
    }),
  },

  // ─── 6. 블로그 ───
  blog: {
    sheetName: '블로그',
    filename: '포코러쉬_블로그',
    columns: [
      { header: '제목', key: 'title', width: 40 },
      { header: '카테고리', key: 'category', width: 14 },
      { header: '상태', key: 'status_label', width: 10 },
      { header: '조회수', key: 'view_count', width: 10 },
      { header: '작성일', key: 'created_at', width: 14 },
    ],
    query: async (supabase) => {
      const { data } = await supabase
        .from('posts')
        .select('*')
        .eq('site_id', 'pocolush')
        .order('created_at', { ascending: false });
      return data || [];
    },
    transform: (row) => ({
      title: row.title ?? '',
      category: row.category ?? '',
      status_label: row.published ? '발행됨' : '임시저장',
      view_count: row.view_count ?? 0,
      created_at: DATE_ONLY(row.created_at),
    }),
  },

  // ─── 7. 공지 ───
  notices: {
    sheetName: '공지사항',
    filename: '포코러쉬_공지사항',
    columns: [
      { header: '제목', key: 'title', width: 40 },
      { header: '카테고리', key: 'category_label', width: 14 },
      { header: '상태', key: 'status_label', width: 10 },
      { header: '작성일', key: 'created_at', width: 14 },
    ],
    query: async (supabase) => {
      const { data } = await supabase
        .from('notices')
        .select('*')
        .order('created_at', { ascending: false });
      return data || [];
    },
    transform: (row) => ({
      title: row.title ?? '',
      category_label: NOTICE_CATEGORY_LABEL[row.category] ?? row.category,
      status_label: row.is_published ? '발행' : '비공개',
      created_at: DATE_ONLY(row.created_at),
    }),
  },

  // ─── 8. 쿠폰 ───
  coupons: {
    sheetName: '쿠폰목록',
    filename: '포코러쉬_쿠폰목록',
    columns: [
      { header: '쿠폰명', key: 'name', width: 24 },
      { header: '할인', key: 'discount', width: 16 },
      { header: '유효기간 시작', key: 'valid_from', width: 14 },
      { header: '유효기간 종료', key: 'valid_until', width: 14 },
      { header: '상태', key: 'status_label', width: 10 },
    ],
    query: async (supabase) => {
      const { data } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });
      return data || [];
    },
    transform: (row) => ({
      name: row.name ?? '',
      discount:
        row.discount_type === 'percentage'
          ? `${row.discount_value}%`
          : `${Number(row.discount_value).toLocaleString()}원`,
      valid_from: DATE_ONLY(row.valid_from),
      valid_until: DATE_ONLY(row.valid_until),
      status_label: row.is_active ? '활성' : '비활성',
    }),
  },

  // ─── 8-2. 쿠폰 발급 현황 ───
  coupon_issues: {
    sheetName: '쿠폰발급현황',
    filename: '포코러쉬_쿠폰발급현황',
    columns: [
      { header: '쿠폰코드', key: 'coupon_code', width: 18 },
      { header: '쿠폰명', key: 'coupon_name', width: 24 },
      { header: '회원', key: 'member_name', width: 14 },
      { header: '상태', key: 'status_label', width: 10 },
      { header: '발급일', key: 'created_at', width: 14 },
      { header: '사용일', key: 'used_at', width: 14 },
    ],
    query: async (supabase, params) => {
      const { data } = await supabase
        .from('coupon_issues')
        .select('*, coupon:coupons(name), member:members(name)')
        .order('created_at', { ascending: false });
      let rows = data || [];
      const search = params.get('search')?.toLowerCase();
      if (search) {
        rows = rows.filter((r: any) => r.coupon_code?.toLowerCase().includes(search));
      }
      return rows;
    },
    transform: (row) => {
      const statusMap: Record<string, string> = { issued: '발급', used: '사용', expired: '만료' };
      return {
        coupon_code: row.coupon_code ?? '',
        coupon_name: row.coupon?.name ?? '',
        member_name: row.member?.name ?? '',
        status_label: statusMap[row.status] ?? row.status,
        created_at: DATE_ONLY(row.created_at),
        used_at: DATE_ONLY(row.used_at),
      };
    },
  },

  // ─── 9. 바베큐 예약 ───
  bbq: {
    sheetName: '바베큐예약',
    filename: '포코러쉬_바베큐예약',
    columns: [
      { header: '예약일', key: 'reservation_date', width: 14 },
      { header: '타임', key: 'time_slot_label', width: 16 },
      { header: '장소', key: 'bbq_number', width: 10 },
      { header: '예약자', key: 'member_name', width: 14 },
      { header: '연락처', key: 'phone', width: 16, style: PHONE_STYLE },
      { header: '인원', key: 'party_size', width: 8 },
      { header: '상태', key: 'status_label', width: 12 },
    ],
    query: async (supabase, params) => {
      let q = supabase
        .from('bbq_reservations')
        .select('*, member:members(name, phone)')
        .order('reservation_date', { ascending: false });
      const date = params.get('date');
      const status = params.get('status');
      if (date) q = q.eq('reservation_date', date);
      if (status) q = q.eq('status', status);
      const { data } = await q;
      let rows = data || [];
      const search = params.get('search')?.toLowerCase();
      if (search) {
        rows = rows.filter(
          (r: any) =>
            r.member?.name?.toLowerCase().includes(search) ||
            r.member?.phone?.includes(search),
        );
      }
      return rows;
    },
    transform: (row) => ({
      reservation_date: DATE_ONLY(row.reservation_date),
      time_slot_label: BBQ_TIME_SLOTS[row.time_slot] ?? `타임${row.time_slot}`,
      bbq_number: `${row.bbq_number}번`,
      member_name: row.member?.name ?? '',
      phone: row.member?.phone ?? '',
      party_size: row.party_size,
      status_label: BBQ_STATUS_LABEL[row.status] ?? row.status,
    }),
  },

  // ─── 10. 서비스 신청 ───
  orders: {
    sheetName: '서비스신청',
    filename: '포코러쉬_서비스신청',
    columns: [
      { header: '신청자', key: 'member_name', width: 14 },
      { header: '상품', key: 'product_name', width: 24 },
      { header: '수량', key: 'quantity', width: 8 },
      { header: '금액', key: 'total_price', width: 14 },
      { header: '상태', key: 'status_label', width: 10 },
      { header: '신청일', key: 'created_at', width: 14 },
    ],
    query: async (supabase, params) => {
      let q = supabase
        .from('service_orders')
        .select('*, member:members(name), product:store_products(name)')
        .order('created_at', { ascending: false });
      const status = params.get('status');
      if (status) q = q.eq('status', status);
      const { data } = await q;
      return data || [];
    },
    transform: (row) => ({
      member_name: row.member?.name ?? '',
      product_name: row.product?.name ?? '',
      quantity: row.quantity,
      total_price: `${Number(row.total_price).toLocaleString()}원`,
      status_label: ORDER_STATUS_LABEL[row.status] ?? row.status,
      created_at: DATE_ONLY(row.created_at),
    }),
  },

  // ─── 11. 스토어 상품 ───
  products: {
    sheetName: '상품목록',
    filename: '포코러쉬_상품목록',
    columns: [
      { header: '상품명', key: 'name', width: 24 },
      { header: '카테고리', key: 'category_label', width: 14 },
      { header: '가격', key: 'price', width: 14 },
      { header: '상태', key: 'status_label', width: 10 },
    ],
    query: async (supabase) => {
      const { data } = await supabase
        .from('store_products')
        .select('*')
        .order('sort_order', { ascending: true });
      return data || [];
    },
    transform: (row) => ({
      name: row.name ?? '',
      category_label: PRODUCT_CATEGORY_LABEL[row.category] ?? row.category,
      price: `${Number(row.price).toLocaleString()}원`,
      status_label: row.is_active ? '판매중' : '비활성',
    }),
  },
};

// ═══════════════════════════════════════
// API Handler
// ═══════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response('인증이 필요합니다', { status: 401 });
    }

    // admin 권한 확인 (profiles 테이블)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      return new Response('관리자 권한이 필요합니다', { status: 403 });
    }

    // target 파라미터
    const params = request.nextUrl.searchParams;
    const target = params.get('target');

    if (!target || !CONFIGS[target]) {
      return new Response(
        `잘못된 target입니다. 유효 값: ${Object.keys(CONFIGS).join(', ')}`,
        { status: 400 },
      );
    }

    const config = CONFIGS[target];

    // 데이터 조회
    const rawRows = await config.query(supabase, params);

    // 변환
    const rows = rawRows.map(config.transform);

    // 엑셀 생성
    const today = format(new Date(), 'yyyy-MM-dd');
    const buffer = await createExcelBuffer({
      sheetName: config.sheetName,
      columns: config.columns,
      rows,
    });

    return createExcelResponse(buffer, `${config.filename}_${today}`);
  } catch (err) {
    console.error('[export] error:', err);
    return new Response('엑셀 생성 중 오류가 발생했습니다', { status: 500 });
  }
}
