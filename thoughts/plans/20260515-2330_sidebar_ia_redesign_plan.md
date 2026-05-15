# 어드민 사이드바 IA 재설계 — 실행 플랜 v1

> **작성**: 2026-05-15 23:30
> **선행**: `thoughts/research/20260515-2300_sidebar_ia_redesign.md`
> **상태**: 🔴 **kk 승인 대기** (구현 금지)
> **권고 안**: research §8 의 **안 A (JTBD/빈도 기반 6 그룹)** + §9 의 간격 시스템 + §10 의 라벨 단축
> **변경 규모**: 코드 2 파일 (`Sidebar.tsx` + `e2e/qa-prod-validation.spec.ts`), DB 0, 라이브 영향 0

---

## 0. 한 줄 요약

> 현 단일 그룹 10항목을 **6개 의미 그룹(일별 운영 / 회원 / 자원·시설 / 상거래 / 콘텐츠 / 시스템)** 으로 분할하고, **그룹 간 간격을 24px 단일 토큰**으로 통일하며, **2개 긴 라벨을 페이지 h1과 일치하도록 단축** ("평상 설정", "평상 메뉴"). Feature flag `NEXT_PUBLIC_SIDEBAR_IA_V2` 로 점진적 출시.

---

## 1. kk 결정 필요 (체크리스트)

진입 전 다음 4가지 결정 부탁드립니다:

| Q | 항목 | 옵션 | 권고 |
|---|---|---|---|
| **Q1** | 그룹 안 선택 | (A) JTBD/빈도 6그룹 / (B) 도메인 5그룹 / (C) 평면 + 빈도 정렬 | **A** ⭐ |
| **Q2** | 라벨 단축 범위 | (1) 평상 2개만 / (2) +"경고"→"시스템 경고" / (3) +"신청 관리"→"신청" | **1** ⭐ (최소 변경) |
| **Q3** | feature flag 적용 | (a) flag 도입 1주 burn-in / (b) flag 없이 즉시 적용 | **a** ⭐ (안전) |
| **Q4** | 평상 그룹 아이콘 통일 | (i) 현행 유지 (LayoutGrid/Settings2/Package) / (ii) 모두 Tent 계열 | **i** ⭐ (아이콘 다양성 유지) |

> 답변 형식: "Q1=A, Q2=1, Q3=a, Q4=i" 또는 자유 메모. 답변 후 ② **kk 피드백** 섹션 (§13) 에 직접 메모 부탁드립니다.

---

## 2. Phase 구분 (라이브 영향 0)

### Phase 1 — 즉시 안전 묶음 (라이브 영향 0)

라벨 단축 + 간격 토큰 통일 + 그룹 재구성. flag 없이 적용해도 회귀 거의 없으나 안전상 flag 권고.

#### 2-1. 변경 파일

| 파일 | 변경 | 영향 |
|---|---|---|
| `components/layout/Sidebar.tsx` | 그룹 배열 재구성 + 간격 토큰 통일 + 라벨 2개 단축 | 데스크탑/모바일 어드민 |
| `e2e/qa-prod-validation.spec.ts:135-145` | "평상 시설·운영시간" → "평상 설정" / "평상 메뉴·이벤트" → "평상 메뉴" | E2E 검증 일치 |
| `app/dashboard/layout.tsx` | 무변경 (DashboardShell 그대로) | 0 |
| `components/layout/DashboardShell.tsx` | 무변경 | 0 |

#### 2-2. Sidebar.tsx 신규 구조 (의사 코드)

```tsx
// ---- 안 A: JTBD/빈도 기반 6 그룹 ----

const dailyOpsNav = [   // 매일 1회+
  { href: '/dashboard',                  label: '대시보드',         icon: LayoutDashboard },
  { href: '/dashboard/requests',         label: '신청 관리',         icon: ClipboardList },
  { href: '/dashboard/bbq-board',        label: '평상 예약 현황',     icon: LayoutGrid },
  { href: '/dashboard/inquiries',        label: '문의 관리',         icon: MessageSquare },
];

const memberNav = [     // 회원 라이프사이클
  { href: '/dashboard/members',          label: '회원 관리',         icon: UserCheck },
  { href: '/dashboard/memberships',      label: '회원권 관리',       icon: Award },
  { href: '/dashboard/notices',          label: '공지 관리',         icon: Megaphone },
];

const assetNav = [      // 운영 자산
  { href: '/dashboard/farms',            label: '농장 관리',         icon: Map },
  { href: '/dashboard/rentals',          label: '임대 계약',         icon: FileText },
  { href: '/dashboard/bbq',              label: '평상 설정',         icon: Settings2 },  // 단축 ①
  { href: '/dashboard/bbq-products',     label: '평상 메뉴',         icon: Package },     // 단축 ②
];

const commerceNav = [   // 상거래
  { href: '/dashboard/store',            label: '스토어 설정',       icon: ShoppingBag },
  { href: '/dashboard/plans',            label: '플랜 관리',         icon: CreditCard },
  { href: '/dashboard/coupons',          label: '쿠폰 설정',         icon: Ticket },
];

const contentNav = [    // 콘텐츠
  { href: '/dashboard/blog',             label: '블로그 관리',       icon: FileEdit },
];

const systemNavBase = [ // 시스템 (하단 고정)
  { href: '/dashboard/audit-logs',       label: '감사 로그',         icon: ClipboardCheck },
  { href: '/dashboard/notifications',    label: '알림 설정',         icon: Bell },
  { href: '/dashboard/settings',         label: '설정',             icon: Settings },
];

const warningNav = [
  { href: '/dashboard/warning',          label: '경고',             icon: AlertTriangle },
];
```

#### 2-3. 간격 시스템 (research §9 권고 적용)

```tsx
// 그룹 헤더 (12px + 위 24 + 아래 8)
<div className="mt-6">
  <p className="px-3 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-2">
    {groupLabel}
  </p>
  {items.map(renderItem)}
</div>

// 첫 그룹(dailyOps) 만 mt-0
// separator 제거 (mt-6 만으로 분리)

// 하단 영역
<div className="mt-6 px-3 py-4 border-t border-sidebar-border flex flex-col gap-1">
  {systemNav.map(renderItem)}
</div>
```

#### 2-4. ALL_NAV_HREFS 변수 갱신

기존 line 47-49 패턴 유지하되 신규 배열명 반영:
```tsx
const ALL_NAV_HREFS: string[] = [
  ...dailyOpsNav, ...memberNav, ...assetNav, ...commerceNav,
  ...contentNav, ...systemNavBase, ...warningNav,
].map(i => i.href);
```

#### 2-5. Feature Flag 도입 (Q3=a 선택 시)

```tsx
// 환경변수: NEXT_PUBLIC_SIDEBAR_IA_V2=1 (default off → 1주 후 default on)
const IA_V2 = process.env.NEXT_PUBLIC_SIDEBAR_IA_V2 === '1';

return IA_V2 ? <SidebarV2 ... /> : <SidebarLegacy ... />;
```

- 구현: Sidebar.tsx 내부에서 분기 (별도 컴포넌트 분리 X — 코드 비대화 회피)
- 롤백: env flag off

---

### Phase 2 — Burn-in (1주, 옵션)

- Sentry breadcrumb: `sidebar_group_click` 이벤트 1주 수집 → 실제 사용 빈도 vs 가설 검증
- 메트릭 임계:
  - 각 그룹 그룹 헤더 ARIA 접근성 0건 에러
  - 운영자가 메뉴 못 찾아서 발생한 문의 0건
  - Sentry `cannot find route` 0건
- 통과 시 default on 전환 (env 값 production 에서 `1`)

---

### Phase 3 — 후속 (별도 PR)

| 항목 | 사유 | 작업량 |
|---|---|---|
| 페이지 h1 일관성 (회원권 관리 등 5건) | 메뉴 ↔ 페이지 라벨 정합 | 0.25일 |
| "경고" → "시스템 경고" (Q2=2 선택 시) | 페이지 h1 일치 | 5분 |
| 평상 그룹 아이콘 통일 (Q4=ii 선택 시) | 시각 그룹화 강화 | 5분 |
| storybook 등록 (Sidebar / DashboardShell) | 회귀 방지 | 0.5일 |
| Sentry breadcrumb `sidebar_*` 이벤트 | 사용 빈도 데이터 수집 | 0.25일 |

---

## 3. 변경 전후 비교

### Before (현재)

```
대시보드
문의 관리
농장 관리
임대 계약
─────
[회원 서비스]
회원 관리
회원권 관리
신청 관리
평상 예약 현황
평상 시설·운영시간    ← 9자
평상 메뉴·이벤트       ← 8자
스토어 설정
플랜 관리
쿠폰 설정
공지 관리
─────
[콘텐츠]
블로그 관리
─────────────
감사 로그
알림 설정
설정
```
- 단일 그룹 10항목 ✗ (7±2 위반)
- 그룹 간격 20/20/17 ✗ (비대칭)

### After (안 A 권고)

```
[일별 운영]
대시보드
신청 관리
평상 예약 현황
문의 관리

[회원]
회원 관리
회원권 관리
공지 관리

[자원·시설]
농장 관리
임대 계약
평상 설정           ← 5자 (단축)
평상 메뉴           ← 4자 (단축)

[상거래]
스토어 설정
플랜 관리
쿠폰 설정

[콘텐츠]
블로그 관리
─────────────
[시스템 (하단)]
경고 (admin)
감사 로그
알림 설정
설정
```
- 그룹 평균 3.5항목 ✓ (7±2 충족)
- 그룹 간격 24/24/24/24/24 ✓ 균일
- 빈도 내림차순 ✓

---

## 4. 검증 계획

### 4-1. tsc / build / lint
- `npx tsc --noEmit` → 0 에러
- `npm run build` → 0 에러

### 4-2. Playwright 회귀 (자동)

- **데스크탑 1280**: 사이드바 6개 그룹 헤더 visible 확인 + 각 그룹 항목 개수 일치
- **모바일 375 (U2 활성 시)**: 사이드바 열림 시 6그룹 visible + 메뉴 클릭 자동 닫기
- **active 상태**: `/dashboard/bbq` 진입 시 "평상 설정" 항목만 active (다른 메뉴 false negative)
- **ALL_NAV_HREFS active matching**: `/dashboard/bbq-board` 진입 시 "평상 예약 현황" active, "평상 설정" inactive (prefix 매칭 오버라이드 정상 동작)

### 4-3. 시각 회귀
- `/tmp/sidebar_v1.png` (before) vs `/tmp/sidebar_v2.png` (after) — Playwright 스크린샷 첨부
- 데스크탑/모바일 양쪽

### 4-4. 접근성
- `<nav role="navigation" aria-label="주 메뉴">` 유지 (DashboardShell 측)
- 각 그룹 헤더에 `<p>` 대신 `<h2>` 권장? — **권고: `<p>` 유지** (시각 분리 충분, h2 도입 시 페이지 h1과 위계 충돌)

---

## 5. 롤백 시나리오

| 시나리오 | 방법 | 소요 |
|---|---|---|
| flag 도입 시 (Q3=a) | Vercel env `NEXT_PUBLIC_SIDEBAR_IA_V2` 삭제/0 | 즉시 |
| flag 없이 적용 시 (Q3=b) | `git revert <commit>` | 1분 + Vercel 빌드 |
| ALL_NAV_HREFS 매칭 깨짐 | Sidebar.tsx 만 revert | 1분 |

---

## 6. 커밋 전략

### 권고 1: 단일 커밋 (Q3=a flag 적용 시)
```
feat(sidebar): IA v2 6그룹 재설계 + 간격 토큰 통일 (flag NEXT_PUBLIC_SIDEBAR_IA_V2)

- 회원 서비스 단일 10항목 → 6그룹 (일별 운영 / 회원 / 자원·시설 / 상거래 / 콘텐츠 / 시스템)
- 그룹 간격 20/20/17 비대칭 → 24px 통일 (mt-6)
- 그룹 헤더 10px → 12px (text-xs)
- 평상 시설·운영시간 → 평상 설정 (페이지 h1 일치)
- 평상 메뉴·이벤트 → 평상 메뉴
- feature flag NEXT_PUBLIC_SIDEBAR_IA_V2 (default off, 1주 burn-in)
- ALL_NAV_HREFS active 매칭 패턴 유지

검증
- tsc 0 / next build 0
- Playwright 데스크탑/모바일 회귀 0
- E2E qa-prod-validation 평상 워딩 spec 동시 갱신

근거: thoughts/research/20260515-2300_sidebar_ia_redesign.md
플랜: thoughts/plans/20260515-2330_sidebar_ia_redesign_plan.md
```

### 권고 2: 분리 커밋 (변경 적은 경우)
1. `refactor(sidebar): 그룹 재구성 + 간격 토큰 통일`
2. `fix(wording): 평상 시설·운영시간 → 평상 설정, 평상 메뉴·이벤트 → 평상 메뉴`
3. `test(e2e): 평상 단축 라벨 검증 spec 갱신`

---

## 7. 작업량 추정

| 항목 | 시간 |
|---|---|
| Sidebar.tsx 재작성 + flag | 1.5h |
| E2E spec 갱신 | 15m |
| Playwright 회귀 (데스크탑+모바일) | 30m |
| 스크린샷 비교 | 15m |
| Vercel env 등록 | 5m |
| 커밋 + push + 배포 검증 | 30m |
| **합계 (Phase 1)** | **~3h** |
| Burn-in 후 default on 전환 (Phase 2) | 5m |
| 후속 페이지 h1 일관성 (Phase 3) | 0.25일 |

---

## 8. 잠재 리스크 / 미해결 질문

| # | 항목 | 영향 | 대응 |
|---|---|---|---|
| R1 | "신청 관리" 가 [일별 운영] 그룹인데 실제로 처리 액션은 평상/농장 도메인 혼재 → 운영자가 "자원·시설" 그룹에서 찾을 수도 | 발견성 | 첫 주 burn-in 시 메뉴 클릭 패턴 확인. 필요 시 [회원] 또는 [자원·시설] 로 이동 |
| R2 | "공지 관리" 가 [회원] 그룹 vs [콘텐츠] 그룹 — 회원 대상 메시지 vs 콘텐츠 모두 합리 | 의미 모호 | A안 [회원] 그룹 유지. 사용자가 운영시 회원 라이프사이클 컨텍스트로 작성 |
| R3 | flag 미도입(Q3=b) 시 즉시 변경 → 운영자 학습 비용 1회 | 첫 클릭 비용 | release-toast 또는 첫 진입 시 "메뉴가 새 그룹으로 정리됐어요" 4초 토스트 (선택) |
| R4 | mobile V2 햄버거가 OFF 라서 모바일 영향 X — V2 ON 시점 (U2 burn-in 후) 에는 함께 검증 필요 | 후속 검증 | mobile V2 ON 일정과 정렬 |
| R5 | Realtime 401 prod 잔존 이슈 (TopBar setAuth 후에도 8건) — 본 작업과 무관하지만 추가 채널 grep 필요 | 별개 | 별도 hotfix |

---

## 9. 7점 보안/품질 체크리스트 적용 (CLAUDE.md 통합)

| # | 항목 | 변경 유형 적용 여부 | 결과 |
|---|---|---|---|
| 1 | 인증/권한 | 프론트엔드만, 권한 변경 X | N/A |
| 2 | 비정상 경로 | active 매칭 실패 시 모든 메뉴 inactive (정상) | 검증 |
| 3 | 중복 요청/동시성 | 사이드바 클릭은 Link → 라우터 — 중복 처리 없음 | N/A |
| 4 | DB 정합성 | DB 변경 0 | N/A |
| 5 | 비밀정보 노출 | env 신규 1건 (NEXT_PUBLIC_*, 공개 OK) | 안전 |
| 6 | 런타임 이슈 | tsc 0 / build 0 / Sentry 모니터링 | 검증 |
| 7 | 배포 후 대응 | flag off 또는 git revert 즉시 | 확보 |

---

## 10. 메뉴 변경 매트릭스 (참조)

| 현재 메뉴 (10) | 신 그룹 | 신 라벨 | 변경 |
|---|---|---|---|
| 회원 관리 | 회원 | 회원 관리 | 그룹 이동 |
| 회원권 관리 | 회원 | 회원권 관리 | 그룹 이동 |
| 신청 관리 | 일별 운영 | 신청 관리 | 그룹 이동 ↑ (빈도 상향) |
| 평상 예약 현황 | 일별 운영 | 평상 예약 현황 | 그룹 이동 ↑ |
| 평상 시설·운영시간 | 자원·시설 | **평상 설정** | 라벨 단축 + 그룹 이동 |
| 평상 메뉴·이벤트 | 자원·시설 | **평상 메뉴** | 라벨 단축 + 그룹 이동 |
| 스토어 설정 | 상거래 | 스토어 설정 | 그룹 분리 |
| 플랜 관리 | 상거래 | 플랜 관리 | 그룹 분리 |
| 쿠폰 설정 | 상거래 | 쿠폰 설정 | 그룹 분리 |
| 공지 관리 | 회원 | 공지 관리 | 그룹 분리 |

| mainNav 4 (이동) | 신 그룹 |
|---|---|
| 대시보드 | 일별 운영 |
| 문의 관리 | 일별 운영 |
| 농장 관리 | 자원·시설 |
| 임대 계약 | 자원·시설 |

---

## 11. 적용 순서 (Step-by-Step)

> kk 승인 후 `/implement [sidebar-ia]` 명령으로 실행.

1. Phase 1 시작
   1. `Sidebar.tsx` 재작성 (배열 + 간격 + flag 분기)
   2. `e2e/qa-prod-validation.spec.ts` 라벨 갱신
   3. `npx tsc --noEmit` + `npm run build` 0 에러 확인
2. Dev 검증
   1. `NEXT_PUBLIC_SIDEBAR_IA_V2=1 npm run dev` → Playwright 6그룹 visible + 라벨 단축 확인
   2. 스크린샷 데스크탑/모바일
   3. flag OFF 회귀 0 확인
3. 커밋 (권고 1 또는 2)
4. `git push origin main` → Vercel 자동 빌드
5. prod 검증
   1. `https://app.pocolush.com` flag off 상태 (기본 동작) 0 회귀 확인
   2. (옵션) Vercel preview 환경에 flag=1 등록 → preview URL 에서 V2 검증
6. Vercel production env `NEXT_PUBLIC_SIDEBAR_IA_V2=1` 활성화 (burn-in 1주 후, kk 결정)
7. 1주 burn-in 모니터링 → 통과 시 Phase 3 후속 진입

---

## 12. 출처 / 참조

- 리서치: `thoughts/research/20260515-2300_sidebar_ia_redesign.md`
- 백로그: `thoughts/plans/20260515-2000_backlog_safe_rollout_plan.md` (F1 사이드바 그룹화 P3)
- Shopify App Design: Navigation (공식 가이드)
- Toss Place 공식 사이트
- Mews / RoomMaster Hotel PMS 가이드
- Nielsen 10 휴리스틱, Krug Trunk Test
- Wathan/Schoger Refactoring UI

---

## 13. kk 피드백 (kk 직접 메모)

> 2026-05-15 23:50 kk 결정 (대화 기록):

- **Q1 (그룹 안)**: **A** — JTBD/빈도 6그룹
- **Q2 (라벨 단축 범위)**: **1** — 평상 2개만 ("평상 설정" / "평상 메뉴")
- **Q3 (feature flag)**: **a** — flag 도입 + 1주 burn-in
- **Q4 (아이콘 통일)**: **i** (명시 답변 없음 → 권고 채택, 현행 아이콘 유지)
- **pocolush-site 워딩**: "별도지시 참고" — 이번 작업 범위 외, 그때그때 지시
- **추가 요구사항**: (없음)

✅ 승인 → 즉시 implement 진입

---

## 14. END — 본 플랜은 kk 승인 시 `/implement sidebar-ia` 로 진행. 미승인 상태에서 구현 금지.
