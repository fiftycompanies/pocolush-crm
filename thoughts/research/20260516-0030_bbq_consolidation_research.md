# 평상 메뉴 ↔ 평상 설정 통합 — 리서치 (2026-05-16)

> **목적**: `/dashboard/bbq-products` (평상 메뉴) 의 별도 페이지 존재 정당성 재평가 + `/dashboard/bbq` (평상 설정) 내부로의 통합 방안 4안 비교.
> **선행**: `thoughts/research/20260515-2300_sidebar_ia_redesign.md` (사이드바 IA V2 적용 완료)
> **상태**: 사용자 (kk) 검토 대기 → plan.md (별도) 로 권고안 확정.

---

## 0. 한 줄 요약

> 평상 메뉴 페이지는 **상품 1건 + 이벤트 1건**으로 단독 페이지 비용 대비 가치가 매우 낮다. 평상 설정 페이지에 **3 섹션 단일 페이지** 또는 **2 탭** 구조로 흡수 권고. 변경 후 사이드바 평상 그룹은 3 → 2 항목으로 축소.

---

## 1. 실측 사실 (Supabase MCP)

| 도메인 | 테이블 | row | 상태 |
|---|---|---|---|
| 시설 | `bbq_facilities` | **5** | 활성 4 + 비활성 1 (#5 테스트) |
| 타임슬롯 | `bbq_time_slots` | **3** | 모두 활성 (1타임/2타임/3타임) |
| 상품 | `bbq_products` | **1** | "평상 예약 (기본)" 30,000원 · 120분 |
| 이벤트 | `bbq_events` | **1** | "오픈기념 이벤트" 무료 · 2026-04-18 ~ 08-31 |

**→ 평상 메뉴 페이지의 총 컨텐츠는 카드 1개 + 서브 row 1개**. 별도 페이지로 분리할 만큼의 정보 밀도가 없음.

---

## 2. 현 코드 구조

### 2-1. `/dashboard/bbq` (347 lines)
**파일**: `app/dashboard/bbq/page.tsx` (client)

**섹션 4개**:
1. 헤더: "평상 설정" + 전체/활성 개수 + [시설 추가]
2. 시설 추가/수정 폼 (showForm)
3. **평상 배치도** — 시설 카드 grid (6col @md)
4. **타임 슬롯** — CRUD 리스트 + 인라인 폼
5. **시설 목록 테이블** — 번호/이름/가격/상태/메모/액션

**DB**: `bbq_facilities`, `bbq_time_slots` (`useTimeSlots` 훅)

### 2-2. `/dashboard/bbq-products` (216 lines)
**파일**: `app/dashboard/bbq-products/page.tsx` (server, 19 lines) + `components/admin-bbq/BbqProductsPageClient.tsx` (216 lines)

**섹션 2개**:
1. 헤더: "평상 메뉴 관리" + 상품/이벤트 카운트 + [신규 상품]
2. 상품 카드 리스트
   - 각 카드: 이름 + 활성/비활성 + 진행중 이벤트 칩 + 기본가/시간 + [이벤트 추가][수정][삭제]
   - 이벤트 sub-list: 이름/가격/기간/상태 + 수정/삭제

**DB**: `bbq_products`, `bbq_events`
**Modal**: `BbqProductModal` (124 lines), `BbqEventModal` (122 lines)

---

## 3. 사이드바 V2 평상 그룹 현황

```
[자원·시설]
  농장 관리
  임대 계약
  평상 설정       ← /dashboard/bbq
  평상 메뉴       ← /dashboard/bbq-products  ← 통합 대상
```

통합 후:
```
[자원·시설]
  농장 관리
  임대 계약
  평상 설정       ← 시설 + 타임슬롯 + 상품/이벤트 (통합)
```

자원·시설 그룹 4 → 3 항목으로 축소 (Miller 7±2 안전).

---

## 4. ux-heuristics 진단

### 4-1. 현 상태 (별도 페이지)

| Nielsen | 현 상태 | 점수 |
|---|---|---|
| #2 매칭 | "평상 메뉴"라는 단어가 페이지에 들어가도 상품 1개만 — 약속 미달 | 4/10 |
| #4 일관성 | 평상 설정과 메뉴가 분리됐는데 운영자는 함께 갱신 (시설↔가격) | 5/10 |
| #6 인식 > 회상 | 사이드바 진입 → 어디서 가격 바꾸나 회상 필요 | 6/10 |
| #8 미니멀 | 상품 1개 페이지 = 시각 잡음/낭비 | 3/10 |

### 4-2. Krug
- "Don't make me think" — "평상 메뉴" 라벨이 모호 (식자재 메뉴 vs 상품 메뉴 vs 운영 메뉴?)
- 트렁크 테스트 — 신규 운영자가 "오픈기념 이벤트 종료일 변경" 위해 어디 갈지? "평상 설정"이 더 자연스러움 → 통합 후 발견성 ↑

---

## 5. PM JTBD + RICE

### 5-1. 운영자 Jobs to be Done

| JTBD | 빈도 | 현 경로 | 통합 후 경로 |
|---|---|---|---|
| 신규 시설 추가 (예: 평상 6번) | 분기 1회 | `/bbq` | `/bbq` 동일 |
| 타임슬롯 추가/수정 | 반기 1회 | `/bbq` | `/bbq` 동일 |
| 시설 임시 비활성 | 월 1~2회 | `/bbq` | `/bbq` 동일 |
| 기본가 변경 (성수기) | 월 1회 | `/bbq-products` (별도 진입) | `/bbq` 같은 페이지 스크롤/탭 |
| 이벤트 등록 (할인) | 분기 1회 | `/bbq-products` | `/bbq` 같은 페이지 |
| 이벤트 종료/연장 | 월 1회 | `/bbq-products` | `/bbq` 같은 페이지 |

**관찰**: 가격/이벤트 갱신은 **시설 정보를 같이 보고 싶은 컨텍스트** (예: "5번 시설은 비활성이니 이벤트 적용 안 해도 됨"). 통합이 자연스러움.

### 5-2. RICE

| 항목 | 값 | 근거 |
|---|---|---|
| Reach | admin 1 (낮음) | 운영자 1명 |
| Impact | **3 (high)** | 메뉴 1개 제거 + 사이드바 항목 1개 감소 + 가격↔시설 mental model 일치 |
| Confidence | **0.9 (high)** | 외부 패턴 (Shopify/Stripe) + 데이터 사용량 (1/1) 확실 |
| Effort | **S (~3h)** | 파일 통합 + redirect + 사이드바 1항목 제거 |

**RICE = 1 × 3 × 0.9 / 1 = 2.7** (Quick Win 등급)

---

## 6. refactoring-ui 진단

### 6-1. 정보 밀도
- 현 `/bbq-products` 페이지는 max-w-1100 컨테이너에 카드 1개 — **공간 90% 낭비**
- `/bbq` 페이지는 max-w-1200 + 4 섹션 = 적절
- 통합 시 한 페이지에 5 섹션 — 세로 스크롤 길이 증가하지만 정보 밀도는 개선

### 6-2. 간격 일관성
- 두 페이지 모두 `space-y-5` 또는 `space-y-6` — 일관 ✓
- max-width 차이 (1100 vs 1200) — 통합 시 **1200으로 통일** 권고

### 6-3. 카드/테이블 패턴
- 시설 = 카드 그리드 (시각적, 작은 단위)
- 타임슬롯 = 인라인 리스트 (시간 정보)
- 상품 = 카드 (수직, 이벤트 sub-list 포함)
- 시설 목록 = 테이블 (관리자 advanced)

→ 통합 시 시각 패턴 4종 혼재 — **섹션 간격 24px 통일** 필수.

---

## 7. 유사 SaaS 통합 패턴

### 7-1. Shopify Admin — "Products" 페이지 (섹션)
한 페이지에:
- Title + Description
- Media (이미지)
- Pricing
- Inventory
- Shipping
- Variants
- Search engine listing

→ **단일 페이지 + 섹션 + 사이드 패널 (Status/Organization)**. 모든 정보 한 곳.

### 7-2. Stripe Dashboard — "Customer detail" (섹션)
- Profile
- Payment methods
- Subscriptions
- Charges
- Refunds

→ **단일 페이지 + 섹션 카드** + 우측 사이드 패널.

### 7-3. Linear — "Team Settings" (탭)
- General / Members / Cycles / Triage / Estimates / Integrations / Customer requests

→ **탭** (도메인이 명확히 다를 때).

### 7-4. Notion — "Database View" (탭)
- All / Active / Archive

→ **탭** (필터링/상태 분리).

### 7-5. Hotel PMS (Mews) — "Rate Management" (섹션)
한 페이지에:
- Rate plans
- Restrictions
- Calendar pricing

→ **단일 페이지 + 섹션**.

### 7-6. 패턴 추출

| 분리 신호 | 통합 신호 |
|---|---|
| 도메인이 명확히 다름 (General vs Integrations) | 같은 도메인 (시설 + 가격 정책) |
| 각 섹션 컨텐츠가 무거움 (테이블 50+ rows) | 각 섹션 가벼움 (카드 1~5개) |
| 사용자 그룹이 다름 (admin vs developer) | 같은 사용자 (운영자 admin) |
| 권한 분리 (member 권한 분기) | 권한 동일 |

→ pocolush 평상 = **모두 통합 신호** → **섹션 권고**.

---

## 8. 통합 4 안 비교

### 안 A — 3 섹션 단일 페이지 (권고 ⭐)

```
[평상 설정]
  헤더 + KPI 칩 (시설 4 / 타임슬롯 3 / 상품 1 / 이벤트 1)

§1. 평상 배치도
  시설 카드 grid + [시설 추가]
  → 시설 추가/수정 인라인 폼

§2. 타임 슬롯
  타임 리스트 + [타임 추가]
  → 타임 추가/수정 인라인 폼

§3. 상품·이벤트   ← NEW (통합)
  상품 카드 + 이벤트 sub-list + [신규 상품] [이벤트 추가]

§4. 시설 목록 (advanced)
  테이블 (collapsible)
```

**장점**:
- 한 페이지에 모든 정보 — JTBD "가격↔시설 함께 보기" 자연스러움
- 스크롤만으로 탐색 — Krug "클릭보다 인지가 중요"
- 미래 상품 증가 시 §3 만 확장
- 모바일에서도 자연스러운 흐름

**단점**:
- 페이지 세로 길이 ↑ (현재 한 화면 → 두 화면 정도)
- 상품 카드가 많아지면 §3 가 길어져 다른 섹션 접근 비용 ↑ → 그땐 collapsible 또는 탭으로 마이그레이션

### 안 B — 2 탭 (Shopify-Locations style)

```
[평상 설정]
  탭: [시설·시간] [상품·이벤트]
  
탭1 — 시설·시간 (기본)
  배치도 + 타임슬롯 + 시설 목록
탭2 — 상품·이벤트
  상품 카드 + 이벤트
```

**장점**:
- 시설(인프라) vs 상품(가격) **개념적 분리 명확**
- 탭1 로 들어가는 운영자가 §3 부담 안 가짐
- 미래 상품/이벤트 풍부해질 때 자연 확장

**단점**:
- 탭 전환 인지/클릭 비용 1회
- URL state (`?tab=products`) 동기화 필요
- 현재 상품 1건이라 탭2 가 비어 보임

### 안 C — 아코디언 (collapsible sections)

```
[평상 설정]
  ▼ 평상 배치도 (펼침 기본)
  ▶ 타임 슬롯
  ▶ 상품·이벤트
  ▶ 시설 목록
```

**장점**:
- 시각 jam 최소 (한 번에 1~2 섹션)
- 모바일 UX 좋음

**단점**:
- 항상 펼치고 닫는 클릭 추가
- 운영자 entry 후 어떤 섹션이 열려있는지 회상 필요
- pocolush 운영 컨텍스트와 미스매치 (한 번에 모두 보고 싶음)

### 안 D — 사이드 nav + 단일 페이지 (Atlassian Admin style)

```
| 시설        | [선택 섹션 콘텐츠]
| 타임슬롯    |
| 상품·이벤트 |
| 시설 목록   |
```

**장점**:
- 큰 콘텐츠에 좋음
- 깊은 정보 탐색

**단점**:
- 단순한 설정 4 섹션에 과한 구조
- 사이드바 (V2 6그룹) + nav (4 섹션) = 이중 nav → 인지 부담

### 안 비교 표

| # | 안 | RICE | Krug | 미래확장 | 모바일 |
|---|---|---|---|---|---|
| A | 3 섹션 단일 | 3.0 ⭐ | 9/10 | 7/10 | 8/10 |
| B | 2 탭 | 2.4 | 7/10 | 9/10 ⭐ | 7/10 |
| C | 아코디언 | 1.8 | 6/10 | 6/10 | 9/10 |
| D | 사이드 nav | 1.0 | 5/10 | 8/10 | 4/10 |

**최종 권고**: **안 A (3 섹션 단일 페이지)** — 현 데이터 규모(1상품/1이벤트)에 최적, 미래 확장 시 안 B 로 점진 마이그레이션 가능.

---

## 9. 라우팅 호환성

### 9-1. URL 보존

기존 `/dashboard/bbq-products` 외부 북마크 / 링크 가능성:
- 사이드바에서만 진입 (외부 노출 X) — 사이드바 항목 제거로 충분
- 운영자 직접 북마크 가능성 — **redirect 권고**: `/dashboard/bbq-products` → `/dashboard/bbq#products`

### 9-2. sidebar V2 갱신

```diff
- { href: '/dashboard/bbq', label: '평상 설정', icon: Settings2 },
- { href: '/dashboard/bbq-products', label: '평상 메뉴', icon: Package },
+ { href: '/dashboard/bbq', label: '평상 설정', icon: Settings2 },
```

`ALL_NAV_HREFS` 자동 갱신 (V1 legacy 배열에서도 제거).

### 9-3. E2E spec 갱신

`e2e/qa-prod-validation.spec.ts:135-145`:
- "평상 메뉴" 검증 제거 또는 "평상 설정 페이지 내부 상품·이벤트 섹션" 으로 변경

---

## 10. 리스크 / 회귀 우려

| # | 항목 | 가능성 | 대응 |
|---|---|---|---|
| R1 | 운영자가 "평상 메뉴" 사이드바 클릭 시 404 | 중 | `/dashboard/bbq-products` → `/dashboard/bbq#products` redirect (next.config redirects 또는 server page redirect) |
| R2 | 페이지 세로 길이 ↑ 로 운영자 피로 | 중 | §4 시설 목록 테이블을 `<details>` collapsible 로 |
| R3 | 통합 페이지 컴포넌트 비대화 (347+216=560 lines) | 중 | 섹션별 컴포넌트 분리 (`<FacilitiesSection />`, `<TimeSlotsSection />`, `<ProductsSection />`) |
| R4 | 미래 상품 5+ 증가 시 §3 가 길어짐 | 낮 | 안 B 탭 마이그레이션 (RICE 재평가 후) |
| R5 | E2E qa-prod-validation 사이드바 평상 3개 검증 깨짐 | 확실 | spec 동시 갱신 (평상 메뉴 expect 제거) |
| R6 | DashboardShell U2 mobile V2 영향 | 낮 | 변경 없음 (사이드바 1 항목 제거만 영향) |

---

## 11. 7점 보안/품질 체크 (프론트엔드 변경: #1 #2 #5 #6)

| # | 항목 | 적용 | 결과 |
|---|---|---|---|
| 1 | 인증/권한 | 어드민 only (`profile?.role !== 'admin'` redirect 유지) | ✅ |
| 2 | 비정상 경로 | 통합 페이지 진입 실패 시 폴백 — 페이지 자체 client 라 영향 적음 | ✅ |
| 5 | 비밀정보 | 환경변수 변경 X | ✅ |
| 6 | 런타임 이슈 | tsc / build 통과 + Playwright 회귀 검증 | 검증 |

---

## 12. 출처

- Shopify Admin: Products 페이지 디자인 ([공식 가이드](https://shopify.dev/docs/apps/design))
- Stripe Customer detail 패턴
- Linear Team Settings (탭 패턴)
- Mews PMS Rate Management
- Nielsen 10 휴리스틱 #2 #4 #6 #8
- Krug Trunk Test
- Refactoring UI — 정보 밀도, 섹션 간격
- 사내: `thoughts/research/20260515-2300_sidebar_ia_redesign.md`
- Supabase MCP 실측 (2026-05-16)
