# 플랜: 엑셀 다운로드 기간 필터 추가 (v2 — 검수 반영)

> 리서치: `thoughts/research/20260413_export_date_filter_ux.md`
> 검수: `thoughts/plans/20260413_excel_review.md` 8항목 + 보완 3건 반영

## 목표
- ExportButton 클릭 시 기간 선택 팝오버 표시 (네이버 스마트스토어 스타일)
- 기본값 1주일, 프리셋 5개 + 커스텀 날짜
- 기존 서비스 영향 0

---

## UI 설계

```
[엑셀 ↓] 클릭 →

┌──────────────────────────────────────┐
│  기간 선택                           │
│                                      │
│  [오늘] [1주] [1개월] [3개월] [전체]  │
│                                      │
│  2026-04-07  ~  2026-04-13           │
│                                      │
│              [다운로드]               │
└──────────────────────────────────────┘
```

### 프리셋 (검수 보완 #2 반영: 오늘 포함 N일간)
| 버튼 | from | to | 일수 |
|------|------|----|------|
| 오늘 | today | today | 1일 |
| 1주 (기본) | today - **6**일 | today | 오늘 포함 7일간 |
| 1개월 | today - 29일 | today | 오늘 포함 30일간 |
| 3개월 | today - 89일 | today | 오늘 포함 90일간 |
| 전체 | (없음) | (없음) | 제한 없음 |

### 동작
1. 엑셀 버튼 클릭 → 팝오버(Popover) 열림
2. 기본 선택: "1주" (하이라이트)
3. 프리셋 클릭 → 날짜 입력 자동 채움 + 프리셋 하이라이트
4. 날짜 직접 수정 → 프리셋 해제 (커스텀 상태)
5. "다운로드" 클릭 → API 호출 (from, to 파라미터 추가) → 팝오버 닫힘
6. 팝오버 외부 클릭 → 닫힘 (useRef + mousedown)

### 날짜 적용 대상 필드
| target | 기간 필터 기준 필드 | 비고 |
|--------|-------------------|------|
| inquiries | `created_at` | |
| customers | `created_at` | |
| rentals | `created_at` | |
| farms | — | 마스터 데이터, 기간 필터 불필요 |
| members | `created_at` | |
| blog | `created_at` | |
| notices | `created_at` | |
| coupons | `created_at` | |
| coupon_issues | `created_at` | |
| bbq | `reservation_date` | 검수 보완 #3 반영 |
| orders | `created_at` | |
| products | — | 마스터 데이터, 기간 필터 불필요 |

**farms, products**: 팝오버 없이 기존처럼 즉시 다운로드.

---

## 구현 계획

### Step 1. ExportButton 리팩토링 — `components/ui/ExportButton.tsx`

기존 단순 버튼 → **버튼 + 팝오버** 구조:

```typescript
interface ExportButtonProps {
  target: string;
  params?: Record<string, string>;
  label?: string;
  dateField?: string;    // 'created_at' | 'reservation_date' — 없으면 즉시 다운로드
}
```

- `dateField` 미지정 → 기존처럼 즉시 다운로드 (farms, products)
- `dateField` 지정 → 팝오버로 기간 선택 후 다운로드

**팝오버 내부 상태**:
- `preset`: 'today' | '1w' | '1m' | '3m' | 'all' (기본: '1w')
- `from`: string (YYYY-MM-DD)
- `to`: string (YYYY-MM-DD)
- `open`: boolean

**UI 구성**:
- 프리셋 버튼 5개 (가로 나열, 선택된 것 primary 색상)
- 시작일/종료일 `<input type="date">` 2개
- "다운로드" 버튼 (loading 상태 지원)
- 외부 클릭 닫기 (useRef + useEffect mousedown)

### Step 2. API Route 수정 — `app/api/export/route.ts`

**ExportConfig에 dateField 속성 추가**:
```typescript
interface ExportConfig {
  // ... 기존
  dateField?: string;  // 기간 필터 대상 컬럼명
}
```

**공통 날짜 필터 (검수 보완 #1 반영: lt(nextDay) 패턴)**:
```typescript
// GET handler 내에서 query 호출 후 적용
const from = params.get('from');
const to = params.get('to');
const dateField = config.dateField;

if (dateField) {
  if (from) q = q.gte(dateField, from);
  if (to) {
    // to 날짜 당일 끝까지 포함: 다음날 00:00 미만
    const nextDay = new Date(to);
    nextDay.setDate(nextDay.getDate() + 1);
    q = q.lt(dateField, nextDay.toISOString().split('T')[0]);
  }
}
```

**타임존 안전**: `lt(nextDay)` 패턴은 UTC/KST 무관하게 정확. `lte + T23:59:59` 대비 1초 누락 없음.

**검수 보완 #3 반영 — bbq date 파라미터 충돌 해결**:
- bbq config의 query에서 기존 `date` 파라미터 로직 유지
- `from`/`to`가 있으면 `date` 파라미터 무시
- ExportButton에서 bbq용은 기존 `date` param 제거, `from`/`to`만 전달

```typescript
// bbq query 함수 내부
const from = params.get('from');
const to = params.get('to');
const date = params.get('date');

if (from || to) {
  // 기간 범위 필터 (ExportButton에서 전달)
  if (from) q = q.gte('reservation_date', from);
  if (to) {
    const nextDay = new Date(to);
    nextDay.setDate(nextDay.getDate() + 1);
    q = q.lt('reservation_date', nextDay.toISOString().split('T')[0]);
  }
} else if (date) {
  // 기존 단일 날짜 필터 (페이지 내 날짜 네비게이터)
  q = q.eq('reservation_date', date);
}
```

### Step 3. 각 페이지 ExportButton에 dateField 추가

| 페이지 | 현재 | 변경 후 |
|--------|------|---------|
| inquiries | `<ExportButton target="inquiries" params={...} />` | `dateField="created_at"` 추가 |
| customers | `<ExportButton target="customers" params={...} />` | `dateField="created_at"` 추가 |
| rentals | `<ExportButton target="rentals" params={...} />` | `dateField="created_at"` 추가 |
| farms | `<ExportButton target="farms" />` | **변경 없음** |
| members | `<ExportButton target="members" params={...} />` | `dateField="created_at"` 추가 |
| blog | `<ExportButton target="blog" />` | `dateField="created_at"` 추가 |
| notices | `<ExportButton target="notices" />` | `dateField="created_at"` 추가 |
| coupons | `<ExportButton target={...} params={...} />` | `dateField="created_at"` 추가 |
| bbq | `<ExportButton target="bbq" params={{ date, status, search }} />` | `dateField="reservation_date"` 추가, `date` param 제거 |
| store/orders | `<ExportButton target="orders" params={...} />` | `dateField="created_at"` 추가 |
| store (products) | `<ExportButton target="products" />` | **변경 없음** |

---

## 파일 변경 목록

| 파일 | 변경 | 기존 영향 |
|------|------|----------|
| `components/ui/ExportButton.tsx` | 팝오버 UI 추가, dateField prop | 하위 호환 (dateField 없으면 기존 동작) |
| `app/api/export/route.ts` | dateField 속성 + from/to 필터 로직 | 파라미터 없으면 기존 동작 |
| 9개 page.tsx | `dateField` prop 1줄 추가 | 기존 기능 변경 없음 |

**기존 로직 변경**: 0줄 (하위 호환)

---

## 검수 보완 반영 현황

| # | 보완 항목 | 우선도 | 반영 |
|---|----------|--------|------|
| 1 | to 날짜 경계: `lt(nextDay)` 패턴 | 🔴 필수 | ✅ Step 2에 반영 |
| 2 | 프리셋 "1주" = today - 6일 (오늘 포함 7일간) | 🟡 권고 | ✅ 프리셋 표에 반영 |
| 3 | bbq date vs from/to 충돌: from/to 우선 | 🟡 권고 | ✅ Step 2 bbq 로직에 반영 |

---

## kk 피드백

<!-- kk가 여기에 피드백을 작성해주세요 -->
