# 평상 메뉴 → 평상 설정 통합 — 실행 플랜 v1

> **작성**: 2026-05-16 01:00
> **선행**: `thoughts/research/20260516-0030_bbq_consolidation_research.md`
> **상태**: 🔴 **kk 승인 대기** (구현 금지)
> **권고 안**: research §8 의 **안 A (3 섹션 단일 페이지)** — RICE 3.0, Krug 9/10
> **변경 규모**: 코드 5~6 파일, DB 0, 라이브 영향 최소 (redirect 추가)

---

## 0. 한 줄 요약

> `/dashboard/bbq-products` (상품 1건/이벤트 1건) 페이지를 `/dashboard/bbq` 내부에 **§3 상품·이벤트 섹션**으로 흡수. 사이드바 평상 그룹 4 → 3 항목, ALL_NAV_HREFS 갱신, 외부 북마크 보존 위해 redirect 추가. Feature flag 미사용 (즉시 적용 + git revert 롤백).

---

## 1. kk 결정 필요 (3건)

| Q | 항목 | 옵션 | 권고 |
|---|---|---|---|
| **Q1** | 통합 안 | (A) 3 섹션 단일 / (B) 2 탭 / (C) 아코디언 / (D) 사이드 nav | **A** ⭐ |
| **Q2** | 시설 목록 테이블 (현 §4) 처리 | (1) `<details>` collapsible 기본 닫힘 / (2) 그대로 펼침 / (3) 제거 (배치도와 중복) | **1** ⭐ |
| **Q3** | `/dashboard/bbq-products` URL 처리 | (a) redirect → `/bbq#products` / (b) 404 (운영자만 사용, 깔끔) / (c) 페이지 유지 (deep link) | **a** ⭐ |

답변 형식: "Q1=A, Q2=1, Q3=a" 또는 자유 메모. §11 "kk 피드백" 섹션에 직접 메모 부탁드립니다.

---

## 2. 통합 구조 (안 A 권고)

```
┌─────────────────────────────────────┐
│ 평상 설정                          │
│ 시설 4·활성 4 / 타임 3 / 상품 1·이벤트 1 │
│                       [시설 추가] │
├─────────────────────────────────────┤
│                                     │
│ §1. 평상 배치도                    │
│   ┌───┐┌───┐┌───┐┌───┐         │
│   │1번││2번││3번││4번│  +(추가) │
│   └───┘└───┘└───┘└───┘         │
│                                     │
├─────────────────────────────────────┤
│                                     │
│ §2. 타임 슬롯           [타임 추가] │
│   1타임  12:00~13:55  [편집]      │
│   2타임  14:00~15:55  [편집]      │
│   3타임  16:00~17:55  [편집]      │
│                                     │
├─────────────────────────────────────┤
│                                     │
│ §3. 상품·이벤트     [신규 상품]    │
│   ┌────────────────────────────┐  │
│   │ 평상 예약 (기본) · 30,000원│  │
│   │ 🎉 오픈기념 이벤트 무료    │  │
│   │   ↳ 2026-04-18 ~ 08-31     │  │
│   └────────────────────────────┘  │
│                                     │
├─────────────────────────────────────┤
│                                     │
│ ▶ §4. 시설 목록 (5개)  [펼치기]   │  ← <details> collapsible
│                                     │
└─────────────────────────────────────┘
```

---

## 3. Phase 구분

### Phase 1 — 즉시 안전 묶음 (라이브 영향 최소)

#### 3-1. 변경 파일

| 파일 | 변경 | 비고 |
|---|---|---|
| `app/dashboard/bbq/page.tsx` | §3 상품·이벤트 섹션 추가 + §4 collapsible | client 그대로 |
| `app/dashboard/bbq-products/page.tsx` | server redirect → `/dashboard/bbq#products` | 또는 next.config redirect |
| `components/admin-bbq/BbqProductsPageClient.tsx` | **삭제** 또는 `<ProductsSection />` 로 분리 후 import | 코드 재활용 권고 |
| `components/admin-bbq/BbqProductModal.tsx` | 그대로 (재활용) | - |
| `components/admin-bbq/BbqEventModal.tsx` | 그대로 (재활용) | - |
| `components/layout/Sidebar.tsx` | "평상 메뉴" 항목 제거 (V2 + V1 양쪽) | ALL_NAV_HREFS 자동 정리 |
| `e2e/qa-prod-validation.spec.ts` | "평상 메뉴" 검증 제거 | spec line 142 |

#### 3-2. 구조 리팩토링 (R3 컴포넌트 비대화 방지)

평상 설정 페이지를 **섹션 컴포넌트 분리**:

```
components/admin-bbq/
  ├─ FacilitiesSection.tsx       (신규, ~150 lines: 배치도+폼)
  ├─ TimeSlotsSection.tsx        (신규, ~100 lines: 타임슬롯+폼)
  ├─ ProductsSection.tsx         (신규, BbqProductsPageClient.tsx 재구성)
  ├─ FacilitiesTable.tsx         (신규, ~80 lines: §4 테이블)
  ├─ BbqProductModal.tsx         (그대로)
  └─ BbqEventModal.tsx           (그대로)

app/dashboard/bbq/page.tsx       (~80 lines: 헤더 + 4 섹션 import)
```

**장점**:
- 각 섹션 독립 테스트/유지보수
- 미래 안 B (탭) 마이그레이션 시 섹션 단위 재배치 용이
- 현 347 line 단일 파일 → 4 파일 평균 100 line 미만

#### 3-3. URL redirect (Q3=a 권고)

옵션 1: **server page redirect** (간결)
```tsx
// app/dashboard/bbq-products/page.tsx
import { redirect } from 'next/navigation';
export default function Page() {
  redirect('/dashboard/bbq#products');
}
```

옵션 2: **next.config redirects** (캐시 활용)
```ts
// next.config.ts
async redirects() {
  return [
    { source: '/dashboard/bbq-products', destination: '/dashboard/bbq#products', permanent: false },
  ];
}
```

**권고**: 옵션 1 — auth 체크가 필요 없는 단순 redirect 라 simpler.

#### 3-4. 사이드바 V2 갱신

`components/layout/Sidebar.tsx`:
```diff
const assetNav: NavItem[] = [
  { href: '/dashboard/farms', label: '농장 관리', icon: Map },
  { href: '/dashboard/rentals', label: '임대 계약', icon: FileText },
  { href: '/dashboard/bbq', label: '평상 설정', icon: Settings2 },
- { href: '/dashboard/bbq-products', label: '평상 메뉴', icon: Package },
];

const legacyMemberNav: NavItem[] = [
  ...
  { href: '/dashboard/bbq', label: '평상 설정', icon: Settings2 },
- { href: '/dashboard/bbq-products', label: '평상 메뉴', icon: Package },
  ...
];
```

자원·시설 그룹: 4 → 3 항목.

`ALL_NAV_HREFS` 는 배열 합집합이라 자동 갱신 (수동 작업 X).

#### 3-5. E2E 갱신

`e2e/qa-prod-validation.spec.ts:135-145`:
```diff
test('8. 사이드바 — "평상" 워딩 변경 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('link', { name: '평상 예약 현황' })).toBeVisible();
  await expect(page.getByRole('link', { name: '평상 설정' })).toBeVisible();
- await expect(page.getByRole('link', { name: '평상 메뉴' }).first()).toBeVisible();
+ // "평상 메뉴" 메뉴는 평상 설정 페이지 내부 §3 섹션으로 통합 (2026-05-16)
+ await expect(page.getByRole('link', { name: '평상 메뉴' })).toHaveCount(0);

  await page.screenshot({ path: '/tmp/qa-v2-sidebar.png', fullPage: true });
});
```

신규 test 추가 (선택):
```ts
test('9. 평상 설정 — 상품·이벤트 섹션 통합 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(`${BASE}/dashboard/bbq`);
  await page.waitForLoadState('networkidle');

  // §1 배치도, §2 타임슬롯, §3 상품·이벤트 모두 visible
  await expect(page.getByRole('heading', { name: '평상 배치도' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '타임 슬롯' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '상품·이벤트' })).toBeVisible();
  
  // 상품 1건 표시
  await expect(page.getByText('평상 예약 (기본)')).toBeVisible();
});

test('10. /bbq-products redirect 검증', async ({ page }) => {
  await adminLogin(page);
  await page.goto(`${BASE}/dashboard/bbq-products`);
  await page.waitForURL(/\/dashboard\/bbq/);
  // 해시 fragment 확인 (선택)
});
```

---

### Phase 2 — 후속 (선택, 별도 PR)

| 항목 | 사유 | 작업량 |
|---|---|---|
| 페이지 진입 시 `#products` 해시 자동 스크롤 | UX 미세 개선 | 0.25h |
| §3 KPI 카드 (상품/이벤트 카운트) 추가 | 정보 밀도 ↑ | 0.5h |
| `<details>` 펼침 상태 localStorage 저장 | 운영자 선호 기억 | 0.5h |
| 미래 상품 5+ 시 안 B 탭 마이그레이션 | 데이터 임계 도달 시 | 별도 RICE |

---

## 4. 변경 전후 비교

### Before

```
사이드바 (V2):
  자원·시설
    농장 관리
    임대 계약
    평상 설정      → /bbq (시설+타임슬롯)
    평상 메뉴      → /bbq-products (상품+이벤트)  ❌ 1+1 데이터에 별도 페이지

총 페이지 2개 · 사이드바 4 항목
```

### After (안 A)

```
사이드바 (V2):
  자원·시설
    농장 관리
    임대 계약
    평상 설정      → /bbq  ✅ 시설+타임슬롯+상품+이벤트 통합

  + redirect: /bbq-products → /bbq#products

총 페이지 1개 · 사이드바 3 항목
```

---

## 5. 검증 계획

### 5-1. tsc / build / lint
- `npx tsc --noEmit` → 0 에러
- `npm run build` → 0 에러
- ESLint react/no-unused-imports 검사

### 5-2. Playwright (자동)

| 시나리오 | 검증 |
|---|---|
| `/dashboard/bbq` 진입 | 4개 섹션 visible (§1~§3 + §4 collapsible header) |
| §3 상품 카드 | "평상 예약 (기본)" + "오픈기념 이벤트" visible |
| [신규 상품] 버튼 | BbqProductModal 오픈 |
| [이벤트 추가] 버튼 | BbqEventModal 오픈 |
| §4 `<details>` 펼침 | 시설 5건 테이블 표시 |
| `/dashboard/bbq-products` 직접 진입 | `/dashboard/bbq` 로 redirect |
| 사이드바 "평상 메뉴" 미존재 | `count = 0` |
| 사이드바 자원·시설 그룹 3 항목 | 농장/임대/평상 설정 |

### 5-3. 시각 회귀
- `/tmp/bbq_before.png` (현 §1~§4) vs `/tmp/bbq_after.png` (신 §1~§4 with §3 NEW)
- 데스크탑 1280 + 모바일 375

### 5-4. 접근성
- 각 섹션에 `<h2>` 또는 `<h3>` 유지 (기존 `<h3>` 그대로)
- `<details>` 의 `<summary>` 키보드 접근성 ✓
- 모달 focus trap (기존 BbqProductModal/BbqEventModal 패턴 유지)

---

## 6. 롤백 시나리오

| 시나리오 | 방법 | 소요 |
|---|---|---|
| 전체 롤백 | `git revert <commit>` | 1분 + Vercel 빌드 |
| sidebar 항목만 복원 | Sidebar.tsx 단독 revert | 1분 |
| redirect 만 제거 | bbq-products/page.tsx 원복 | 1분 |

---

## 7. 커밋 전략

### 권고 1: 단일 커밋

```
refactor(bbq): 평상 메뉴 페이지 → 평상 설정 §3 섹션 통합

배경
- /dashboard/bbq-products 페이지는 상품 1건 + 이벤트 1건 (Supabase MCP 실측)
- 별도 페이지 비용 대비 가치 낮음 (refactoring-ui §6 정보 밀도)
- 운영자 JTBD: 시설 ↔ 가격 정책 함께 갱신하는 컨텍스트

변경
- app/dashboard/bbq/page.tsx
  · §1 평상 배치도 (기존)
  · §2 타임 슬롯 (기존)
  · §3 상품·이벤트 (신규 통합)
  · §4 시설 목록 (collapsible <details>)
- components/admin-bbq/{Facilities,TimeSlots,Products,FacilitiesTable}Section.tsx
  (섹션별 컴포넌트 분리, 단일 파일 비대화 방지)
- app/dashboard/bbq-products/page.tsx
  → redirect('/dashboard/bbq#products')
- components/admin-bbq/BbqProductsPageClient.tsx 삭제
  (ProductsSection.tsx 로 재구성)
- components/layout/Sidebar.tsx
  V2 assetNav / V1 legacyMemberNav 양쪽에서 "평상 메뉴" 제거
- e2e/qa-prod-validation.spec.ts
  · 평상 메뉴 expect 제거
  · 신규 통합 검증 spec 추가

검증
- tsc 0 / build 0
- Playwright: 4 섹션 visible + redirect 동작 + 사이드바 3 항목

근거
- thoughts/research/20260516-0030_bbq_consolidation_research.md
- thoughts/plans/20260516-0100_bbq_consolidation_plan.md

영향
- DB 0 / 라이브 동작 영향 minor (외부 북마크 redirect 처리)
- 사이드바 자원·시설 그룹 4 → 3 항목 (Miller 7±2 안전)
```

### 권고 2: 분리 커밋 (검토 용이)
1. `refactor(bbq): 섹션 컴포넌트 분리 (FacilitiesSection/TimeSlotsSection/FacilitiesTable)`
2. `feat(bbq): §3 상품·이벤트 섹션 통합 (ProductsSection)`
3. `chore(routes): /bbq-products → /bbq redirect + sidebar 평상 메뉴 제거`
4. `test(e2e): 평상 통합 검증 spec 업데이트`

---

## 8. 작업량 추정

| 항목 | 시간 |
|---|---|
| 섹션 컴포넌트 분리 (Facilities/TimeSlots/Products/Table) | 1.5h |
| `/bbq/page.tsx` 통합 렌더 + KPI 헤더 | 0.5h |
| `/bbq-products/page.tsx` redirect | 5m |
| Sidebar.tsx V1/V2 양쪽 갱신 | 10m |
| E2E spec 갱신 | 15m |
| tsc / build / Playwright 회귀 | 30m |
| 스크린샷 비교 | 10m |
| 커밋 + push + 배포 검증 | 20m |
| **합계 (Phase 1)** | **~3h** |

---

## 9. 잠재 리스크 / 미해결 질문

| # | 항목 | 영향 | 대응 |
|---|---|---|---|
| R1 | 운영자 학습 비용 (메뉴 1 회 사라짐) | 낮 | release-toast "평상 메뉴는 평상 설정 페이지 내부로 이동했습니다" (선택) |
| R2 | 페이지 세로 길이 ↑ → 모바일 스크롤 부담 | 중 | §4 collapsible + 모바일 U2 햄버거 함께 burn-in 시 검증 |
| R3 | BbqProductModal/BbqEventModal import 경로 변경 | 낮 | components/admin-bbq/ 동일 디렉토리 유지 (no path change) |
| R4 | 외부 시스템 / 알림 톡 등에 /bbq-products 링크 사용? | 낮 | grep 으로 확인 + redirect 로 안전망 |
| R5 | Supabase realtime 채널 충돌 (bbq_facilities + bbq_products 동시 구독) | 낮 | 각 섹션 컴포넌트 useEffect 격리 + 현재 realtime 구독 X |
| R6 | 미래 상품 추가 시 §3 가 §1 보다 길어짐 → 사용 빈도 vs 위치 미스매치 | 중 | 안 B 탭 마이그레이션 트리거 임계: 상품 5+ 또는 이벤트 10+ |

---

## 10. 메뉴 변경 매트릭스 (참조)

| 메뉴 (V2) | Before | After |
|---|---|---|
| 농장 관리 | 자원·시설 | 자원·시설 |
| 임대 계약 | 자원·시설 | 자원·시설 |
| 평상 설정 | 자원·시설 (시설+타임슬롯) | 자원·시설 (**+상품+이벤트**) |
| **평상 메뉴** | 자원·시설 (상품+이벤트) | **제거** (§3 으로 통합) |

자원·시설 그룹: 4 → **3 항목** (Miller 안전).
전체 사이드바: 변경 없음 (6그룹 유지).

---

## 11. kk 피드백 (kk 직접 메모)

> 2026-05-16 01:30 kk 답변: "권고대로" → 모두 권고 채택

- **Q1 (통합 안)**: **A** — 3 섹션 단일 페이지
- **Q2 (시설 목록 처리)**: **1** — `<details>` collapsible 기본 닫힘
- **Q3 (URL redirect)**: **a** — `/bbq-products` → `/bbq#products`

✅ 승인 → 즉시 `/implement` 진입

---

## 12. 참조

- 리서치: `thoughts/research/20260516-0030_bbq_consolidation_research.md`
- 사이드바 IA V2: `thoughts/plans/20260515-2330_sidebar_ia_redesign_plan.md` (Phase 1 적용 완료)
- Shopify Admin Products 페이지 패턴
- Stripe Customer detail 섹션 패턴
- Mews PMS Rate Management
- Refactoring UI — 정보 밀도, 섹션 분할

---

## 13. END — 본 플랜은 kk Q1~Q3 답변 + §11 메모 후 `/implement bbq-consolidation` 으로 진행. 미승인 상태에서 구현 금지.
