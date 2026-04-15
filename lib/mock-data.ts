import type { Customer, Inquiry, Farm, FarmRental, DailyCount } from '@/types'

export const MOCK_CUSTOMERS: Customer[] = [
  { id: 'c001', name: '김민준', phone: '010-1234-5678', created_at: '2024-11-05T09:00:00Z' },
  { id: 'c002', name: '이서연', phone: '010-2345-6789', created_at: '2024-11-25T10:00:00Z' },
  { id: 'c003', name: '박지훈', phone: '010-3456-7890', created_at: '2024-12-05T11:00:00Z' },
  { id: 'c004', name: '최수아', phone: '010-4567-8901', created_at: '2024-12-15T09:30:00Z' },
  { id: 'c005', name: '정우진', phone: '010-5678-9012', created_at: '2024-12-20T14:00:00Z' },
  { id: 'c006', name: '강예린', phone: '010-6789-0123', created_at: '2025-01-04T10:00:00Z' },
  { id: 'c007', name: '윤도현', phone: '010-7890-1234', created_at: '2025-01-19T09:00:00Z' },
  { id: 'c008', name: '장하늘', phone: '010-8901-2345', created_at: '2025-02-03T11:30:00Z' },
  { id: 'c009', name: '임소희', phone: '010-9012-3456', created_at: '2025-02-13T15:00:00Z' },
  { id: 'c010', name: '한재원', phone: '010-0123-4567', created_at: '2025-02-19T09:00:00Z' },
  { id: 'c011', name: '오지은', phone: '010-1357-2468', created_at: '2025-02-26T10:00:00Z' },
  { id: 'c012', name: '신현우', phone: '010-2468-1357', created_at: '2025-03-03T13:00:00Z' },
]

export const MOCK_INQUIRIES: (Inquiry & { customer: Customer })[] = [
  {
    id: 'i001', customer_id: 'c001', type: 'jaramter_inquiry', status: 'converted',
    assignee_id: null, tags: null,
    data: { plan: '새싹', message: '아이 둘이라 2평 희망합니다' },
    source: 'website', created_at: '2024-11-09T10:00:00Z', updated_at: '2024-11-11T14:00:00Z',
    customer: MOCK_CUSTOMERS[0],
  },
  {
    id: 'i002', customer_id: 'c002', type: 'jaramter_inquiry', status: 'converted',
    assignee_id: null, tags: null,
    data: { plan: '자람', message: '3평으로 넉넉하게 하고 싶어요' },
    source: 'website', created_at: '2024-11-29T11:00:00Z', updated_at: '2024-12-01T09:00:00Z',
    customer: MOCK_CUSTOMERS[1],
  },
  {
    id: 'i003', customer_id: 'c003', type: 'jaramter_inquiry', status: 'consulted',
    assignee_id: null, tags: null,
    data: { plan: '씨앗', message: '처음 해보는 거라 작게 시작하려고요' },
    source: 'website', created_at: '2024-12-09T14:00:00Z', updated_at: '2024-12-12T10:00:00Z',
    customer: MOCK_CUSTOMERS[2],
  },
  {
    id: 'i004', customer_id: 'c005', type: 'jaramter_inquiry', status: 'contacted',
    assignee_id: null, tags: null,
    data: { plan: '새싹', message: '주말에만 관리 가능한데 괜찮은가요?' },
    source: 'website', created_at: '2024-12-24T09:00:00Z', updated_at: '2024-12-26T11:00:00Z',
    customer: MOCK_CUSTOMERS[4],
  },
  {
    id: 'i005', customer_id: 'c007', type: 'jaramter_inquiry', status: 'new',
    assignee_id: null, tags: null,
    data: { plan: '새싹', message: '분양 가능한 자리 남아있나요?' },
    source: 'website', created_at: '2025-03-02T09:30:00Z', updated_at: '2025-03-02T09:30:00Z',
    customer: MOCK_CUSTOMERS[6],
  },
  {
    id: 'i006', customer_id: 'c010', type: 'jaramter_inquiry', status: 'new',
    assignee_id: null, tags: null,
    data: { plan: '자람', message: '가족이 4명인데 3평이면 충분할까요?' },
    source: 'website', created_at: '2025-02-23T16:00:00Z', updated_at: '2025-02-23T16:00:00Z',
    customer: MOCK_CUSTOMERS[9],
  },
  {
    id: 'i007', customer_id: 'c011', type: 'jaramter_inquiry', status: 'new',
    assignee_id: null, tags: null,
    data: { plan: '씨앗', message: '체험 프로그램도 같이 신청 가능한가요?' },
    source: 'website', created_at: '2025-02-28T11:00:00Z', updated_at: '2025-02-28T11:00:00Z',
    customer: MOCK_CUSTOMERS[10],
  },
  {
    id: 'i008', customer_id: 'c012', type: 'jaramter_inquiry', status: 'new',
    assignee_id: null, tags: null,
    data: { plan: '새싹', message: '빠른 연락 부탁드립니다' },
    source: 'website', created_at: '2025-03-04T08:00:00Z', updated_at: '2025-03-04T08:00:00Z',
    customer: MOCK_CUSTOMERS[11],
  },
  {
    id: 'i009', customer_id: 'c004', type: 'janchimaru_consult', status: 'consulted',
    assignee_id: null, tags: null,
    data: { eventType: '칠순잔치', message: '어머니 칠순이라 야외에서 하고 싶어요. 약 50명 규모입니다.' },
    source: 'website', created_at: '2024-12-17T10:00:00Z', updated_at: '2024-12-19T14:00:00Z',
    customer: MOCK_CUSTOMERS[3],
  },
  {
    id: 'i010', customer_id: 'c006', type: 'janchimaru_consult', status: 'contacted',
    assignee_id: null, tags: null,
    data: { eventType: '야외 결혼식', message: '내년 봄 야외 결혼식 공간 문의드립니다. 80명 규모로 계획 중입니다.' },
    source: 'website', created_at: '2025-01-09T11:00:00Z', updated_at: '2025-01-11T09:00:00Z',
    customer: MOCK_CUSTOMERS[5],
  },
  {
    id: 'i011', customer_id: 'c009', type: 'janchimaru_consult', status: 'new',
    assignee_id: null, tags: null,
    data: { eventType: '회갑연', message: '아버지 환갑잔치입니다. 가능한 날짜 알려주세요.' },
    source: 'website', created_at: '2025-02-15T14:00:00Z', updated_at: '2025-02-15T14:00:00Z',
    customer: MOCK_CUSTOMERS[8],
  },
  {
    id: 'i012', customer_id: 'c012', type: 'janchimaru_consult', status: 'new',
    assignee_id: null, tags: null,
    data: { eventType: '돌잔치', message: '야외 돌잔치 가능한지 문의드립니다' },
    source: 'website', created_at: '2025-03-04T10:00:00Z', updated_at: '2025-03-04T10:00:00Z',
    customer: MOCK_CUSTOMERS[11],
  },
  {
    id: 'i013', customer_id: 'c008', type: 'campnic_notify', status: 'new',
    assignee_id: null, tags: null,
    data: {}, source: 'website',
    created_at: '2025-02-08T09:00:00Z', updated_at: '2025-02-08T09:00:00Z',
    customer: MOCK_CUSTOMERS[7],
  },
  {
    id: 'i014', customer_id: 'c010', type: 'campnic_notify', status: 'new',
    assignee_id: null, tags: null,
    data: {}, source: 'website',
    created_at: '2025-02-21T10:00:00Z', updated_at: '2025-02-21T10:00:00Z',
    customer: MOCK_CUSTOMERS[9],
  },
  {
    id: 'i015', customer_id: 'c011', type: 'kids_notify', status: 'new',
    assignee_id: null, tags: null,
    data: {}, source: 'website',
    created_at: '2025-02-27T15:00:00Z', updated_at: '2025-02-27T15:00:00Z',
    customer: MOCK_CUSTOMERS[10],
  },
  {
    id: 'i016', customer_id: 'c012', type: 'kids_notify', status: 'new',
    assignee_id: null, tags: null,
    data: {}, source: 'website',
    created_at: '2025-03-03T11:00:00Z', updated_at: '2025-03-03T11:00:00Z',
    customer: MOCK_CUSTOMERS[11],
  },
]

export const MOCK_FARMS: Farm[] = [
  { id: 'f01', number: 1, name: '1번 농장', area_pyeong: 3.0, area_sqm: 9.92, status: 'rented', zone_id: 'z01', position_x: 0, position_y: 0, created_at: '2024-01-01T00:00:00Z' },
  { id: 'f02', number: 2, name: '2번 농장', area_pyeong: 2.5, area_sqm: 8.26, status: 'rented', zone_id: 'z01', position_x: 1, position_y: 0, created_at: '2024-01-01T00:00:00Z' },
  { id: 'f03', number: 3, name: '3번 농장', area_pyeong: 4.0, area_sqm: 13.22, status: 'rented', zone_id: 'z01', position_x: 2, position_y: 0, created_at: '2024-01-01T00:00:00Z' },
  { id: 'f04', number: 4, name: '4번 농장', area_pyeong: 2.0, area_sqm: 6.61, status: 'available', zone_id: 'z01', position_x: 3, position_y: 0, created_at: '2024-01-01T00:00:00Z' },
  { id: 'f05', number: 5, name: '5번 농장', area_pyeong: 3.5, area_sqm: 11.57, status: 'rented', zone_id: 'z01', position_x: 4, position_y: 0, created_at: '2024-01-01T00:00:00Z' },
  { id: 'f06', number: 6, name: '6번 농장', area_pyeong: 5.0, area_sqm: 16.53, status: 'rented', zone_id: 'z01', position_x: 0, position_y: 1, created_at: '2024-01-01T00:00:00Z' },
  { id: 'f07', number: 7, name: '7번 농장', area_pyeong: 2.5, area_sqm: 8.26, status: 'available', zone_id: 'z01', position_x: 1, position_y: 1, created_at: '2024-01-01T00:00:00Z' },
  { id: 'f08', number: 8, name: '8번 농장', area_pyeong: 3.0, area_sqm: 9.92, status: 'rented', zone_id: 'z01', position_x: 2, position_y: 1, created_at: '2024-01-01T00:00:00Z' },
  { id: 'f09', number: 9, name: '9번 농장', area_pyeong: 2.0, area_sqm: 6.61, status: 'rented', zone_id: 'z01', position_x: 3, position_y: 1, created_at: '2024-01-01T00:00:00Z' },
  { id: 'f10', number: 10, name: '10번 농장', area_pyeong: 4.5, area_sqm: 14.88, status: 'maintenance', zone_id: 'z01', position_x: 4, position_y: 1, created_at: '2024-01-01T00:00:00Z' },
]

export const MOCK_RENTALS: (FarmRental & { farm: Farm; customer: Customer })[] = [
  {
    id: 'r01', farm_id: 'f01', customer_id: 'c001',
    start_date: '2024-10-01', end_date: '2025-09-30',
    plan: '새싹', monthly_fee: 119000, payment_method: '계좌이체',
    payment_status: '납부완료', status: 'active', notes: '매달 1일 자동이체',
    created_at: '2024-10-01T00:00:00Z', updated_at: '2024-10-01T00:00:00Z',
    farm: MOCK_FARMS[0], customer: MOCK_CUSTOMERS[0],
  },
  {
    id: 'r02', farm_id: 'f02', customer_id: 'c002',
    start_date: '2024-11-01', end_date: '2025-10-31',
    plan: '자람', monthly_fee: 179000, payment_method: '카드',
    payment_status: '납부완료', status: 'active', notes: '',
    created_at: '2024-11-01T00:00:00Z', updated_at: '2024-11-01T00:00:00Z',
    farm: MOCK_FARMS[1], customer: MOCK_CUSTOMERS[1],
  },
  {
    id: 'r03', farm_id: 'f03', customer_id: 'c003',
    start_date: '2024-12-01', end_date: '2025-11-30',
    plan: '씨앗', monthly_fee: 79000, payment_method: '현금',
    payment_status: '납부완료', status: 'active', notes: '매달 초 직접 방문 납부',
    created_at: '2024-12-01T00:00:00Z', updated_at: '2024-12-01T00:00:00Z',
    farm: MOCK_FARMS[2], customer: MOCK_CUSTOMERS[2],
  },
  {
    id: 'r04', farm_id: 'f05', customer_id: 'c005',
    start_date: '2025-01-01', end_date: '2025-03-15',
    plan: '새싹', monthly_fee: 119000, payment_method: '계좌이체',
    payment_status: '납부완료', status: 'active', notes: '만료 임박',
    created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
    farm: MOCK_FARMS[4], customer: MOCK_CUSTOMERS[4],
  },
  {
    id: 'r05', farm_id: 'f06', customer_id: 'c006',
    start_date: '2025-01-15', end_date: '2025-03-20',
    plan: '자람', monthly_fee: 179000, payment_method: '카드',
    payment_status: '미납', status: 'active', notes: '이번달 미납 확인 필요',
    created_at: '2025-01-15T00:00:00Z', updated_at: '2025-01-15T00:00:00Z',
    farm: MOCK_FARMS[5], customer: MOCK_CUSTOMERS[5],
  },
  {
    id: 'r06', farm_id: 'f08', customer_id: 'c007',
    start_date: '2025-02-01', end_date: '2026-01-31',
    plan: '씨앗', monthly_fee: 79000, payment_method: '계좌이체',
    payment_status: '납부완료', status: 'active', notes: '',
    created_at: '2025-02-01T00:00:00Z', updated_at: '2025-02-01T00:00:00Z',
    farm: MOCK_FARMS[7], customer: MOCK_CUSTOMERS[6],
  },
  {
    id: 'r07', farm_id: 'f09', customer_id: 'c008',
    start_date: '2025-02-15', end_date: '2025-08-14',
    plan: '새싹', monthly_fee: 119000, payment_method: '현금',
    payment_status: '납부완료', status: 'active', notes: '',
    created_at: '2025-02-15T00:00:00Z', updated_at: '2025-02-15T00:00:00Z',
    farm: MOCK_FARMS[8], customer: MOCK_CUSTOMERS[7],
  },
]

// MOCK_FARMS에 current_rental 연결
const rentalByFarmId: Record<string, typeof MOCK_RENTALS[number]> = {}
MOCK_RENTALS.filter(r => r.status === 'active').forEach(r => { rentalByFarmId[r.farm_id] = r })
export const MOCK_FARMS_WITH_RENTALS: Farm[] = MOCK_FARMS.map(f => ({
  ...f,
  current_rental: rentalByFarmId[f.id] ? {
    ...rentalByFarmId[f.id],
    customer: rentalByFarmId[f.id].customer,
  } : undefined,
}))

export const MOCK_STATS = {
  todayNew: 2,
  unprocessed: 6,
  monthConverted: 1,
  rentedFarms: 7,
}

export function generateChartData(): DailyCount[] {
  const seed = [0,1,0,0,1,0,0,0,1,1,0,0,0,1,0,0,0,0,1,0,1,1,0,1,2,1,0,1,2,1]
  return seed.map((count, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return {
      date: `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`,
      count,
    }
  })
}
