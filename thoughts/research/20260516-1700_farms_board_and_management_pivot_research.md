# 농장 현황 페이지 + 사이드바 순서 + 관리 이동 버튼 패턴 (2026-05-16)

> **목적**: 사용자 요청 3건 — (1) 농장 현황 페이지 신설 (평상 현황 모델 모방) (2) 사이드바 [일별 운영] 순서 변경 (3) 현황 → 관리 이동 버튼 — 의 사실/근거/업계 표준 정리
> **스킬**: ui-ux-pro-max + product-manager-toolkit + design:design-system + ux-heuristics
> **상태**: 사용자 (kk) 검토 대기 → plan.md (별도) 로 권고안 확정

---

## 0. 한 줄 요약

> 평상 현황 페이지 패턴을 농장에 동일 적용: 신규 `/dashboard/farms-board` (현황 — 매트릭스 + KPI + 임차인 검색) + 기존 `/dashboard/farms` (관리 유지). 사이드바 [일별 운영]: 대시보드 / **농장 현황** / **평상 현황** / 신청 관리 / 문의 관리 순. 현황 페이지 우측 상단에 "관리하기 →" outlined 버튼으로 관리 페이지 진입. Cloudbeds Reservations + Shopify Orders 패턴 모방.

---

## 1. 현재 코드 사실 (정밀 인용)

### 1-1. 사이드바 V2 일별 운영 그룹 (`components/layout/Sidebar.tsx`)

```tsx
const dailyOpsNav: NavItem[] = [
  { href: '/dashboard',           label: '대시보드',         icon: LayoutDashboard },
  { href: '/dashboard/requests',  label: '신청 관리',         icon: ClipboardList },
  { href: '/dashboard/bbq-board', label: '평상 예약 현황',     icon: LayoutGrid },
  { href: '/dashboard/inquiries', label: '문의 관리',         icon: MessageSquare },
];
```

자원·시설 그룹:
```tsx
const assetNav: NavItem[] = [
  { href: '/dashboard/farms',   label: '농장 관리', icon: Map },
  { href: '/dashboard/rentals', label: '임대 계약', icon: FileText },
  { href: '/dashboard/bbq',     label: '평상 설정', icon: Settings2 },
];
```

### 1-2. 평상 현황 페이지 패턴 (`/dashboard/bbq-board`)

| 요소 | 구현 |
|---|---|
| 헤더 + KPI | `BoardKpiCard` (sticky) |
| 매트릭스 | 시설×타임 grid (`BoardMatrix` / `BoardWeekTape`) |
| 탭 | 오늘/내일/이번 주 |
| 검색 | client-side 회원명/연락처 filter |
| Realtime | Supabase Realtime + 30s/5min 폴링 |
| 사이드 패널 | `ReservationSidePanel` (셀 클릭) |
| 이력 검색 | §하단 `BoardHistorySection` (082 RPC, 신규 추가) |

### 1-3. 농장 관리 페이지 (`/dashboard/farms` — 318 lines)

| 요소 | 구현 |
|---|---|
| 헤더 | "농장 관리" + ExportButton + FarmAddModal trigger |
| 컴포넌트 | `FarmMap` (배치도) / `FarmDrawer` (사이드 패널) / `FarmAddModal` |
| 데이터 | `useFarms()` — farms + zones + pendingOrders |
| CRUD | 신규/수정/삭제 (drawer 내부) |
| Map | zone × number grid 형태 |

### 1-4. DB 실측 (Supabase MCP)

| 항목 | 값 |
|---|---|
| 농장 (`farms`) | **60개** (A존 + B존, deleted_at IS NULL) |
| 운영 zone | 2개 (A존 + B존) |
| 활성 임대 (`memberships`) | **35건** |
| 30일 내 만료 | **0건** |
| 비운영 zone | C존 + 'ㅇㅇ' (handover 기록) |

### 1-5. 데이터 흐름

- `farms_active` view + `farm_zones_active` view + `farm_rentals` (status='active') + `memberships`
- 농장 ↔ 멤버십: `memberships.farm_id`로 연결
- 만료 임박: `memberships.end_date <= CURRENT_DATE + INTERVAL '7 days'`

---

## 2. 유사 SaaS 패턴

### 2-1. Cloudbeds Hotel PMS

**Reservations Calendar (운영 보드)**:
- 객실×날짜 grid (similar to 평상 시설×타임)
- 셀 = 예약, 색상 = 상태 (체크인/체크아웃/소거)
- 우측 상단에 **"Rooms"** 링크 (객실 설정 페이지로 진입)

**Rooms (관리)**:
- 객실 추가/수정/요금 설정
- 별도 URL `/admin/rooms`

→ **pocolush 일치 패턴**: 현황 (boards) ↔ 관리 (admin) 분리, 우측 상단 진입 버튼.

### 2-2. Shopify Admin

**Orders (현황)**:
- 좌측 상단 헤더, 우측 상단에 **"Export"** + **"More actions"** (Settings 직접 링크 X — 사이드바로 진입)

**Inventory** 페이지는 우측 상단에 **"Manage product"** 텍스트 링크.

→ **권고**: 현황 페이지 우측 상단 "관리하기 →" 또는 "→ 농장 설정" outlined 버튼 + Settings 아이콘.

### 2-3. Stripe Dashboard

**Payments (현황)**:
- 우측 상단 **"Settings"** 톱니바퀴 아이콘 → 별도 설정 페이지

### 2-4. 패턴 추출 — 현황 ↔ 관리 이동 버튼

| 요소 | Cloudbeds | Shopify | Stripe | 권고 |
|---|---|---|---|---|
| 위치 | 헤더 우측 상단 | 헤더 우측 상단 | 헤더 우측 상단 | **헤더 우측 상단** ⭐ |
| 스타일 | outlined link | outlined button | icon-only | **outlined button + icon + 라벨** ⭐ |
| 라벨 | "Rooms" | "Manage" / "More actions" | (icon) | **"관리하기"** ⭐ |
| 아이콘 | (없음) | (없음) | Settings | **Settings2 (lucide)** ⭐ |
| 클릭 | 별도 페이지 이동 | 별도 페이지 이동 | 별도 페이지 이동 | **`<Link href>`** ⭐ |

---

## 3. ux-heuristics 진단

| Nielsen | 현 상태 | 점수 |
|---|---|---|
| #1 가시성 | 농장 현황 페이지 부재 → 운영자가 60 농장 상태 한눈에 못 봄 | 4/10 |
| #2 매칭 | 평상 = 현황+관리, 농장 = 관리만 → mental model 불일치 | 5/10 |
| #4 일관성 | 도메인 간 IA 불일치 — 평상 패턴이 농장에 없음 | 5/10 |
| #6 인식 | 사이드바 [일별 운영] 4개 중 신청관리가 평상현황 위에 있음 — 빈도 vs 위치 미스매치 | 7/10 |

**Krug Trunk Test**:
> "운영자가 6월 1일 만료 예정 농장이 몇 개인지 확인"
> 현재 → `/dashboard/farms` 진입 → 60개 중 만료일 정렬/필터 → 어려움
> 개선 → `/dashboard/farms-board` 진입 → KPI "만료 임박 N건" 즉시

---

## 4. PM JTBD + RICE

### 4-1. 운영자 Jobs to be Done

| JTBD | 빈도 | 현 경로 | 신규 |
|---|---|---|---|
| 오늘 농장 점유율 확인 | **매일** | 농장 관리 페이지 60카드 스캔 | `/farms-board` KPI |
| 만료 임박 농장 파악 | 주 1~2회 | 없음 | KPI "만료 임박 N건" |
| 빈 농장 위치 확인 | 주 1~2회 | 농장 관리 zone별 grid | 동일 (보드 매트릭스) |
| 임차인 검색 (전화 응대) | 일 1~2회 | **불가** ❌ | 검색바 |
| 농장 신규 등록 / 가격 수정 | 월 1회 | 농장 관리 (그대로) | 우측 상단 "관리하기 →" |
| zone 변경 | 분기 1회 | 농장 관리 + Drawer (그대로) | 관리 페이지 |

### 4-2. RICE

| 항목 | 값 | 근거 |
|---|---|---|
| Reach | admin 1 | 운영자 1명 |
| Impact | **3 (high)** | 매일 사용 + JTBD 5개 충족 |
| Confidence | **0.95** | 평상 패턴 그대로 적용 (검증됨) |
| Effort | **M (~6h)** | RPC 신규 1 + UI 컴포넌트 3개 + Sidebar 갱신 |

**RICE = 1 × 3 × 0.95 / 3 = 0.95** (MUST HAVE)

---

## 5. 통합 4 안 비교

### 안 A — 신규 `/dashboard/farms-board` (현황) + 기존 `/dashboard/farms` 보존 ⭐

```
사이드바 [일별 운영]
  대시보드
  농장 현황      ← NEW (/dashboard/farms-board)
  평상 현황      ← 라벨 단축 (/dashboard/bbq-board)
  신청 관리
  문의 관리

사이드바 [자원·시설]
  농장 관리      ← 그대로 (/dashboard/farms)
  임대 계약
  평상 설정
```

**장점**:
- 평상 패턴 (현황 + 관리 분리) 그대로 적용 → 일관성
- 농장 관리 페이지 변경 0 (CRUD 그대로)
- 신규 페이지만 추가 — 영향 격리

**단점**:
- 사이드바 일별 운영 그룹 4 → 5 항목 (Miller 7±2 안전)

### 안 B — 기존 `/dashboard/farms` 에 "현황 / 관리" 탭 추가

**장점**: URL 1개, 컨텍스트 동일
**단점**: 평상 패턴 불일치 + 318 lines 페이지 더 복잡

### 안 C — `/dashboard/farms` 자체를 현황으로 만들고 CRUD를 별도 페이지로 이동

**장점**: URL 호환 (기존 사이드바 진입자가 현황 직접 봄)
**단점**: 기존 북마크 깨짐 + Drawer/Modal 동작 변경

### 안 D — Cloudbeds 풀 모방 (Rooms 탭 + 별도 Rates 탭 + Calendar 탭)

**장점**: 깊은 분리
**단점**: 농장은 단순한 도메인 — over-engineering

### 비교 표

| # | 안 | RICE | JTBD | 일관성 | 위험 |
|---|---|---|---|---|---|
| **A** | **신규 페이지 + 기존 보존** | **0.95** | 9/10 | 9/10 ⭐ | LOW |
| B | 탭 추가 | 0.7 | 7/10 | 5/10 | MID |
| C | 현황으로 페이지 변경 | 0.5 | 8/10 | 7/10 | HIGH |
| D | Cloudbeds 풀 모방 | 0.4 | 9/10 | 6/10 | LOW |

**권고**: **안 A** — 평상 패턴 일관 + 영향 격리 + RICE 최고.

---

## 6. 농장 현황 페이지 (`/dashboard/farms-board`) 설계

### 6-1. 컴포넌트 구조

```
헤더
  좌측: h1 "농장 현황" + 부제
  우측: lastFetched + ⟳ 새로고침 + "관리하기 →" outlined 버튼
  
KPI 카드 (sticky 또는 비sticky — 사용자 검토)
  ┌────────┬──────────┬──────────┬─────────┬────────┐
  │ 총 60  │ 임대중   │ 만료 임박 │ 비어있음 │ 비운영 │
  │        │ 35       │ 0 (7일)  │ 25      │ 0     │
  └────────┴──────────┴──────────┴─────────┴────────┘

검색바: 임차인명 / 전화번호 (좌측)

매트릭스 (zone 별 grid)
  [A존] 40개 (8×5)
  [B존] 20개 (4×5)
  - 셀: 농장 번호 + 임차인명 + 상태색
  - 빈 농장: 회색
  - 임대중: 녹색
  - 만료 임박 (7일 내): 황색
  - 비운영: 회색 + opacity-50

셀 클릭 → 사이드 패널 (FarmDrawer 재활용 또는 신규 FarmSidePanel)
```

### 6-2. KPI 정의

| KPI | 정의 | 계산 |
|---|---|---|
| 총 농장 | farms 총수 (운영 zone 만) | `COUNT(*) WHERE deleted_at IS NULL AND zone.is_operational` |
| 임대중 | active 멤버십 수 | `COUNT(memberships WHERE status='active')` |
| 만료 임박 | 7일 이내 만료 | `COUNT(memberships WHERE status='active' AND end_date <= CURRENT_DATE + 7)` |
| 비어있음 | 총 - 임대중 | `total - active` |
| 비운영 | 비운영 zone 농장 | `COUNT(farms WHERE zone.is_operational = FALSE)` |

### 6-3. 데이터 모델 — 옵션

**옵션 A**: 기존 `useFarms()` 재사용 (현재 318 lines page 와 동일 데이터)
- 장점: 코드 재사용
- 단점: useFarms 가 모든 데이터 fetch (zone + rental + orders) → 무거움

**옵션 B**: 신규 RPC `get_farms_board()` 신설 (마이그 084)
- 장점: 보드 전용 최소 컬럼 + admin only + PIPA audit (079 패턴)
- 단점: 신규 마이그

**권고**: **옵션 A** (빠른 출시) + Phase 2 에서 옵션 B 마이그레이션 (5년 후 audit 부담 시).

### 6-4. 만료 임박 임계

| 임계 | 사유 |
|---|---|
| **7일** ⭐ | 평상 패턴 (실시간 운영) + 즉시 액션 |
| 30일 | 너무 길어 KPI 항상 큰 숫자 |
| 0~7일 (단계) | KPI 2개 분할 (1~3일 위급, 4~7일 경고) — Phase 2 |

---

## 7. 사이드바 메뉴 순서 변경

### 7-1. 변경 전후

```
Before (현재 V2):
[일별 운영]
  대시보드
  신청 관리
  평상 예약 현황
  문의 관리

After:
[일별 운영]
  대시보드
  농장 현황    ← NEW
  평상 현황    ← 라벨 단축 (예약 제거)
  신청 관리    ← 평상 아래로
  문의 관리
```

### 7-2. 라벨 단축 검토

"평상 예약 현황" → "평상 현황":
- 농장 현황과 짝 (현황 통일)
- 4자 짧음 (시각 균형)
- "예약" 제거 → 실제 페이지는 예약 + 시설 운영 모두 표시 (예약 한정 X)

**권고**: 단축 적용 (사용자 표현 그대로).

### 7-3. ALL_NAV_HREFS 영향

자동 갱신 (Set 합집합). 수동 작업 X.

### 7-4. 자원·시설 그룹 영향

```
[자원·시설]
  농장 관리    ← 그대로 (현황 별개 페이지)
  임대 계약
  평상 설정
```

변경 0. "농장 관리" 라벨도 유지 (운영자가 관리 페이지로 진입할 수 있는 직접 경로).

---

## 8. "관리하기 →" 버튼 패턴

### 8-1. 위치 + 디자인

```tsx
// 우측 상단 헤더 영역
<Link
  href="/dashboard/farms"
  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-accent cursor-pointer transition-colors"
>
  <Settings2 className="size-4" />
  관리하기
  <ArrowRight className="size-3.5" />
</Link>
```

### 8-2. 적용 위치

| 현황 페이지 | 관리 페이지 (이동 대상) |
|---|---|
| `/dashboard/farms-board` (NEW) | `/dashboard/farms` (기존) |
| `/dashboard/bbq-board` (기존) | `/dashboard/bbq` (기존, 평상 설정 통합 페이지) |

### 8-3. UX 원칙

- **명확한 동선**: "현황 → 관리" 진입을 단방향으로 안내 (역방향은 사이드바 클릭)
- **유사 패턴 통일**: 두 현황 페이지 모두 동일 버튼 디자인
- **모바일**: 작은 화면에서는 아이콘 + 라벨 short 또는 dropdown으로

---

## 9. 8축 + 7점 종합

| 축 | 결과 |
|---|---|
| A 보안 | 농장 현황 RPC admin only (옵션 B 선택 시) ✅ |
| B RLS | farms_active view + RLS 정책 유지 ✅ |
| C UX | 평상 패턴 일관 + 빈도 기반 메뉴 순서 ✅ |
| D 성능 | useFarms 재사용 (옵션 A) → 신규 query 0 ✅ |
| E 통합/회귀 | 기존 /farms 변경 0 / Sidebar V1/V2 합집합 ✅ |
| F 데이터명 | farms-board / FarmsBoard / useFarmsBoard 일관 ✅ |
| G 사이드이펙트 | ALL_NAV_HREFS 자동 갱신 + active 매칭 prefix 충돌 점검 (farms vs farms-board) ⚠ |
| H 배포안전 | 신규 페이지 단독, 롤백 ~50s ✅ |

⚠ **G 주의**: `/dashboard/farms-board` 와 `/dashboard/farms`가 prefix 충돌 가능 — Sidebar active 매칭에서 farms-board 진입 시 farms도 active 될 위험. 현재 `Sidebar.tsx:69-75`의 `moreSpecific` 분기로 자동 처리되지만 검증 필요.

## 7점

| # | 결과 |
|---|---|
| #1 인증/권한 | admin only (layout.tsx) ✅ |
| #2 비정상 경로 | active 매칭 fallback ✅ |
| #5 비밀정보 | 변경 없음 ✅ |
| #6 런타임 | tsc/build/Playwright 검증 ✅ |

---

## 10. 리스크 + 완화

| # | 항목 | 가능성 | 완화 |
|---|---|---|---|
| R1 | farms vs farms-board active 매칭 충돌 | LOW | ALL_NAV_HREFS prefix 매칭 자동 처리 (Sidebar.tsx:67-70) + Playwright spec 1건 |
| R2 | useFarms 무거운 fetch (zone + rentals + orders) → 보드 진입 느림 | LOW | Phase 2 RPC 분리 (084) |
| R3 | "농장 관리" 메뉴를 자원·시설에서 제거 요청? | LOW | 본 plan 은 보존 — kk 결정 시 별도 |
| R4 | 만료 임박 7일 임계가 너무 짧음 | LOW | 운영 1주 burn-in 후 조정 |
| R5 | 모바일 매트릭스 가로 스크롤 | MID | overflow-x-auto + 모바일 viewport 검증 |

---

## 11. 출처

- [Cloudbeds Reservations Tab](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/218512847)
- [Cloudbeds Rooms Tab — Settings 분리](https://myfrontdesk.cloudbeds.com/hc/en-us)
- [Shopify Admin Navigation](https://shopify.dev/docs/apps/design/navigation)
- [Stripe Dashboard Patterns](https://docs.stripe.com/dashboard/basics)
- Mews PMS Calendar/Rates 분리 패턴
- Nielsen 휴리스틱 #1 #2 #4 #6
- Krug Trunk Test
- 사내: thoughts/research/20260516-0030_bbq_consolidation_research.md (4섹션 패턴)
- 사내: thoughts/research/20260516-1330_bbq_board_history_research.md (보드 패턴)
- 사내: lib/use-data.ts:237-276 (useFarms)
- 사내: supabase/migrations/002_farms.sql (스키마)
- 사내: components/farms/FarmMap.tsx / FarmDrawer.tsx
