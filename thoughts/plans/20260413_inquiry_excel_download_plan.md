# 플랜: 어드민 전체 목록 엑셀 다운로드

> 리서치: `thoughts/research/20260413_inquiry_excel_download.md`

## 목표
- 어드민 대시보드의 **모든 목록 페이지**(11개)에서 현재 필터 적용된 데이터를 .xlsx로 다운로드
- 한글 깨짐 / 파일 깨짐 원천 방지
- 재사용 가능한 공통 모듈로 설계
- 기존 서비스 영향 0

---

## 대상 페이지 (11개)

| # | 페이지 | 경로 | 엑셀 컬럼 |
|---|--------|------|-----------|
| 1 | 문의 관리 | `/dashboard/inquiries` | 유형, 이름, 연락처, 상태, 담당자, 유입경로, 접수일시 |
| 2 | 고객 관리 | `/dashboard/customers` | 이름, 연락처, 총 문의수, 첫 접촉일, 최근 접촉일 |
| 3 | 임대 계약 | `/dashboard/rentals` | 농장, 고객명, 연락처, 플랜, 시작일, 종료일, 월 결제액, 결제상태, 상태 |
| 4 | 농장 관리 | `/dashboard/farms` | 번호, 이름, 면적(평), 면적(m²), 상태, 임차인, 만료일 |
| 5 | 회원 관리 | `/dashboard/members` | 이름, 연락처, 이메일, 상태, 영농경험, 관심작물, 가입일 |
| 6 | 블로그 관리 | `/dashboard/blog` | 제목, 카테고리, 상태, 조회수, 작성일 |
| 7 | 공지 관리 | `/dashboard/notices` | 제목, 카테고리, 상태, 작성일 |
| 8 | 쿠폰 관리 | `/dashboard/coupons` | [쿠폰] 쿠폰명, 할인, 유효기간, 상태 / [발급] 코드, 쿠폰명, 회원, 상태 |
| 9 | 바베큐 예약 | `/dashboard/bbq` | 날짜, 타임, 장소, 예약자, 연락처, 인원, 상태 |
| 10 | 서비스 신청 | `/dashboard/store/orders` | 신청자, 상품, 수량, 금액, 상태, 신청일 |
| 11 | 스토어 상품 | `/dashboard/store` | 상품명, 카테고리, 가격, 상태 |

---

## 구현 계획

### Step 1. exceljs 설치
```bash
cd pocolush-crm && npm install exceljs
```

### Step 2. 공통 엑셀 생성 유틸 — `lib/excel.ts` (신규)

재사용 가능한 서버사이드 + 클라이언트 유틸을 하나의 모듈로 통합:

```typescript
// 서버사이드: 워크북 생성 공통 함수
export function createExcelWorkbook(config: {
  sheetName: string;
  columns: { header: string; key: string; width: number }[];
  rows: Record<string, unknown>[];
}): Promise<Buffer>

// 클라이언트: blob 다운로드 트리거
export async function downloadExcel(
  apiPath: string,
  params?: Record<string, string>,
  filename?: string
): Promise<void>
```

**핵심 기술 방어**:
- `.xlsx` 포맷 강제 (CSV 없음)
- `writeBuffer()` → `new Response(buffer)` 직접 전달
- 클라이언트에서 `.blob()` 수신 (`.text()` 금지)
- `filename*=UTF-8''` 한글 파일명 RFC 5987
- 헤더 행 볼드 + 배경색 + 자동 필터

### Step 3. 통합 API Route — `app/api/export/route.ts` (신규)

**하나의 API로 11개 페이지 전부 처리** (target 파라미터로 구분):

```
GET /api/export?target=inquiries&type=jaramter_inquiry&status=new
GET /api/export?target=customers&search=홍길동
GET /api/export?target=rentals&status=active
...
```

**핵심 로직**:
1. Supabase 서버 클라이언트 → 세션 확인 (미인증 → 401)
2. `target` 파라미터로 어떤 테이블/컬럼인지 결정
3. 각 target별 데이터 조회 함수 (쿼리+필터 로직)
4. 공통 `createExcelWorkbook()` 호출
5. Buffer 응답 반환

**target별 설정 맵** (한 파일에 선언적으로 관리):

```typescript
const EXPORT_CONFIGS: Record<string, ExportConfig> = {
  inquiries: {
    sheetName: '문의목록',
    filename: '문의목록',
    query: (supabase, params) => { ... },
    columns: [ { header: '유형', key: 'type_label', width: 16 }, ... ],
    transform: (row) => ({ type_label: INQUIRY_TYPES[row.type]?.label, ... }),
  },
  customers: { ... },
  rentals: { ... },
  // ... 11개 전체
};
```

### Step 4. 공통 다운로드 버튼 컴포넌트 — `components/ui/ExportButton.tsx` (신규)

모든 페이지에서 재사용할 다운로드 버튼:

```typescript
interface ExportButtonProps {
  target: string;          // 'inquiries' | 'customers' | ...
  params?: Record<string, string>;  // 현재 필터 값
  label?: string;          // 기본값: '엑셀 다운로드'
}
```

- lucide-react `Download` 아이콘
- 로딩 중 스피너 + 비활성화
- toast 성공/실패 알림
- 기존 UI 스타일 통일 (ghost 버튼)

### Step 5. 각 페이지에 ExportButton 배치 (11개 페이지 수정)

각 페이지의 헤더 영역에 `<ExportButton>` 추가. **기존 로직 변경 없이 버튼만 삽입**.

| 페이지 | 배치 위치 | 전달할 params |
|--------|-----------|--------------|
| inquiries | 필터 바 우측 (`InquiryFilters`) | type, status, search |
| customers | 헤더 우측 | search |
| rentals | 헤더 우측 | status, search |
| farms | 헤더 우측 | — |
| members | 헤더 우측 | status, search |
| blog | 헤더 우측 | — |
| notices | 헤더 우측 | — |
| coupons | 헤더 우측 | tab (coupons/issues) |
| bbq | 헤더 우측 | date, status, search |
| store/orders | 헤더 우측 | status |
| store (products) | 헤더 우측 | — |

---

## 파일 변경 목록

### 신규 파일 (3개)
| 파일 | 역할 |
|------|------|
| `lib/excel.ts` | 엑셀 생성 공통 유틸 (서버) + 다운로드 트리거 (클라이언트) |
| `app/api/export/route.ts` | 통합 엑셀 내보내기 API |
| `components/ui/ExportButton.tsx` | 공통 다운로드 버튼 |

### 수정 파일 (11개 — 버튼 삽입만)
| 파일 | 변경 내용 |
|------|----------|
| `app/dashboard/inquiries/page.tsx` | ExportButton 추가 |
| `app/dashboard/customers/page.tsx` | ExportButton 추가 |
| `app/dashboard/rentals/page.tsx` | ExportButton 추가 |
| `app/dashboard/farms/page.tsx` | ExportButton 추가 |
| `app/dashboard/members/page.tsx` | ExportButton 추가 |
| `app/dashboard/blog/page.tsx` | ExportButton 추가 |
| `app/dashboard/notices/page.tsx` | ExportButton 추가 |
| `app/dashboard/coupons/page.tsx` | ExportButton 추가 |
| `app/dashboard/bbq/page.tsx` | ExportButton 추가 |
| `app/dashboard/store/orders/page.tsx` | ExportButton 추가 |
| `app/dashboard/store/page.tsx` | ExportButton 추가 |

**기존 로직 변경: 없음** — 모든 수정은 JSX에 버튼 1줄 추가뿐

---

## 글자깨짐/파일깨짐 방지 체크리스트

| # | 항목 | 구현 |
|---|------|------|
| 1 | .xlsx 포맷 (CSV 금지) | exceljs .xlsx 생성 |
| 2 | 서버사이드 생성 | API Route (Node.js) |
| 3 | Buffer → Response 직접 전달 | `new Response(buffer)` |
| 4 | 클라이언트 .blob() 수신 | fetch → response.blob() |
| 5 | 한글 파일명 RFC 5987 | `filename*=UTF-8''${encodeURIComponent()}` |
| 6 | 날짜 포맷 | `YYYY-MM-DD HH:mm` |
| 7 | 타입/상태 한글 라벨 변환 | constants.ts 라벨 매핑 |
| 8 | Content-Type 정확 | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |

---

## 아키텍처 다이어그램

```
[ExportButton]  ──fetch──▶  [/api/export?target=XXX]
  (11개 페이지)                    │
                                   ├─ 인증 확인 (Supabase 세션)
                                   ├─ target별 쿼리 + 필터
                                   ├─ transform (한글 라벨 변환)
                                   ├─ createExcelWorkbook()
                                   └─ new Response(buffer)
                                          │
                              ◀──blob──────┘
  URL.createObjectURL(blob)
  <a download> 클릭 → 파일 저장
```

---

## kk 피드백

<!-- kk가 여기에 피드백을 작성해주세요 -->
