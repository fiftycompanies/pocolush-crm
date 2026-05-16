# 잔여 백로그 통합 실행 플랜 v1 (8스킬 + 7점 + 사이드 이펙트)

> **작성**: 2026-05-16 24:00
> **선행 리서치**: 병렬 Explore 5 agent (만료 KPI, ConfirmDialog, 알림톡 D-30, U2 모바일, Playwright 1.60 + Realtime support)
> **상태**: 🔴 **kk 승인 대기**
> **권고**: 9개 항목을 4 PR 로 묶어 순차 진행 (총 추정 ~10h)

---

## 0. 한 줄 요약

> 잔여 백로그 9개 중 6개를 4 PR 로 묶음 — **PR-A (즉시 검증, 15m)**, **PR-B (U2 + Cloudflare + Playwright 1.60, 30m)**, **PR-C (만료 7/30일 분리 + ConfirmDialog, 4h)**, **PR-D (알림톡 D-30 cron, 4h)**. Realtime support는 외부 문의로 분리.

---

## 1. 백로그 정리 + 묶음

| # | 항목 | 우선 | 추정 | PR 묶음 |
|---|---|---|---|---|
| 1 | 4ab76a6 Playwright 검증 (§이력 + TopBar realtime) | 🔴 즉시 | 15m | **PR-A** |
| 2 | U2 모바일 햄버거 활성화 | 🟡 P1 | 5m | **PR-B** |
| 3 | Realtime 401 (C) Supabase Dashboard 점검 | 🔵 P2 | 1h | **외부** |
| 4 | Realtime 401 (D) Supabase support / GitHub issue | 🔵 P2 | 30m | **외부** |
| 5 | 만료 임박 7일/30일 단계 분리 | 🟢 P2 | 2h | **PR-C** |
| 6 | Cloudflare wildcard cert 정리 | 🟢 P3 | 5m | **PR-B** |
| 7 | U8 ConfirmDialog | 🟢 P3 | 2h | **PR-C** |
| 8 | G8 Playwright 1.59 → 1.60 | 🟢 P3 | 20m | **PR-B** |
| 9 | 알림톡 D-30 cron | 🟢 P3 | 4h | **PR-D** |

---

## 2. 리서치 핵심 발견 (8스킬 + 데이터 연결)

### 2-1. 만료 임박 7일/30일 분리 (항목 5)

**현재 상태**:
- `lib/constants.ts:46-47` — `EXPIRY_WARNING_DAYS=30`, `EXPIRY_DANGER_DAYS=7` 정의됨 (7일 임계는 시각적 강조만, 실제 KPI 미분리)
- `lib/use-data.ts:30-89` `useDashboardStats.expiringThisMonth` — **월 단위 (월초~월말)** 사용
- `components/admin-farms/FarmsBoardKpi.tsx:15-31` — **30일 단일 고정** + 라벨 "만료 임박 (30일)"
- `components/admin-memberships/MembershipsPageClient.tsx:20-47` — `thirtyDays` 고정
- `components/admin-memberships/MembershipStatsCards.tsx:13` — 라벨 "만료 임박 (D-30)"

**데이터 흐름**:
```
[farm_rentals.end_date] ─┬─→ useExpiringRentals(30) → ExpiringRentals.tsx (대시보드)
                         ├─→ useDashboardStats → StatsCards "이달 만료"
                         ├─→ useFarmsBoard (085) → FarmsBoardKpi (30일 계산)
                         └─→ search_farm_rentals_history (087) → FarmHistorySection

[memberships.end_date] ──┬─→ useMembershipsList → MembershipStatsCards "D-30"
                         └─→ auto_expire_memberships() cron (KST 00:05)
```

**RPC 영향**: 없음 (프론트 계산만)

### 2-2. ConfirmDialog (항목 7)

**현재 상태**:
- `window.confirm()` **22개 사용처** (admin 21 + member 1)
- `window.alert()` **0개** (이미 toast 일원화)
- 기존 Modal/Drawer 14개 (Framer Motion + Tailwind, **focus trap 1개만 구현**: ReservationSidePanel)
- Radix/shadcn 미사용 (자체 구현 패턴)

**Destructive 액션 분류 (위험도순)**:
- 🔴 **매우 높음**: 회원권 영구 삭제 (이력 cascade) — `MembershipDrawer.tsx:115`
- 🔴 높음: 회원 탈퇴 (member self-service) — `withdraw/page.tsx:73`
- 🔴 높음: 농장 삭제 (soft delete) — `farms/page.tsx:43`
- 🟡 중간: BBQ 시설/상품/이벤트, 공지, 임대, ZoneTransfer, CSV PII 내보내기
- 🟢 낮음: 플랜 삭제, 진단 도구

### 2-3. 알림톡 D-30 cron (항목 9)

**현재 인프라**:
- `lib/aligo.ts` — 구현됨 (비활성), `sendAlimtalk(phone, templateCode, message)` 함수
- `lib/notifications.ts` — `sendNotification()` Server Action (FCM 우선 → Aligo 폴백)
- `vercel.json` cron 1개 (expire-memberships, KST 00:05)
- `notification_logs` 발송 기록 테이블 (`channel`, `status`, `response`)

**Critical gaps**:
- ⚠️ `memberships.end_date` **인덱스 없음** → D-30 쿼리 풀스캔 위험
- ⚠️ 멱등성 처리 **없음** → 중복 발송 risk
- ⚠️ PIPA 마케팅/거래정보 분류 없음 (push_enabled 만)
- ⚠️ Aligo 템플릿 ID 관리 체계 없음 (하드코드)

**기존 notification_settings** 테이블에 `alimtalk_enabled` 컬럼 존재 → 활용

### 2-4. U2 모바일 햄버거 (항목 2)

**구조**:
- `DashboardShell.tsx:10` `MOBILE_V2` 분기 (V2 OFF 시 사이드바가 모바일 화면 68% 가림)
- `IA_V2`와 완전 독립 (동시 활성 가능)
- 회원 측 (`/m/*`) 영향 0 (MemberNav 별개)
- 데스크탑 회귀 0 (`md:` 768px+ 변화 없음)

### 2-5. Playwright 1.60 (항목 8)

**Breaking changes**:
- `Locator.ariaRef()` 제거 → `ariaSnapshot()` 사용
- `videosPath`/`videoSize` config 제거 → `recordVideo`
- 9개 spec 에서 사용 가능성 **낮음** (전수 확인 필요)
- `playwright.config.ts` 1줄 점검 후 안전 업그레이드

### 2-6. Realtime 401 server-side (항목 3, 4)

**핵심 단서**: Supabase ERROR_CODES.md 의 `MissingAPIKey` (apikey 쿼리 파라미터 누락/잘못된 값이 80% 가능성)
**점검 순서**: Dashboard Settings API → Realtime Settings (Allow public access 토글) → Network 탭 WS URL raw 검증 → Realtime Logs error code

---

## 3. PR-A — 즉시 Playwright 검증 (15m) 🔴

### 3-1. 검증 대상 (4ab76a6 배포된 마이그 086 + 087)

| 항목 | 기대 |
|---|---|
| `/dashboard/farms-board` 진입 | RPC `get_farms_board` 1회 + `search_farm_rentals_history` 1회 |
| §이력 섹션 렌더링 | h3 "임대 이력 검색" 1개 |
| 매트릭스 회귀 | 60셀 (085 변동 없음) |
| 검색어 입력 → RPC 재호출 | debounce 후 RPC 추가 호출 |
| 상태/플랜 chip 토글 → RPC 재호출 | 즉시 RPC 호출 |
| TopBar realtime | (실시간 INSERT 어렵다면 publication 정합성 SQL 확인) |
| audit_logs `farm_history_search` 1h dedup | 1건만 기록 |

### 3-2. 검증 스크립트 (재작성)

`scripts/verify-4ab76a6.mjs` (Playwright headless) — 이전 verify-* 패턴 재사용

### 3-3. 영향 0 — 검증만

---

## 4. PR-B — U2 활성화 + Cloudflare 정리 + Playwright 1.60 (30m) 🟡

### 4-1. U2 모바일 햄버거 활성화

```bash
printf "1" | vercel env add NEXT_PUBLIC_SIDEBAR_MOBILE_V2 production
vercel deploy --prod --yes
```

**검증**:
- 375px viewport: 햄버거 토글 + 백드롭 + ESC + body overflow:hidden
- 1280px viewport: 사이드바 항상 표시 (`md:translate-x-0`)
- /m/* 회원 측 회귀 0 (MemberNav 별개)

**영향**: DashboardShell.tsx 분기만, 데스크탑 회귀 0

### 4-2. Cloudflare wildcard cert 정리

**작업** (kk 직접 Dashboard):
1. https://dash.cloudflare.com → pocolush.com → SSL/TLS → Edge Certificates
2. Universal SSL (*.pocolush.com) 비활성화 또는 Custom Cert 삭제
3. Validate 이메일 알림 중단 확인

**영향 0**: Vercel Let's Encrypt 가 SSL 자동 갱신 중

### 4-3. Playwright 1.59 → 1.60 업그레이드

**Step 1**: `playwright.config.ts` 에서 `videosPath`/`videoSize` 사용 grep
**Step 2**: 없으면 즉시 업그레이드
```bash
npm install -D @playwright/test@1.60
npx playwright install
```
**Step 3**: 9개 spec 로컬 실행 (호환성 검증)
**Step 4**: 있으면 `recordVideo` 로 1줄 마이그

**영향**: 9개 e2e/*.spec.ts 정상 통과 시 ✅. 회귀 시 1.59 롤백.

---

## 5. PR-C — 만료 7/30일 분리 + ConfirmDialog (4h) 🟢

### 5-1. 만료 7/30일 분리 (2h)

#### 5-1-1. 변경 파일 (8개)

| 파일 | 변경 |
|---|---|
| `lib/constants.ts` | `EXPIRY_7_DAYS`, `EXPIRY_30_DAYS` 명시화 + 헬퍼 `addDaysKST(n)` |
| `lib/use-data.ts` `useDashboardStats` | `expiring7Days`, `expiring30Days` 2개 추가 (월단위 "이달 만료" 폐기) |
| `lib/use-data.ts` `useExpiringRentals` | 파라미터 유지 (회귀 0) |
| `components/dashboard/StatsCards.tsx` | "이달 만료" → "D-7" + "D-30" 2 카드 (레이아웃 3→4 grid) |
| `components/dashboard/ExpiringRentals.tsx` | D-7 강조 + D-30 그룹 분리 표시 |
| `components/admin-farms/FarmsBoardKpi.tsx` | "만료 임박 (30일)" → "D-7" + "D-30" 2 KPI (5→6 cards grid) |
| `components/admin-memberships/MembershipsPageClient.tsx` | `expiring7Days` 신규 stat 추가 |
| `components/admin-memberships/MembershipStatsCards.tsx` | 카드 1개 추가 (4→5) |

#### 5-1-2. 데이터 정합성 보장

- 모든 임계는 `lib/constants.ts` 단일 소스 (3개 파일에서 동일 import)
- 7일 임계는 30일 임계의 부분집합 (D-7 ⊂ D-30)
- RPC 수정 0 (프론트 계산)
- 회원 측 `/m/mypage` 영향 0 (다음 별도 백로그)

#### 5-1-3. 사이드 이펙트 검수

| 영역 | 영향 |
|---|---|
| `/dashboard` | KPI 카드 3→4 (grid-cols-3 → grid-cols-4) |
| `/dashboard/farms-board` | KPI 5→6 (grid-cols-5 → grid-cols-6, 모바일 wrap) |
| `/dashboard/memberships` | KPI 4→5 |
| `/dashboard/rentals` | 0 (필터는 그대로) |
| `useExpiringRentals` 호출처 | 0 (하위호환) |
| `search_farm_rentals_history` (087) | 0 (별도 RPC) |
| `get_farms_board` (085) | 0 (rental_end_date 그대로 반환) |
| `auto_expire_memberships` (016 cron) | 0 (만료 처리 임계 무변) |

### 5-2. ConfirmDialog (2h)

#### 5-2-1. 신규 컴포넌트

`components/ui/ConfirmDialog.tsx` — Framer Motion 기반 (기존 Modal 패턴 답습)

```tsx
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'destructive' | 'default';  // 빨간 vs 파란 confirm 버튼
}
```

**a11y 요소**:
- `role="alertdialog"`, `aria-labelledby`, `aria-describedby`
- focus trap (첫 진입 → cancel 버튼 / Tab 순환)
- ESC 키 닫기 (autoFocus on close button)
- backdrop click 닫기
- 닫힌 후 호출 버튼으로 focus 복귀

#### 5-2-2. 호출 헬퍼 (선택)

```tsx
// hooks/useConfirm.ts
const confirm = useConfirm();
const ok = await confirm({ title: '삭제', message: '...', variant: 'destructive' });
if (ok) await deletePlan();
```

#### 5-2-3. 마이그레이션 순서 (점진적, 22개 호출 16개 파일)

**Phase 1 (저위험, 4개)**: 플랜 삭제, 공지 삭제, 진단 도구, BBQ 시설 삭제
**Phase 2 (중위험, 8개)**: BBQ 타임슬롯/상품/이벤트/예약상태, 농장존 삭제, 회원 재활성화, ZoneTransfer
**Phase 3 (고위험, 4개)**: 회원권 영구 삭제 (이력 카운트 표시), 회원 탈퇴 복원, CSV PII 내보내기, 회원 삭제 신청
**Phase 4 (회원, 1개)**: `/member/mypage/withdraw` 탈퇴 신청 취소

**롤백 전략**: 단일 컴포넌트씩 PR 분리 가능 (각 confirm() → ConfirmDialog 1:1 매핑)

#### 5-2-4. 사이드 이펙트 검수

| 영역 | 영향 |
|---|---|
| 기존 Modal/Drawer 14개 | 0 (별개 컴포넌트) |
| Framer Motion bundle 크기 | 0 (이미 사용 중) |
| ReservationSidePanel focus trap | 충돌 검토 (모달 중첩 시 focus stack) |
| 모바일 backdrop click | 기존 패턴 답습 |
| Server Action 호출 시점 | confirm() 동기 → await confirm() 비동기 (호출부 async 보장) |

---

## 6. PR-D — 알림톡 D-30 cron (4h) 🟢

### 6-1. 마이그 088 (멤버십 D-30 인덱스 + 멱등성)

```sql
-- 088: D-30 알림톡 cron 인프라
-- Part 1: 인덱스 (end_date 풀스캔 방지)
CREATE INDEX IF NOT EXISTS idx_memberships_end_date_status
  ON public.memberships (end_date, status) WHERE status = 'active';

-- Part 2: 멱등성 컬럼 (중복 발송 방지)
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS expiry_warning_sent_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_memberships_warning_sent
  ON public.memberships (expiry_warning_sent_at) WHERE expiry_warning_sent_at IS NULL;

-- Part 3: 발송 대상 조회 + 멱등 마킹 RPC
CREATE OR REPLACE FUNCTION public.claim_expiry_warning_targets(p_days INT DEFAULT 30)
RETURNS TABLE (
  membership_id UUID,
  member_id     UUID,
  member_name   TEXT,
  member_phone  TEXT,
  end_date      DATE,
  days_left     INT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
BEGIN
  -- service_role 만 호출 (cron context)
  IF (SELECT auth.role()) NOT IN ('service_role') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  RETURN QUERY
  WITH targets AS (
    SELECT m.id AS membership_id, m.member_id, m.end_date
    FROM public.memberships m
    WHERE m.status = 'active'
      AND m.end_date = CURRENT_DATE + p_days
      AND m.expiry_warning_sent_at IS NULL
    FOR UPDATE SKIP LOCKED  -- 동시 cron 안전성
  ),
  marked AS (
    UPDATE public.memberships m
    SET expiry_warning_sent_at = NOW()
    FROM targets t
    WHERE m.id = t.membership_id
    RETURNING m.id AS membership_id, m.member_id, m.end_date
  )
  SELECT m.id, mem.id, mem.name, mem.phone, m.end_date,
         (m.end_date - CURRENT_DATE)::INT AS days_left
  FROM marked m
  JOIN public.members mem ON mem.id = m.member_id
  WHERE mem.push_enabled = true  -- PIPA 동의 필수
    AND mem.status = 'approved'
    AND mem.deleted_at IS NULL;
END
$fn$;

GRANT EXECUTE ON FUNCTION public.claim_expiry_warning_targets(INT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.claim_expiry_warning_targets(INT) FROM anon, authenticated, PUBLIC;
```

### 6-2. Cron 엔드포인트

`app/api/cron/membership-expiry-warning/route.ts`

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendAlimtalk } from '@/lib/aligo';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // service_role 클라이언트 (RLS 우회 + claim_expiry_warning_targets 호출)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: targets, error } = await supabase.rpc('claim_expiry_warning_targets', {
    p_days: 30,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = await Promise.allSettled(
    (targets ?? []).map(async (t) => {
      const message = `${t.member_name}님, 회원권이 ${t.days_left}일 후 만료됩니다 (${t.end_date}).\n연장을 원하시면 마이페이지에서 신청해주세요.`;
      const result = await sendAlimtalk(t.member_phone, 'expiry_warning', message);
      // notification_logs 기록
      await supabase.from('notification_logs').insert({
        channel: 'alimtalk',
        recipient: t.member_phone,
        template_code: 'expiry_warning',
        status: result.success ? 'sent' : 'failed',
        response: result.message,
      });
      // member_notifications 인앱 알림 동시 INSERT
      await supabase.from('member_notifications').insert({
        member_id: t.member_id,
        title: '회원권 만료 임박',
        message,
        type: 'notice',
        reference_id: t.membership_id,
        reference_type: 'membership',
      });
      return result;
    }),
  );

  return NextResponse.json({
    total: targets?.length ?? 0,
    success: results.filter((r) => r.status === 'fulfilled' && r.value.success).length,
    failed: results.filter((r) => r.status === 'rejected' || !r.value?.success).length,
  });
}
```

### 6-3. vercel.json 추가

```json
"crons": [
  { "path": "/api/cron/expire-memberships",          "schedule": "5 15 * * *" },
  { "path": "/api/cron/membership-expiry-warning",   "schedule": "0 1 * * *" }
]
```
- KST 10:00 매일 (UTC 01:00) — 일과 시작 시점 알림 (수신율 ↑)

### 6-4. 사이드 이펙트 검수

| 영역 | 영향 |
|---|---|
| `memberships` 테이블 | 컬럼 1 추가 (`expiry_warning_sent_at`), 인덱스 2종 (서비스 영향 0) |
| `auto_expire_memberships` (016) | 0 (별도 cron) |
| `expire-memberships` (00:05 cron) | 0 (별개 endpoint) |
| `notification_logs` | INSERT 만 (~월 100건) |
| `member_notifications` | INSERT (회원 인앱 표시) |
| PIPA 동의 | `members.push_enabled = true` 필터 (수신 거부 0건 보장) |
| Aligo API 비용 | 월 ~100건 × 50원 ≈ 월 5000원 |
| 중복 발송 | `FOR UPDATE SKIP LOCKED` + `expiry_warning_sent_at` (멱등 보장) |

### 6-5. Risk + 롤백

| Risk | 대응 |
|---|---|
| Aligo API 실패 | notification_logs 기록 + 다음날 cron 재시도 (warning_sent_at 미설정 안 됨 → 재발송) ⚠ |
| 중복 발송 | RPC 내부 `SKIP LOCKED` + 마킹 (시도 후 실패 시 다음 회차 재시도 안 됨) |
| 시간대 오류 (D-29/D-31) | `CURRENT_DATE + 30` 사용 (DB timezone Asia/Seoul 확인 필요) |
| 환경변수 누락 | Aligo `ALIGO_API_KEY/USER_ID/SENDER/SENDER_KEY` 사전 확인 |
| 템플릿 코드 미등록 | Aligo 대시보드 'expiry_warning' 템플릿 사전 등록 필수 (사전 작업) |
| 롤백 | DROP FUNCTION + ALTER TABLE DROP COLUMN + vercel.json 1줄 제거 |

⚠ **재발송 정책 결정 필요**: 실패 시 warning_sent_at 마킹을 롤백할지 (재시도) vs 마킹 유지 (1회만 시도)

---

## 7. 8축 종합 검수

### 항목별 8스킬 검수

| 항목 | UI/UX | PM | 디자인 | 백엔드 | 보안 | 성능 | 접근성 | QA |
|---|---|---|---|---|---|---|---|---|
| PR-A 검증 | - | ✅ | - | - | - | - | - | ✅ |
| PR-B U2 | ✅ | ✅ | ✅ | - | - | ✅ | ✅ | ✅ |
| PR-B Cloudflare | - | ✅ | - | ✅ | ✅ | - | - | - |
| PR-B Playwright | - | - | - | - | - | - | - | ✅ |
| PR-C KPI 분리 | ✅ | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ |
| PR-C ConfirmDialog | ✅ | ✅ | ✅ | - | - | - | ✅ | ✅ |
| PR-D 알림톡 | ✅ | ✅ | - | ✅ | ✅ | ✅ | - | ✅ |

### 7점 검수 (PR-C + PR-D 중점)

| # | 항목 | PR-C 만료 KPI | PR-C ConfirmDialog | PR-D 알림톡 |
|---|---|---|---|---|
| 1 | 인증/권한 | 0 (UI만) | 0 | service_role + CRON_SECRET |
| 2 | 비정상 경로 | 0 | catch + toast.error | Aligo 실패 → notification_logs |
| 3 | 중복/동시성 | 0 | confirm 중복 클릭 disabled | `FOR UPDATE SKIP LOCKED` + 멱등 컬럼 |
| 4 | DB 정합성 | 0 (RPC 무변) | 0 | 088 마이그 + 트랜잭션 |
| 5 | 비밀정보 | 0 | 0 | ALIGO_API_KEY .env 확인 |
| 6 | 런타임 | tsc/build | tsc/build | tsc/build + Aligo 응답 schema |
| 7 | 배포 대응 | Vercel logs | Vercel logs | Vercel cron logs + notification_logs 모니터링 |

---

## 8. 잠재 risk + 통합 영향 매트릭스

| 영역 | PR-A | PR-B | PR-C 만료 | PR-C Confirm | PR-D 알림톡 |
|---|---|---|---|---|---|
| 운영 코드 변경 | 0 | 0 (env 만) | 8 파일 | 16 파일 | 3 파일 + 마이그 1 |
| DB 마이그 | 0 | 0 | 0 | 0 | 1 (088) |
| 회원 측 영향 | 0 | 0 | 0 (별도) | 1 (withdraw) | +1 (인앱 알림) |
| 어드민 회귀 | 검증만 | 데스크탑 0 | KPI 레이아웃 | 모든 destructive | cron 추가 |
| 외부 의존 | 0 | Cloudflare | 0 | 0 | Aligo API |
| 롤백 난이도 | - | env unset | git revert | 점진적 PR 분리 | DROP FUNCTION + ALTER |

---

## 9. 권장 진행 순서 (10h 총)

```
1. PR-A 검증 (15m) ────────────────── 마이그 086/087 prod 안정성 확정
2. PR-B U2 + Cloudflare + Playwright (30m) ─ env + 외부 정리 + 라이브러리 업데이트
3. PR-C 만료 7/30일 (2h) ──────────── 운영 KPI 가치 ↑ (D-7 임박 인지)
4. PR-C ConfirmDialog (2h) ────────── a11y/UX 일관성 (점진적 Phase 1)
5. PR-D 알림톡 D-30 cron (4h) ─────── 만료 임박 알림 자동화 (Phase 2 마무리)
6. 외부: Realtime support (D) 동시 진행 (30m, 0 risk)
```

**병렬 가능**: 1+2 동시 / 3+4 동시 (5 는 Aligo 환경변수 사전 확인 필요)

---

## 10. kk 결정 필요 (5건)

| Q | 항목 | 옵션 | 권고 |
|---|---|---|---|
| **Q1** | PR 묶음 진행 | (A) PR-A→B→C→D 순차 / (B) PR-A+B 동시, PR-C+D 동시 / (C) 권고대로 | **C** ⭐ |
| **Q2** | ConfirmDialog 단일 PR | (1) Phase 1-4 한꺼번에 / (2) Phase 1 만 / (3) 컴포넌트 정의만 + 별도 마이그 PR | **3** ⭐ (안전) |
| **Q3** | 알림톡 D-30 시점 | (a) KST 10:00 (권고) / (b) KST 18:00 (퇴근시간) / (c) KST 21:00 | **a** ⭐ |
| **Q4** | 알림톡 실패 시 재시도 | (i) 재시도 (다음날 cron) / (ii) 1회만 (마킹 유지) | **ii** ⭐ (Aligo 비용 + 운영 단순성) |
| **Q5** | Cloudflare wildcard 정리 | kk 직접 Dashboard 작업 / Claude 안내만 | **kk 직접** ⭐ |

답변: `Q1=C, Q2=3, Q3=a, Q4=ii, Q5=kk직접` 또는 **"권고대로"**.

---

## 11. kk 피드백 (kk 직접 메모)

> _kk 답변 대기 중..._

---

## 12. 잠재 추가 risk + Out of Scope

### Out of Scope
- 회원 측 `/m/mypage` 에 D-7/D-30 표시 (별도 백로그)
- 알림톡 템플릿 관리 테이블 (현재는 하드코드, 향후 `notification_templates`)
- Aligo retry/backoff 로직 (단순 1회만)
- ConfirmDialog 마이그레이션 Phase 2-4 (Phase 1 만 진행)
- Realtime 401 옵션 (C) Dashboard 수정 (운영 risk MID, 별도 결정)

### 추가 발견 잠재 issue
1. `members.push_enabled` 기본값 false → D-30 알림 수신 자격 회원 수 사전 확인 필요
2. `auto_expire_memberships` cron 과 D-30 cron 시간차 약 9h → D-30 회원 중 일부가 이미 만료된 경우 없음 확인
3. `notification_settings` 테이블의 `alimtalk_enabled` 기본값 확인 (true 면 즉시 발송)
4. Aligo 대시보드에 'expiry_warning' 템플릿 사전 등록 필수 (작업 전 kk 확인)

---

## 13. END — Q1~Q5 답변 후 PR-A → PR-B → PR-C → PR-D 순차 진입. 미승인 상태에서 구현 금지.
