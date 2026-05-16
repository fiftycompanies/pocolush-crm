# 잔여 백로그 통합 실행 플랜 v2 (Critical 검수 반영)

> **작성**: 2026-05-16 25:00
> **선행**: `thoughts/plans/20260516-2400_residual_backlog_8skill_plan.md` v1 (기각)
> **3 agent 심층 검수**: 🔴 critical 15 + 🟡 important 33 + 🟢 nice 17
> **상태**: 🔴 **kk 승인 대기** (v1 대비 6h 추가 + 5일 Aligo 검수 lead time)
> **권고**: v1 의 PR-D 는 현 상태 배포 시 100% 실패 — **재설계 필수**

---

## 0. v1 → v2 핵심 변경 요약

| 영역 | v1 | v2 |
|---|---|---|
| PR-D 알림톡 추정 | 4h | **8~10h + Aligo 검수 5영업일** |
| 만료 KPI 상수 | 신규 4개 (EXPIRY_7/30_DAYS) | **기존 EXPIRY_WARNING/DANGER_DAYS 재사용** |
| ConfirmDialog 호출 수 | 22개 | **23개** (5개 누락 발견) |
| ConfirmDialog variant | 2종 | **3종 (destructive/warning/default)** |
| 신규 PR-X 추가 | - | **e2e/*.spec.ts '123456' 평문 제거** (보안 critical) |
| PR 순서 | A→B→C→D | **X→A→C→B→D** (보안 → 검증 → KPI → 인프라 → cron) |
| 총 추정 시간 | ~10h | **~16h + Aligo 5일** |

---

## 1. 🔴 Critical 발견사항 (15건)

### PR-D 알림톡 (11건)

| # | 발견 | 근거 | v2 대응 |
|---|---|---|---|
| C-D1 | **`member_notifications.type` CHECK 위반** — `expiry_warning` 미허용 | `007_notices.sql:31-32` enum 제약 | 마이그 088 에 `ALTER TABLE DROP CONSTRAINT + ADD CHECK` 포함 |
| C-D2 | **RPC `auth.role()` 비표준** — 프로젝트 전체 `assert_admin_with_audit` 사용 | `078_admin_helper_and_anon_revoke.sql` | RPC 내부 권한 체크 제거 → `GRANT TO service_role` 만 |
| C-D3 | **`notification_settings.alimtalk_enabled` 글로벌 게이트 우회** | `008_notifications.sql` + `lib/notifications.ts:54-61` | cron 본문 시작 시 글로벌 게이트 체크 OR `sendNotification()` 재사용 |
| C-D4 | **`member.status='approved'` 만 필터** → 운영 어드민 직접 등록한 pending 회원 누락 | `014_members_admin_create.sql` 경로 | PM 결정 후 `IN ('approved', 'pending')` 또는 명시 |
| C-D5 | **`members.deleted_at IS NULL` 잘못된 의미** — PII 마스킹 시점 ≠ 일반 deleted | `063_member_lifecycle.sql:51,56` | 조건 제거 (status 필터로 충분) |
| C-D6 | **`FOR UPDATE SKIP LOCKED` + UPDATE 패턴 race window** | RPC §6-1:301-315 | **UPDATE-RETURNING 단일문**으로 atomic 보장 |
| C-D7 | **mark-before-send 영구 발송 실패** — Aligo timeout 시 미발송 + 마킹 → 다음날 cron 제외 | §6-5:418 | **3단계 패턴**: `attempted_at → send → confirmed_at` 분리, 실패 시 재시도 |
| C-D8 | **`push_enabled=true` 필터 PIPA 과도** — DEFAULT false 라 신규 회원 거의 발송 0 | `003_members.sql:42` | **거래정보형 알림** → push_enabled 필터 제거, `phone IS NOT NULL` 만 |
| C-D9 | **Aligo 사전 등록 템플릿 5일 검수 lead time 미반영** | 카카오 알림톡 정책 | 사전 작업: 템플릿 등록 → 카카오 검수 통과 (3~5 영업일) 명시 |
| C-D10 | **`CURRENT_DATE + 30` timezone 미지정** — D-29/D-31 오차 | Supabase 기본 UTC | `(CURRENT_DATE AT TIME ZONE 'Asia/Seoul')::DATE + 30` |
| C-D11 | **cron 실패 시 운영팀 무인지** — `slackAlert()` 누락 | `lib/observability/slack.ts` | cron endpoint 마지막에 실패 시 slackAlert + Aligo 부분 실패 알림 |

### PR-C 만료 KPI (4건)

| # | 발견 | 근거 | v2 대응 |
|---|---|---|---|
| C-C1 | **상수 중복** — `EXPIRY_WARNING_DAYS(30)/DANGER_DAYS(7)` 이미 있음 | `lib/constants.ts:46-47` | **신규 상수 도입 금지**, 기존 재사용 |
| C-C2 | **4개 명명 컨벤션 공존** — `expiringThisMonth/expiringSoon/expiring7Days/expiring30Days` | use-data:26, Memberships:39, FarmsBoardKpi:27 | **컨텍스트별 명명** — `farmExpiringIn30 / membershipExpiringIn30` (테이블 의미 분리) |
| C-C3 | **농장 D-30 ≠ 멤버십 D-30** — farm_rentals vs memberships 별개 테이블 | 합산 시 의미 왜곡 | KPI 라벨에 컨텍스트 명시 (예: "사이트 D-30", "회원권 D-30") |
| C-C4 | **StatsCards 현재 `lg:grid-cols-5`** (플랜은 3→4 표기 오류) | StatsCards.tsx:62 | v1 §5-1-1 표 수정 + 6컬럼 wrap risk 명시 |

### PR-C ConfirmDialog (3건)

| # | 발견 | 근거 | v2 대응 |
|---|---|---|---|
| C-C5 | **호출 22 → 23개** (5개 누락) | 실제 grep 결과 | 전수 표 (위 B-1) 첨부 |
| C-C6 | **모달 중첩 z-index 충돌** — Modal/Drawer z-50 + ConfirmDialog z-50 | `Modal.tsx:37,40`, `Drawer.tsx:45` | **ConfirmDialog z-60** 강제 |
| C-C7 | **async confirm race** — confirm 진행 중 다른 admin row 삭제 | onClick async 변환 | `busy` state + confirm 버튼 disabled while await |

### PR-A 검증 (1건)

| # | 발견 | 근거 | v2 대응 |
|---|---|---|---|
| C-A1 | **expired/cancelled 행 클릭 silent fail** — `farms.find()` undefined → 아무 일도 안 일어남 | page.tsx:128-134 | **UX 결정 필요** (disable / toast / 별도 Drawer) |

### 통합 (1건)

| # | 발견 | 근거 | v2 대응 |
|---|---|---|---|
| C-INT1 | **`e2e/*.spec.ts` 8개 파일에 `ADMIN_PW='123456'` 평문 하드코드** | grep 결과 commit history 노출 | **PR-X 신설**: 환경변수 강제 + 평문 제거 (즉시) |

---

## 2. 🟡 Important 발견사항 (33건 요약, 상세는 각 agent 결과)

### PR-D
- I1: RPC 함수명 컨벤션 (`claim_*` 비표준)
- I2: member_notifications realtime publication 영향
- I3: service_role + console.log PII 누수 risk
- I4: Vercel cron 재시도 정책 모호
- I5: notification_logs 5년 보관 정책 부재
- I6: Vercel function timeout (100건 동시 fetch)
- I7: Aligo response code 타입 (`0` vs `"0"`) 비교 버그
- I8: Vercel cron ±60s 변동
- I9: notification_logs 모니터링 대시보드 부재
- I10: 016 cron 과 신규 cron 시간차 timezone 결합 시 어긋남

### PR-C 만료 KPI
- I-K1: 같은 데이터 두 번 fetch (useDashboardStats + useExpiringRentals)
- I-K2: `expiringThisMonth` 호출처 1군데만 (v1 위험 과대평가)
- I-K3: KPI 6컬럼 반응형 wrap risk
- I-K4: E2E spec 2개 정규식 깨짐 (`production-membership:60`, `qa-prod-validation:174`)
- I-K5: 라벨 통일 (어드민 = "D-7", 회원 알림 = "N일 후 만료")

### PR-C ConfirmDialog
- I-CD1: variant 3종 필요 (destructive/warning/default)
- I-CD2: `useConfirm()` hook + render JSX 인라인 케이스 (NoticeImageDropzone:216)
- I-CD3: toast vs ConfirmDialog z-index 확인
- I-CD4: Server Action 진행 중 모달 닫힘 (isLoading prop 필요)
- I-CD5: focus restore (호출 버튼으로 복귀)
- I-CD6: destructive 의 default Enter = cancel (Apple HIG)

### PR-A/B 통합
- I-A1: `lib/use-farm-history.ts:88-97` deps array `status?.join(',')` 매 렌더 새 문자열
- I-A2: §이력 검색 필터 32+ 조합 매트릭스 검증 누락
- I-A3: 087 `assert_admin_with_audit` × 1h dedup 중복 INSERT 가능성
- I-A4: PR-A 검증이 prod 직접 hit → audit_logs 오염
- I-B1: burn-in 5/22 종료 vs 즉시 활성화 미결정
- I-B2: 모바일 viewport 회전 (375 ↔ 768) 검증 누락
- I-B3: ESC 후 focus restore (햄버거 버튼 복귀)
- I-B4: iPhone safe-area (Dynamic Island)
- I-B5: Cloudflare proxy 모드 dig 확인 부재
- I-Pwr1: spec 9 → 11 (qa-prod-validation, member-lifecycle-zone-change 누락)
- I-Pwr2: CI cache key playwright version 검토
- I-Sec1: PR-D PIPA 제3자 제공 동의 (Aligo) 약관 점검
- I-Perf1: trgm 인덱스 size (customers 30~50% 추가)
- I-Perf2: 088 memberships UPDATE write amplification

---

## 3. PR 재편성 (v1 → v2)

### v1 → v2 PR 순서
```
v1: PR-A → PR-B → PR-C → PR-D
v2: PR-X (보안) → PR-A (검증) → PR-C1 (KPI) → PR-C2 (ConfirmDialog) → PR-B (인프라) → [Aligo 5일 lead] → PR-D (cron)
```

### PR 시간 재산정

| PR | 작업 | v1 | v2 | 비고 |
|---|---|---|---|---|
| **PR-X** | e2e ADMIN_PW 평문 제거 + .env 강제 | - | **30m** | 신규, 보안 critical |
| **PR-A** | 4ab76a6 Playwright 검증 (11 spec + expired UX) | 15m | **45m** | UX 결정 + 11 spec 보정 |
| **PR-C1** | 만료 KPI 분리 (기존 상수 재사용 + 컨텍스트별 명명) | 2h | **1.5h** | 단순화 |
| **PR-C2** | ConfirmDialog (z-60 + 3 variant + Phase 1만) | 2h | **2.5h** | Phase 1 4건 + 컴포넌트 정의 |
| **PR-B** | U2 + Cloudflare + Playwright 1.60 | 30m | **1h** | burn-in 결정 + viewport 회전 + dig 확인 |
| **PR-D** | 알림톡 D-30 (재설계) | 4h | **8~10h** | 11 critical 반영 (3단계 패턴 + slackAlert + timezone + 글로벌 게이트) |
| **외부** | Aligo 템플릿 등록 + 카카오 검수 | - | **3~5 영업일 대기** | PR-D 사전 작업 |
| **외부** | Realtime support (D) + Cloudflare 정리 | 30m | **30m** | 변동 없음 |
| **합계** | | ~10h | **~16h + 5일** | |

---

## 4. PR-X — e2e ADMIN_PW 평문 제거 (보안 critical, 30m) 🔴

### 4-1. 변경 파일 (8개 e2e spec)

```
e2e/notice-pin.spec.ts
e2e/qa-prod-validation.spec.ts
e2e/bbq-board.spec.ts
e2e/notice-image-upload.spec.ts
e2e/member-lifecycle-zone-change.spec.ts
e2e/production-membership.spec.ts
e2e/crm-8skill.spec.ts
e2e/signup-consent.spec.ts
```

### 4-2. 패턴 변경

```diff
- const ADMIN_PW = process.env.E2E_ADMIN_PW || '123456';
+ const ADMIN_PW = process.env.E2E_ADMIN_PW;
+ if (!ADMIN_PW) throw new Error('E2E_ADMIN_PW required');
```

### 4-3. 영향

- prod admin 비번 노출 git history 정리 (BFG 또는 git filter-branch는 별도 결정 — prod 비번 자체 rotation 권고)
- CI/local 실행 시 `.env.local` 또는 GitHub Secrets 에 `E2E_ADMIN_PW` 명시
- prod admin 비번 변경 필수 (`123456` 자체가 약함)

### 4-4. risk + 롤백
- git revert 가능 (단 prod 비번 rotation은 별개)

---

## 5. PR-A — 4ab76a6 검증 보강 (45m) 🔴

### 5-1. 추가 검증 시나리오

| # | 항목 | 우선 |
|---|---|---|
| 1 | publication 정합성 SQL (`pg_publication_tables`) | 🟡 |
| 2 | RLS 정책 (`pg_policies WHERE tablename='notifications'`) | 🟡 |
| 3 | 인덱스 4종 생성 확인 SQL | 🟡 |
| 4 | **expired/cancelled 행 클릭 silent fail UX 결정** (C-A1) | 🔴 |
| 5 | TopBar realtime INSERT 시뮬레이션 (Supabase MCP INSERT → toast 출현) | 🟡 |
| 6 | 087 `assert_admin_with_audit` × 1h dedup 중복 검증 | 🟡 |
| 7 | 11 spec 매트릭스 확인 | 🟡 |

### 5-2. C-A1 UX 결정 (kk Q 추가)

```
Q-A1: §이력 검색에서 expired/cancelled 임대 행 클릭 시 동작
  (a) 행 비활성화 (cursor-not-allowed, 클릭 무효)
  (b) toast.info("만료된 임대는 상세 보기 미제공")
  (c) 별도 ExpiredRentalDrawer 신규 컴포넌트 (추가 작업)
권고: (b) ⭐ — UX 일관성 + 최소 작업
```

### 5-3. 검증 환경
- **권고**: staging 환경 (prod 직접 hit 회피, audit_logs 오염 방지)
- staging 부재 시 prod 사용 + audit_logs 사후 정리

---

## 6. PR-C1 — 만료 7/30일 분리 (1.5h) 🟢

### 6-1. 핵심 변경 (단순화)

```ts
// lib/constants.ts — 기존 유지 (변경 0)
export const EXPIRY_WARNING_DAYS = 30;
export const EXPIRY_DANGER_DAYS = 7;

// lib/use-data.ts useDashboardStats
export interface DashboardStats {
  // expiringThisMonth 제거
  farmExpiringIn7: number;     // farm_rentals (사이트 임대)
  farmExpiringIn30: number;
  // membershipExpiringIn7/30 은 useMembershipsList 에서 별도 (페이지 분리)
}
```

### 6-2. KPI UI 변경

**StatsCards 5컬럼 → 6컬럼 vs 한 카드 2-값** (Q 추가):

```
Q-C1: KPI 카드 추가 방식
  (a) 카드 1개 추가 (5 → 6) — grid 6컬럼 wrap risk
  (b) "사이트 D-30 (D-7)" 한 카드에 2 숫자 표기
  (c) 기존 "이달 만료" 유지 + 별도 토글
권고: (b) ⭐ — 정보 밀도 + UI 안정성
```

### 6-3. E2E spec 사전 패치

```bash
# v1 누락 발견 - 사전 수정 PR 묶음
e2e/production-membership.spec.ts:60  # /^만료 임박/ 정규식
e2e/qa-prod-validation.spec.ts:174    # StatsCards selector
```

### 6-4. 영향 분석 (단순화)

- `useDashboardStats.expiringThisMonth` 호출처 **1군데**만 (StatsCards.tsx:62) — v1 의 "다중 영향" 위험 과대평가
- `expiringSoon` (지역변수) 2군데 — 내부 변수 변경만
- `useExpiringRentals(30)` 하위호환 유지

---

## 7. PR-C2 — ConfirmDialog (2.5h) 🟢

### 7-1. 신규 컴포넌트 (z-60 + 3 variant)

```tsx
// components/ui/ConfirmDialog.tsx
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'destructive' | 'warning' | 'default';  // 3종
  isLoading?: boolean;                                 // 진행 중 disable
  defaultAction?: 'confirm' | 'cancel';                // destructive=cancel 권고
}
```

**z-index**: `z-[60]` 명시 (Modal/Drawer z-50 위)

### 7-2. 23개 호출 매트릭스 (전수)

| Phase | 호출 수 | 우선순위 (위험도) | 파일:라인 |
|---|---|---|---|
| **Phase 1** | 4 | 🟢 저위험 | plans:57, notices:58, AckControls:56, FacilitiesTable:45 |
| **Phase 2** | 9 | 🟡 중위험 | TimeSlotsSection:163, ProductsSection:75,99, NoticeImageDropzone:216, ServiceOrderDrawer:60,84, farms:43,106, ReservationSidePanel:103 |
| **Phase 3** | 9 | 🔴 고위험 | MembershipDrawer:115 (영구삭제), MembershipsPageClient:77 (PII CSV), ZoneTransferModal:126, MemberDangerZone:33,46, MemberRowActions:69,83, members:128, withdraw:73 |
| **현 PR** | **Phase 1 만 (4건)** | 점진적 마이그 — 회귀 최소 |

### 7-3. variant 분류

- **destructive** (9건): 영구 삭제 (plans, notices, FacilitiesTable, ProductsSection, NoticeImageDropzone, farms 등)
- **warning** (3건): 가격차/노쇼/사진+알림 (ZoneTransferModal, ReservationSidePanel, ServiceOrderDrawer:84)
- **default** (11건): 재활성화/복원/취소 (MemberDangerZone, MemberRowActions, members, withdraw 등)

### 7-4. 마이그레이션 hook 패턴

```tsx
// hooks/useConfirm.ts (Phase 1 신설)
const confirm = useConfirm();
const ok = await confirm({
  title: '플랜 삭제',
  message: `${p.name} 플랜을 삭제합니다.`,
  variant: 'destructive',
});
if (ok) await deletePlan();
```

### 7-5. 인라인 케이스 (NoticeImageDropzone)

JSX 내부 인라인 → ConfirmDialog 직접 마운트

---

## 8. PR-B — U2 + Cloudflare + Playwright 1.60 (1h) 🟡

### 8-1. U2 활성화 (burn-in 결정)

```
Q-B1: NEXT_PUBLIC_SIDEBAR_MOBILE_V2 활성화 시점
  (a) 즉시 (5/16, 6일 burn-in 단축)
  (b) 5/22 burn-in 종료 후 (원안 유지)
권고: (b) ⭐ — burn-in 정책 일관성
```

### 8-2. 모바일 viewport 회전 검증 추가

- 375 → 768 ↔ 1280px 토글 시 sidebar 상태 일관성
- focus restore (햄버거 클릭 → ESC → 햄버거 버튼 복귀)

### 8-3. Cloudflare 정리 (dig 사전 확인)

```bash
dig pocolush.com
# 기대: 76.76.21.x (Vercel) — Cloudflare proxy 모드 아니어야
```

### 8-4. Playwright 1.60 (11 spec 매트릭스)

`v1 §4-3` 의 9 spec 보정 → **11 spec**:
- 신규 발견: `qa-prod-validation.spec.ts`, `member-lifecycle-zone-change.spec.ts`

---

## 9. PR-D — 알림톡 D-30 (재설계, 8~10h + Aligo 5일) 🟢

### 9-1. 사전 작업 (kk + 외부, 5영업일)

| 단계 | 작업 | 담당 |
|---|---|---|
| 1 | Aligo 어드민에 알림톡 템플릿 등록 (`POCO_EXP_30`) | kk |
| 2 | 카카오 검수 통과 대기 (3~5 영업일) | 외부 |
| 3 | 승인된 템플릿 코드 + 메시지 본문 (변수 치환 형식) 확보 | kk |
| 4 | `lib/aligo-templates.ts` 상수 파일에 매핑 | Claude |
| 5 | 환경변수 확인 (`ALIGO_API_KEY/USER_ID/SENDER/SENDER_KEY`) | kk |

**메시지 본문 예시 (카카오 변수 형식)**:
```
[포코러쉬]
#{member_name}님, 회원권 만료까지 #{days_left}일 남았습니다.

▶ 만료일: #{end_date}
▶ 연장 문의: 010-XXXX-XXXX
▶ 마이페이지: https://app.pocolush.com/m/mypage?source=alimtalk_d30
```

### 9-2. 마이그 088 (v2)

```sql
-- 088: 알림톡 D-30 cron 인프라 (v2 - 11 critical 반영)
-- Part 1: member_notifications.type 에 'expiry_warning' 추가 (C-D1)
ALTER TABLE public.member_notifications
  DROP CONSTRAINT member_notifications_type_check;
ALTER TABLE public.member_notifications
  ADD CONSTRAINT member_notifications_type_check
  CHECK (type IN (
    'approval','reservation','reservation_cancel','service_request',
    'service_complete','coupon','notice','withdrawal',
    'expiry_warning'  -- NEW
  ));

-- Part 2: 인덱스 + 3단계 마킹 컬럼 (C-D7)
CREATE INDEX IF NOT EXISTS idx_memberships_end_date_status
  ON public.memberships (end_date, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at
  ON public.notification_logs (created_at DESC);

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS expiry_warning_attempted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS expiry_warning_sent_at      TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS expiry_warning_failed_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_memberships_warning_pending
  ON public.memberships (end_date)
  WHERE expiry_warning_sent_at IS NULL AND status = 'active';

-- Part 3: 3단계 RPC (C-D2/C-D5/C-D6/C-D7/C-D8/C-D10)
CREATE OR REPLACE FUNCTION public.claim_expiry_warning_targets(
  p_days INT DEFAULT 30,
  p_max_attempts INT DEFAULT 3,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  membership_id UUID,
  member_id     UUID,
  member_name   TEXT,
  member_phone  TEXT,
  end_date      DATE,
  days_left     INT
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $fn$
BEGIN
  -- C-D2: 권한 체크는 GRANT 로 (인라인 auth.role() 제거)
  -- C-D6: UPDATE-RETURNING atomic (race 0)
  -- C-D7: attempted_at 마킹 (sent_at 은 발송 성공 후 endpoint 에서)
  -- C-D8: push_enabled 필터 제거 (거래정보형 알림)
  -- C-D10: AT TIME ZONE 'Asia/Seoul'
  RETURN QUERY
  UPDATE public.memberships m
  SET expiry_warning_attempted_at = NOW()
  FROM public.members mem
  WHERE m.id IN (
    SELECT m2.id FROM public.memberships m2
    JOIN public.members mem2 ON mem2.id = m2.member_id
    WHERE m2.status = 'active'
      AND m2.end_date = ((CURRENT_DATE AT TIME ZONE 'Asia/Seoul')::DATE + p_days)
      AND m2.expiry_warning_sent_at IS NULL
      AND m2.expiry_warning_failed_count < p_max_attempts
      AND mem2.status IN ('approved', 'pending')  -- C-D4
      AND mem2.phone IS NOT NULL
    ORDER BY m2.end_date
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  AND mem.id = m.member_id
  RETURNING
    m.id          AS membership_id,
    m.member_id   AS member_id,
    mem.name      AS member_name,
    mem.phone     AS member_phone,
    m.end_date    AS end_date,
    (m.end_date - (CURRENT_DATE AT TIME ZONE 'Asia/Seoul')::DATE)::INT AS days_left;
END
$fn$;

-- Part 4: 발송 성공 confirm RPC (C-D7)
CREATE OR REPLACE FUNCTION public.confirm_expiry_warning_sent(p_membership_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $fn$
BEGIN
  UPDATE public.memberships
  SET expiry_warning_sent_at = NOW()
  WHERE id = p_membership_id;
END
$fn$;

-- Part 5: 발송 실패 마킹 (재시도 가능)
CREATE OR REPLACE FUNCTION public.mark_expiry_warning_failed(p_membership_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $fn$
BEGIN
  UPDATE public.memberships
  SET expiry_warning_attempted_at = NULL,  -- 다음 회차 재시도 허용
      expiry_warning_failed_count = expiry_warning_failed_count + 1
  WHERE id = p_membership_id;
END
$fn$;

-- Part 6: 권한 (service_role only)
GRANT EXECUTE ON FUNCTION public.claim_expiry_warning_targets(INT,INT,INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_expiry_warning_sent(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_expiry_warning_failed(UUID) TO service_role;
REVOKE EXECUTE ON FUNCTION public.claim_expiry_warning_targets(INT,INT,INT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_expiry_warning_sent(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_expiry_warning_failed(UUID) FROM PUBLIC, anon, authenticated;
```

### 9-3. Cron endpoint (v2)

```ts
// app/api/cron/membership-expiry-warning/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendAlimtalk } from '@/lib/aligo';
import { slackAlert } from '@/lib/observability/slack';
import { EXPIRY_TEMPLATE_CODE, buildExpiryMessage } from '@/lib/aligo-templates';
import pLimit from 'p-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;  // I6: Pro plan

export async function GET(req: Request) {
  // C-D11: CRON_SECRET 검증
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // C-D3: 글로벌 게이트 체크
  const { data: settings } = await supabase
    .from('notification_settings')
    .select('value')
    .eq('key', 'alimtalk_enabled')
    .single();
  if (settings?.value !== 'true') {
    return NextResponse.json({ skipped: 'alimtalk_enabled=false' });
  }

  const { data: targets, error } = await supabase.rpc('claim_expiry_warning_targets', {
    p_days: 30, p_max_attempts: 3, p_limit: 100,
  });
  if (error) {
    await slackAlert({ level: 'error', title: 'D-30 cron RPC 실패', message: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // I6: chunk + p-limit (concurrency 10)
  const limit = pLimit(10);
  const results = await Promise.all(
    (targets ?? []).map((t) =>
      limit(async () => {
        const message = buildExpiryMessage(t);
        const result = await sendAlimtalk(t.member_phone, EXPIRY_TEMPLATE_CODE, message);

        if (Number(result.code) === 0 || result.success) {  // I7
          await supabase.rpc('confirm_expiry_warning_sent', {
            p_membership_id: t.membership_id,
          });
          await supabase.from('notification_logs').insert({
            channel: 'alimtalk',
            recipient: maskPhone(t.member_phone),  // I3
            template_code: EXPIRY_TEMPLATE_CODE,
            status: 'sent',
            response: typeof result.message === 'string' ? result.message.slice(0, 100) : 'OK',
          });
          await supabase.from('member_notifications').insert({
            member_id: t.member_id,
            title: '회원권 만료 임박',
            message,  // member 본인 알림이라 OK
            type: 'expiry_warning',  // C-D1
            reference_id: t.membership_id,
            reference_type: 'membership',
          });
          return { ok: true };
        } else {
          await supabase.rpc('mark_expiry_warning_failed', {
            p_membership_id: t.membership_id,
          });
          await supabase.from('notification_logs').insert({
            channel: 'alimtalk',
            recipient: maskPhone(t.member_phone),
            template_code: EXPIRY_TEMPLATE_CODE,
            status: 'failed',
            error_message: String(result.message ?? 'unknown').slice(0, 200),
          });
          return { ok: false };
        }
      }),
    ),
  );

  const sent = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  // C-D11: 부분 실패 알림
  if (failed > 0) {
    await slackAlert({
      level: 'warn',
      title: 'D-30 알림톡 부분 실패',
      message: `total=${results.length}, sent=${sent}, failed=${failed}`,
    });
  }

  return NextResponse.json({ total: results.length, sent, failed });
}

function maskPhone(phone: string): string {
  return phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-****-$3');
}
```

### 9-4. 회원 측 추가 작업 (UI/UX)

**`/m/mypage`** 에 회원권 만료일 표시 + "연장 문의" 버튼 추가 (PR-D 와 묶거나 별도 백로그):
- 만료 D-30 이내 강조 (빨강)
- 카카오 채팅 / 전화 deep link
- mypage `?source=alimtalk_d30` 시 자동 anchor scroll

### 9-5. dry-run mode (사전 검증)

```ts
// 활성 직전 dry-run (실제 INSERT/Aligo 미호출, SELECT 만)
SELECT COUNT(*) FROM memberships m
JOIN members mem ON mem.id = m.member_id
WHERE m.status='active'
  AND m.end_date = ((CURRENT_DATE AT TIME ZONE 'Asia/Seoul')::DATE + 30)
  AND mem.status IN ('approved', 'pending')
  AND mem.phone IS NOT NULL;
```

---

## 10. 추가 kk 결정 Q (v2)

기존 Q1~Q5 + 신규 Q-A1 / Q-B1 / Q-C1 / Q-D1~Q-D3

| Q | 항목 | 옵션 | 권고 |
|---|---|---|---|
| **Q1 (v1)** | PR 묶음 순서 | v1 / v2 (X→A→C1→C2→B→D) | **v2** ⭐ |
| **Q2 (v1)** | ConfirmDialog 범위 | Phase 1 만 / 전체 | **Phase 1 만** ⭐ |
| **Q3 (v1)** | 알림톡 발송 시점 | 10:00 / 18:00 / 21:00 | **10:00** ⭐ |
| **Q4 (v1)** | 알림톡 실패 시 | 1회만 / 3회 재시도 | **3회 재시도** ⭐ (변경) |
| **Q5 (v1)** | Cloudflare 정리 | kk 직접 / Claude 안내 | **kk 직접** ⭐ |
| **Q-A1** | expired 행 클릭 UX | 비활성 / toast / 별도 Drawer | **toast** ⭐ |
| **Q-B1** | U2 활성화 시점 | 즉시 / 5/22 burn-in 후 | **5/22 후** ⭐ |
| **Q-C1** | KPI 카드 추가 방식 | 6컬럼 wrap / 한 카드 2-값 / 토글 | **한 카드 2-값** ⭐ |
| **Q-D1** | member.status 필터 | approved 만 / approved+pending | **approved+pending** ⭐ |
| **Q-D2** | PIPA 동의 | push_enabled 필터 / phone 만 (거래정보형) | **phone 만** ⭐ |
| **Q-D3** | /m/mypage 연장 진입점 | PR-D 와 묶음 / 별도 백로그 | **별도 백로그** ⭐ |

답변: `Q1=v2, Q2=Phase1, Q3=10:00, Q4=3회재시도, Q5=kk직접, Q-A1=toast, Q-B1=5/22, Q-C1=한카드2값, Q-D1=approved+pending, Q-D2=phone만, Q-D3=별도백로그` 또는 **"권고대로"**

---

## 11. PR 간 의존성 + 진행 순서 (v2)

```
PR-X (보안)        ───── 즉시, 단독
  ↓
PR-A (검증)        ───── 4ab76a6 안정성 확인
  ↓
PR-C1 (KPI)        ───── E2E spec 사전 수정 → KPI 분리
  ↓
PR-C2 (Confirm)    ───── Phase 1 만 (충돌 0)
  ↓
PR-B (U2/Cf/Pw)    ───── 5/22 burn-in 종료 후
  ↓
[Aligo 5일 검수 대기]
  ↓
PR-D (알림톡)      ───── 가장 risky, 마지막
```

병렬 가능: PR-X + PR-A 동시 (다른 영역)

---

## 12. 롤백 시나리오 (v2)

| PR | 롤백 절차 | 영향 |
|---|---|---|
| PR-X | git revert + prod admin 비번 rotation (별도) | E2E 미실행 (CI 차단) |
| PR-A | 검증만 — 롤백 불요 | - |
| PR-C1 | git revert | E2E spec 동시 revert |
| PR-C2 | git revert + ConfirmDialog 컴포넌트 유지 가능 | 4건 confirm() 복원 |
| PR-B | env unset + Playwright 1.59 다운그레이드 | - |
| PR-D | cron 비활성 + DROP FUNCTION 3개 + ALTER TABLE DROP COLUMN 3개 + member_notifications CHECK 원복 | 발송된 알림톡 복구 불가 |

---

## 13. 잠재 추가 risk (v2 신규)

| # | 항목 | 대응 |
|---|---|---|
| R1 | prod admin 비번 `123456` 약함 — git history 노출 | prod 비번 rotation 별도 작업 (PR-X 와 동시) |
| R2 | PR-D timezone 수정이 016 cron (기존) 에도 적용 필요한지 | 016 점검 (별도) |
| R3 | Aligo 비용 — 부분 실패 재시도 시 비용 3배 (월 ~15,000원) | 운영 비용 모니터링 |
| R4 | trgm 인덱스 size 증가 (customers 30~50%) | Supabase Dashboard 메트릭 사후 확인 |
| R5 | /m/mypage 연장 진입점 없으면 회원 CS 문의 증가 | PR-D 활성 동시 임시 메시지 ("전화 010-XXXX 로 문의") |
| R6 | notification_logs 5년 보관 자동 마스킹 부재 | 별도 백로그 |

---

## 14. kk 피드백 (kk 직접 메모)

> _kk 답변 대기 중..._

---

## 15. END — Q1~Q5 + Q-A1/B1/C1/D1~D3 답변 후 PR-X → PR-A → PR-C1 → PR-C2 → PR-B → [Aligo 5일] → PR-D 순차 진입. 미승인 상태에서 구현 금지.
