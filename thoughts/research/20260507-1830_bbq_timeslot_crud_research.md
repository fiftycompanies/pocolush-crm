# 바베큐 타임슬롯 CRUD 리서치

> 목표: 현재 하드코딩된 바베큐 타임 슬롯(1~3타임)을 DB 기반 CRUD로 전환하여 상품별 관리 가능하게 만들기

---

## 1. 현재 구조 및 동작 방식

### 타임슬롯 정의 (하드코딩)

**단일 진실의 원천**: `lib/member-constants.ts:17-21`
```ts
export const TIME_SLOTS = {
  1: { label: '1타임', time: '11:00 ~ 13:50' },
  2: { label: '2타임', time: '14:00 ~ 16:50' },
  3: { label: '3타임', time: '17:00 ~ 19:50' },
} as const;
```

**⚠️ 불일치 발견**: `app/api/export/route.ts:75-79`에서 **다른 시간**으로 별도 하드코딩:
```ts
const BBQ_TIME_SLOTS: Record<number, string> = {
  1: '10:00-13:00',   // ← member-constants: '11:00 ~ 13:50'
  2: '13:30-16:30',   // ← member-constants: '14:00 ~ 16:50'
  3: '17:00-20:00',   // ← member-constants: '17:00 ~ 19:50'
};
```
→ **이미 하드코딩으로 인한 데이터 불일치가 발생 중** (DB 전환의 명확한 근거)

### DB 스키마 (현재)

**bbq_reservations 테이블** (`004_bbq.sql`):
```sql
time_slot INTEGER NOT NULL CHECK (time_slot IN (1, 2, 3)),
UNIQUE (reservation_date, time_slot, bbq_number)
```
- 타임슬롯은 정수(1,2,3)로만 저장
- CHECK 제약조건으로 1~3만 허용
- UNIQUE 제약으로 날짜+슬롯+시설 중복 방지

**bbq_products 테이블** (`033_bbq_products_events.sql`):
```sql
CREATE TABLE public.bbq_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  base_price INTEGER NOT NULL,
  duration_minutes INTEGER DEFAULT 170,  -- 2시간 50분 (타임 간격과 동일)
  is_active BOOLEAN DEFAULT TRUE,
  ...
);
```
- 상품에 `duration_minutes`가 있으나 타임슬롯과 직접 연결되지 않음

**bbq_events 테이블** (`033_bbq_products_events.sql`):
- 기간제 가격 이벤트 (상품에 종속)

**create_bbq_reservation RPC** (`034_bbq_reservation_snapshot_price.sql`):
- 예약 생성 시 가격 스냅샷 저장
- time_slot 값 검증은 DB CHECK 제약에 의존

### 타입 정의

**types/index.ts**:
```ts
export interface BBQReservation {
  time_slot: 1 | 2 | 3;  // 강타입
  ...
}
```

---

## 2. 관련 파일 전체 경로 목록

### 타임슬롯 정의 & 참조 (변경 필수)
| 파일 | 역할 | TIME_SLOTS 사용 방식 |
|------|------|---------------------|
| `lib/member-constants.ts:17-21` | **하드코딩 원본** | TIME_SLOTS 객체 정의 |
| `app/api/export/route.ts:75-79` | 엑셀 export | **BBQ_TIME_SLOTS 별도 하드코딩** (불일치!) |

### 프론트엔드 컴포넌트 (TIME_SLOTS import 사용)
| 파일 | 역할 | 사용 방식 |
|------|------|----------|
| `components/member/TimeSlotSelector.tsx` | 회원 예약 - 타임 선택 UI | `[1,2,3]` 하드코딩 루프 + `TIME_SLOTS[slot]` |
| `app/member/reservation/page.tsx:200` | 예약 확인 모달 | `TIME_SLOTS[selectedSlot as 1\|2\|3]` |
| `app/member/reservation/[id]/page.tsx:59` | 예약 상세 | `TIME_SLOTS[reservation.time_slot]` |
| `app/member/reservation/history/page.tsx:49` | 예약 내역 리스트 | `TIME_SLOTS[r.time_slot]` |
| `app/member/page.tsx:195` | 회원 홈 (다음 예약 표시) | `TIME_SLOTS[nextReservation.time_slot]` |
| `components/admin-members/MemberBBQTab.tsx:27` | 관리자 - 회원 BBQ 탭 | `TIME_SLOTS[r.time_slot]` |
| `app/dashboard/bbq/page.tsx:130` | **관리자 - BBQ 설정 페이지** | `Object.entries(TIME_SLOTS)` 읽기 전용 표시 |
| `components/dashboard/DashboardList.tsx:75` | 대시보드 BBQ 목록 | `time_slot` 필드 참조 |

### DB 스키마 (제약조건 변경 필요)
| 파일 | 역할 |
|------|------|
| `supabase/migrations/004_bbq.sql:29` | `CHECK (time_slot IN (1, 2, 3))` 제약 |
| `supabase/migrations/034_bbq_reservation_snapshot_price.sql` | create_bbq_reservation RPC |

### 타입 (변경 필요)
| 파일 | 역할 |
|------|------|
| `types/index.ts` | `BBQReservation.time_slot: 1 \| 2 \| 3` 강타입 |

### 가용성 체크 (슬롯 순회 로직 변경 필요)
| 파일 | 위치 | 로직 |
|------|------|------|
| `app/member/reservation/page.tsx:81` | `for (const slot of [1, 2, 3])` | 가용 슬롯 조회 루프 |

---

## 3. 주의해야 할 의존성

### 3-1. DB CHECK 제약조건
- `bbq_reservations.time_slot CHECK (time_slot IN (1, 2, 3))` → 슬롯 수가 가변이면 제약 변경 또는 FK 참조로 전환 필요

### 3-2. UNIQUE 제약조건
- `UNIQUE (reservation_date, time_slot, bbq_number)` → 그대로 유지 가능 (time_slot이 정수 → FK 정수로 변경해도 호환)

### 3-3. create_bbq_reservation RPC
- `p_slot INTEGER` 파라미터 → 타임슬롯 테이블의 slot_number 참조로 전환
- 가격 조회 함수 `get_bbq_reservation_price`는 product_id 기반이므로 영향 없음

### 3-4. 타입 안전성
- `BBQReservation.time_slot: 1 | 2 | 3` 강타입 → `number`로 완화 필요
- TimeSlotSelector의 `[1,2,3] as const` 루프 → DB에서 가져온 슬롯 배열로 대체

### 3-5. 엑셀 Export
- `BBQ_TIME_SLOTS` 별도 하드코딩 → DB 조회로 대체 (동시에 불일치 해결)

### 3-6. 기존 예약 데이터
- 기존 예약의 `time_slot` 값(1,2,3)이 새 테이블과 호환되어야 함
- 마이그레이션 시 기존 데이터 무결성 보장 필수

---

## 4. 기존 패턴 (ORM, API 규칙, 네이밍 등)

### DB 패턴
- **ORM 없음**: Supabase client 직접 쿼리 (`supabase.from('table').select()...`)
- **UUID PK**: `gen_random_uuid()`
- **소프트 상태**: `is_active BOOLEAN DEFAULT TRUE`
- **타임스탬프**: `created_at`, `updated_at` + `update_updated_at()` 트리거
- **RLS**: 전체 읽기 + 어드민 쓰기 패턴
- **인덱스**: 자주 조회되는 컬럼에 추가

### API 패턴
- **서버 컴포넌트**: auth 체크 → admin role 확인 → Client 컴포넌트 렌더
- **클라이언트 CRUD**: `useCallback` fetch + `useState` 모달 상태 + `toast` 알림
- **감사 로깅**: `auditLog({ action, resource_type, resource_id, metadata })` 필수

### 네이밍
- 테이블: `bbq_*` (snake_case)
- 컴포넌트: `BbqProductModal`, `BbqProductsPageClient` (PascalCase)
- 상수: `TIME_SLOTS`, `RESERVATION_STATUS` (SCREAMING_SNAKE)
- RPC: `create_bbq_reservation`, `get_bbq_reservation_price` (snake_case)

### CRUD 모달 패턴 (BbqProductModal 참고)
```
Props: { mode: 'new' | 'edit', product?: BbqProduct, onClose, onSuccess }
- useState로 폼 필드 관리
- handleSubmit: insert or update → auditLog → toast → onSuccess
- 모달 UI: overlay(bg-black/40) + centered card(rounded-xl)
- 버튼: 취소(border) + 저장(bg-primary)
```

---

## 5. 변경 시 영향 받는 영역

### 직접 영향 (코드 변경 필수)
1. **새 DB 테이블**: `bbq_time_slots` 생성 (slot_number, label, start_time, end_time, is_active, sort_order)
2. **마이그레이션**: 기존 3개 슬롯 시드 + CHECK 제약 변경
3. **상수 파일**: `TIME_SLOTS` 하드코딩 제거 또는 폴백용으로 유지
4. **관리자 BBQ 설정 페이지**: 타임슬롯 CRUD UI 추가 (현재 읽기 전용 → 추가/수정/삭제/정렬)
5. **TimeSlotSelector**: DB에서 슬롯 목록 fetch → 동적 렌더링
6. **예약 페이지**: 가용성 체크 루프를 동적 슬롯 배열로 변경
7. **예약 상세/내역**: `TIME_SLOTS[n]` → DB 조회 또는 reservation에 스냅샷 저장
8. **엑셀 Export**: `BBQ_TIME_SLOTS` 하드코딩 제거 → DB 조회
9. **타입**: `BBQReservation.time_slot` 타입 완화
10. **RPC**: `create_bbq_reservation` 슬롯 유효성 검증 방식 변경

### 간접 영향 (확인 필요)
- 대시보드 BBQ 카드 (`DashboardList.tsx`)
- 회원 홈 다음 예약 표시 (`app/member/page.tsx`)
- MemberBBQTab (관리자 회원 상세)
- Slack 알림 (`lib/observability/slack.ts` - time_slot 참조 여부)

### 영향 없음
- 바베큐 시설(facilities) CRUD - 독립적
- 바베큐 상품(products) CRUD - 독립적 (단, duration_minutes와의 관계 고려)
- 바베큐 이벤트(events) - 상품에 종속, 타임슬롯과 무관
- 가격 조회 함수 - product_id 기반이므로 무관

---

## 6. 설계 방향 제안

### 옵션 A: 독립 테이블 (bbq_time_slots)
```sql
CREATE TABLE bbq_time_slots (
  id UUID PRIMARY KEY,
  slot_number INTEGER UNIQUE NOT NULL,  -- 1, 2, 3, ...
  label TEXT NOT NULL,                   -- '1타임'
  start_time TIME NOT NULL,              -- '11:00'
  end_time TIME NOT NULL,                -- '13:50'
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```
- **장점**: 단순, 상품과 독립적으로 관리 가능
- **단점**: 상품별 다른 타임이 필요하면 확장 필요

### 옵션 B: 상품 종속 테이블 (bbq_product_time_slots)
```sql
CREATE TABLE bbq_product_time_slots (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES bbq_products(id),
  slot_number INTEGER NOT NULL,
  label TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  UNIQUE (product_id, slot_number)
);
```
- **장점**: 상품별 다른 타임 슬롯 가능
- **단점**: 현재 상품 구조상 과도한 복잡성 (활성 상품 1개만 사용)

### 권장: 옵션 A (독립 테이블)
- 현재 바베큐 시설은 모두 동일한 타임 슬롯을 공유
- 상품은 가격/이벤트 관리 용도이고, 타임은 운영 시간 관리 용도
- 추후 상품별 타임이 필요해지면 그때 관계 테이블 추가 가능

### 예약 시 타임 정보 스냅샷
- `bbq_reservations`에 `time_label`, `start_time`, `end_time` 컬럼 추가 고려
- 과거 예약의 시간 표시가 현재 설정 변경에 영향받지 않도록
- 또는: 타임슬롯 삭제 시 soft-delete(is_active=false)로 처리하면 스냅샷 불필요

---

## 7. UI/UX 현황 분석

### 관리자 BBQ 설정 페이지 (`/dashboard/bbq`)
현재 구조:
1. **바베큐장 배치도** (시설 그리드 + CRUD) ← 이미 동작
2. **타임 슬롯** (읽기 전용 리스트) ← **여기를 CRUD로 전환**
3. **시설 목록 테이블** (상세 CRUD) ← 이미 동작

타임 슬롯 섹션 현재 UI:
- 카드 내 리스트 형태
- 각 행: `{label} {time}` + "활성" 뱃지
- 수정/삭제 기능 없음

### 회원 예약 페이지 (`/member/reservation`)
현재 플로우:
1. 날짜 선택 (ReservationCalendar)
2. 타임 선택 (TimeSlotSelector - 3칸 그리드, 고정)
3. 바베큐장 선택 (BBQGrid)
4. 예약 확인 모달

→ 타임슬롯이 동적이면 TimeSlotSelector가 DB에서 active 슬롯을 fetch해서 렌더링
→ 그리드 cols는 슬롯 수에 맞게 동적으로 (`grid-cols-${count}`)

---

## 8. 마이그레이션 전략

1. **새 테이블 생성** + 기존 3개 슬롯 시드
2. **bbq_reservations CHECK 제약 변경**: `CHECK (time_slot IN (1,2,3))` → FK 또는 제약 완화
3. **RPC 업데이트**: 슬롯 유효성을 새 테이블 기준으로 검증
4. **프론트엔드**: DB 조회 → 동적 렌더링
5. **Export**: DB 조회로 대체
6. **기존 데이터**: slot_number 1,2,3이 새 테이블과 매칭되므로 데이터 변경 불필요
