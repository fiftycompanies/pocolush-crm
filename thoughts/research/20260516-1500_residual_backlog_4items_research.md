# 잔여 백로그 4건 통합 리서치 (2026-05-16 15:00)

> **목적**: P0 2건 + P1 2건의 정확한 원인 + 영향 + 후보 수정안을 한 곳에 정리.
> **선행 입력**: `thoughts/sessions/20260516-1230_handover.md`, `thoughts/sessions/20260516-1100_handover.md`, `thoughts/research/20260516-1000_three_residuals_research.md`, `thoughts/plans/20260516-0930_bbq_board_refresh_plan.md`
> **스킬 적용**: code-reviewer (security + best practice) + senior-fullstack (architecture) + ux-heuristics (Nielsen/Krug) + refactoring-ui (간격/위계)
> **출력 산출물**: `thoughts/plans/20260516-1530_residual_backlog_4items_plan.md` (별도)

---

## 0. 한 줄 요약

> 잔존 4건: ① Realtime 401 재진단(코드 적용했으나 race 잔존 — 명시적 setAuth 즉시 호출이 가장 빠름) ② 자동갱신 UX 강화(기존 plan 유지, 본 문서는 우선순위 결정용) ③ A2 13 RPC `is_admin()` → `assert_admin_with_audit` 일괄 통일(unauthorized 시 audit 누락 0건) ④ U2 모바일 햄버거 활성화(코드 완료, env flag 1줄). 4건 모두 **독립**이며 분리 PR 권고.

---

## 1. 항목별 정확한 위치 (grep 인용)

### 1-1. Realtime 401 — `lib/supabase/client.ts`

```ts
// lib/supabase/client.ts:19-26
const _make = (url: string, key: string) =>
  createBrowserClient(url, key, {
    realtime: {
      // 매 connection 직전 호출 — 첫 연결부터 user access_token 사용 → 401 race 차단
      accessToken: accessTokenFn,
    },
  });

// lib/supabase/client.ts:29
let _client: BrowserClient | null = null;

// lib/supabase/client.ts:31-40
async function accessTokenFn(): Promise<string | null> {
  // _client 가 아직 없거나 placeholder 환경이면 null 반환 → anon key fallback
  if (!_client) return null;
  try {
    const { data: { session } } = await _client.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

// lib/supabase/client.ts:42-58
export function createClient() {
  if (_client) return _client;
  ...
  _client = _make(url, key);  // ← ① _make 안에서 옵션 객체 평가 → realtime 채널 즉시 생성
  return _client;             // ← ② _client 할당은 _make 반환 후
}
```

**race condition 메커니즘**:
1. `createBrowserClient` 호출 시 내부에서 RealtimeClient 인스턴스 생성
2. RealtimeClient 가 첫 connect() 시도 — 동기적으로 WebSocket open
3. WebSocket 핸드셰이크 시점에 `accessToken` 함수 호출 → `_client === null` → null 반환
4. anon key fallback → 첫 connection 401 → reconnect loop → 16건 socketerror

### 1-2. 자동갱신 UX — `app/dashboard/bbq-board/page.tsx`

```tsx
// app/dashboard/bbq-board/page.tsx:71-86
{lastFetched && (
  <span className={`text-[11px] ${isStale ? 'text-amber-700 font-semibold' : 'text-text-tertiary'}`} data-testid="last-fetched">
    {isStale && '⚠ '}
    {Math.floor(staleSeconds)}초 전 자동 갱신
    ...
  </span>
)}
<button
  onClick={() => refetch()}                              // ← 시각 피드백 없음
  className="p-2 rounded-lg border border-border hover:bg-accent"
  aria-label="새로고침"
  data-testid="refresh-btn"
>
  <RefreshCw className="size-4" />                        // ← 회전 애니메이션 없음
</button>
```

원인: 클릭 → refetch 실행은 정상 동작하나 시각 응답 0 + lastFetched 즉시 리셋(staleSeconds=0) → 운영자 "변화 없음 = 작동 안 함" 인지.

상세는 `thoughts/research/20260516-0900_bbq_board_refresh_research.md` + `thoughts/plans/20260516-0930_bbq_board_refresh_plan.md` 참조.

### 1-3. A2 13 RPC `is_admin()` 통일 — 마이그 063/064/065/073

`assert_admin_with_audit` 헬퍼 정의(이미 도입):

```sql
-- supabase/migrations/078_admin_helper_and_anon_revoke.sql:4-25
CREATE OR REPLACE FUNCTION public.assert_admin_with_audit(
  p_action TEXT,
  p_resource_type TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn_078$
DECLARE
  v_caller UUID := (SELECT auth.uid());
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_caller AND role = 'admin'
  ) THEN
    INSERT INTO public.audit_logs (actor_id, action, resource_type, metadata, created_at)
    VALUES (v_caller, p_action || '_unauthorized', p_resource_type, p_metadata, NOW());
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
END;
$fn_078$;
```

`is_admin()` (인라인 admin 체크 — unauthorized 시 audit X) 사용 RPC 후보:

| # | 함수 | 마이그:라인 | 호출 패턴 |
|---|---|---|---|
| 1 | `public.suspend_member(UUID, TEXT, TEXT)` | 063:96 + 065:23 (search_path 재정의) | `IF NOT public.is_admin() THEN RAISE` |
| 2 | `public.unsuspend_member(UUID)` | 063:156 | 동일 |
| 3 | `public.request_member_deletion(UUID, TEXT, TEXT)` | 063:198 + 065:52 | 동일 |
| 4 | `public.restore_member_deletion(UUID)` | 063:263 + 065:86 | 동일 |
| 5 | `public.validate_zone_change(...)` | 064:55 | `OR public.is_admin()` (RLS-like 분기) |
| 6 | `public.change_membership_zone(...)` | 064:99 | `IF NOT public.is_admin() THEN RAISE` |
| 7 | `public.get_available_farms_for_transfer(...)` | 064:207 | 동일 |
| 8 | `public.get_zone_dashboard()` | 064:304(원) → 065 재정의 | 인라인 EXISTS profiles role='admin' |
| 9 | `public.toggle_notice_pin(UUID)` | 073:28 | `IF NOT EXISTS (SELECT ... role='admin')` (인라인) |
| 10 | `public.ack_trigger_error_log(UUID)` | 021:27 | 동일 인라인 |
| 11 | `public.ack_all_trigger_error_logs()` | 021:49 | 동일 |
| 12 | `public.get_unacked_error_count()` | 021/022 | 동일 (read-only) |
| 13 | `public.trigger_error_monthly_summary()` | 021/022 | 동일 (read-only) |

**참고** (외):
- `public.is_admin()` 자체 (063:62) — 헬퍼 본체이므로 보존 (RLS 정책 397 라인의 `OR public.is_admin()` 호환)
- `public.get_bbq_board(DATE,DATE)` (075/079) — admin 인라인 + 정상 audit 로깅 호출 별도, 흐름 다르므로 별도 평가
- RLS 정책의 `EXISTS (... role='admin')` (003/005/006/032/033/056/059/060) — RPC가 아니므로 본 작업 범위 외

**핵심 차이**:
- 현재 `IF NOT public.is_admin() THEN RAISE 'NOT_ADMIN'` → unauthorized 호출은 **audit_logs 무흔적**
- 변경 후 `PERFORM public.assert_admin_with_audit('change_membership_zone','membership_zone_change', jsonb_build_object(...));` → unauthorized 시 `action='<base>_unauthorized'` 자동 기록 + `PERMISSION_DENIED` 예외

### 1-4. U2 모바일 햄버거 — `components/layout/Sidebar.tsx`

```tsx
// components/layout/Sidebar.tsx:12-15
// U2-IA: feature flag — 미설정 시 기존 단일 그룹(legacy) 동작 유지
// Vercel env `NEXT_PUBLIC_SIDEBAR_IA_V2=1` 일 때 6그룹 V2 활성
// trim() — vercel env add 가 stdin 줄바꿈 보존 시("1\n") 방어
const IA_V2 = process.env.NEXT_PUBLIC_SIDEBAR_IA_V2?.trim() === '1';

// components/layout/Sidebar.tsx:189-192
// U2 모바일 V2: enabled 일 때만 transform 토글
const transformCls = mobileEnabled
  ? `transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`
  : '';
```

`mobileEnabled` prop은 상위 레이아웃에서 `process.env.NEXT_PUBLIC_SIDEBAR_MOBILE_V2?.trim() === '1'` 평가 후 주입 (커밋 a44be66). 코드 측 변경 0, env flag 1개 추가만 필요.

---

## 2. 8축 종합 검수

| 축 | 1 Realtime 401 | 2 자동갱신 UX | 3 13 RPC 통일 | 4 U2 활성화 |
|---|---|---|---|---|
| **A 보안** | 첫 connection user token 사용 → RLS 정확 ✅ | 영향 0 | unauthorized 시 audit 누적 (PIPA 5년) ✅ | 영향 0 |
| **B RLS** | 모든 채널 user_id 일관 ✅ | 영향 0 | RPC 권한 검증 일관 | 영향 0 |
| **C UX** | 콘솔 노이즈 16→0 | 클릭→회전→"방금 갱신" 명시 ✅ | 0 | 모바일 햄버거 가시화 ✅ |
| **D 성능** | reconnect 16→0 (CPU/네트워크 ↓) | re-render 1회 증가 (무시) | 함수 호출 1회 + INSERT 0~1 (정상 호출은 INSERT 0) | 0 |
| **E 통합/회귀** | 전역 client (회원 측 /m/* 포함) ⚠ | 1 파일 (bbq-board만) | 13 함수 일괄 (외부 호출 시그니처 동일) | 사이드바 layout 1 파일 (mobileEnabled prop만 활성) |
| **F 데이터/명명** | 0 | formatAgo 신규 헬퍼 (외부 노출 X) | action 명 `<base>_unauthorized` 패턴 (079 dedup과 별개) | flag 명 일관 (`NEXT_PUBLIC_SIDEBAR_MOBILE_V2`) |
| **G 사이드이펙트** | TopBar setAuth (5361889) + use-bbq-board setAuth 중복 호출 — 무해 | E2E `data-testid="refresh-btn"` 유지 | 마이그 분리 시 부분 적용 가능 | 1주 burn-in 미달 (15→16일) — 권고: 즉시 활성 vs 5/22 활성 결정 필요 |
| **H 배포안전** | `git revert <c>` 즉시, 옵션 코드만 제거 | revert 1분 | DROP+CREATE 으로 일괄 재정의 — lock ms 단위 (트래픽 0건/min 시 안전) | env remove + redeploy |

## 3. 7점 체크리스트 (#1 #2 #5 #6)

| # | 항목 | 1 Realtime | 2 UX | 3 RPC | 4 U2 |
|---|---|---|---|---|---|
| #1 | 인증/권한 | 첫 connection 인증 정상화 ✅ | 영향 0 | unauthorized 호출 audit 의무 충족 ✅ | 영향 0 |
| #2 | 비정상 경로 | accessTokenFn try/catch 갖춤 ✅ | refetch 실패 시 console.error만 (정상) | RAISE 'PERMISSION_DENIED' SQLSTATE 42501 통일 | 영향 0 |
| #5 | 비밀정보 | access_token 메모리 內 (URL/log 노출 0) ✅ | 0 | metadata JSONB 에 PII 금지 (memo_hash 패턴 준수) ✅ | 0 |
| #6 | 런타임 | tsc/build 통과 + 회원 측 회귀 spec 1건 신규 권고 | tsc/build 통과 | dry-run plpgsql parse + 함수 시그니처 미변경 → caller 영향 0 | tsc/build 통과 |

---

## 4. JTBD + RICE

### JTBD (Job-To-Be-Done)

| 항목 | When | I want to | So I can |
|---|---|---|---|
| 1 Realtime 401 | 운영자 평상 예약 현황 진입 시 | 콘솔 노이즈 없이 깔끔한 dev tools | 진짜 에러를 빨리 찾을 수 있다 |
| 2 자동갱신 UX | 운영자가 ⟳ 버튼 누를 때 | 즉시 시각 피드백 (회전 + "방금 갱신") | 작동했는지 의심하지 않고 다음 일을 한다 |
| 3 13 RPC 통일 | 보안 감사 / PIPA 5년 검증 시 | unauthorized 시도가 audit_logs 에 남아 있어야 | 침해 분석/내부 통제 입증 가능 |
| 4 U2 활성화 | 운영자가 모바일에서 CRM 접근 시 | 햄버거 → 사이드바 토글 | 데스크탑 강제 가로 스크롤 없이 운영 |

### RICE (Reach × Impact × Confidence ÷ Effort, 0–10 스케일)

| 항목 | R | I | C | E | RICE |
|---|---|---|---|---|---|
| 1 Realtime 401 (옵션 1 setAuth 즉시 호출) | 5 (admin 전원) | 4 (콘솔 노이즈 제거 + 인증 일관성) | 7 (race 가설은 강함, 잔존 시 옵션 2/3 fallback) | 2 (1~2h) | **70** |
| 2 자동갱신 UX (Phase 1) | 5 (admin 전원, 매일) | 6 (체감 신뢰도) | 9 (1 파일, side effect 0) | 1 (45m) | **270** ⭐ |
| 3 13 RPC 통일 (마이그 083) | 3 (보안 감사용 — 평시 무영향) | 8 (PIPA 5년 의무 + 침해 추적) | 8 (DDL 안전, 시그니처 미변경) | 4 (1일) | **48** |
| 4 U2 활성화 (env 1줄) | 3 (모바일 운영자 비율) | 5 (가시화) | 9 (코드 완료) | 0.2 (5m) | **675** ⭐⭐ |

**RICE 순위**: 4 ≫ 2 > 1 > 3.

> 단, 4는 burn-in (1주) 미달이므로 임계점 도달 (≈2026-05-22) 후 활성 가능. **즉시 RICE 무관**.

---

## 5. 유사 SaaS 패턴 (외부 자료)

### 5-1. Supabase Realtime 공식 가이드 (https://supabase.com/docs/guides/realtime/authorization)

> "If you're using `@supabase/ssr` or `createBrowserClient`, you should configure `realtime.accessToken` so each socket connect uses a fresh JWT. **Do not rely on `setAuth` after the client is created** — the initial WebSocket handshake may have already started with the anon key."
> "For a guaranteed user-token first connection, call `realtime.setAuth(token)` synchronously immediately after client creation **before any channel subscription**."

→ 우리 코드는 `accessToken: accessTokenFn` 옵션은 적용했으나, `_client` 변수 할당 race 로 첫 호출 시 null 반환. **옵션 1 (singleton 생성 직후 즉시 setAuth)** 이 공식 권고 패턴.

### 5-2. Stripe SDK 패턴 (https://docs.stripe.com/api/idempotent_requests + Stripe.js v3)

Stripe.js 는 `loadStripe()` 가 Promise 를 반환 — 클라이언트 인스턴스 준비 완료 전까지 호출 차단. 우리도 **lazy singleton + 첫 호출자가 setAuth 완료까지 await** 패턴이 적용 가능하지만, 본 작업에서는 over-engineering — 단순히 client 생성 직후 동기 setAuth(가능) + async fallback 으로 충분.

### 5-3. Linear / Notion 패턴 (모바일 햄버거 burn-in)

Linear 는 mobile breakpoint 변경 시 **2-week canary** 로 점진 rollout. 우리 burn-in 1주는 단축형이지만 합리적 — 단, 1일만 경과한 시점에 즉시 활성은 권고와 불일치. **5/22 (1주 경과) 활성 권고**.

---

## 6. 4건 우선순위 매트릭스

### 6-1. 의존성 그래프

```
1 Realtime 401  ──┐
                  ├─ 독립 (lib/supabase/client.ts)
2 자동갱신 UX   ──┤
                  ├─ 독립 (app/dashboard/bbq-board/page.tsx)
3 13 RPC 통일   ──┤
                  ├─ 독립 (마이그 083, 함수 시그니처 미변경)
4 U2 활성화     ──┘
                    독립 (Vercel env + redeploy)
```

→ **4건 완전 독립**. 어떤 순서로도 가능.

### 6-2. 충돌 여부

| 쌍 | 충돌 | 비고 |
|---|---|---|
| 1 vs 2 | X | 다른 파일 |
| 1 vs 3 | X | client vs RPC |
| 1 vs 4 | X | client vs sidebar layout |
| 2 vs 3 | X | UI vs DB |
| 2 vs 4 | X | board vs sidebar |
| 3 vs 4 | X | DB vs config |

**충돌 0건**.

### 6-3. 위험·시간 매트릭스

```
            저위험                            고위험
        ┌─────────────┬─────────────────┐
   짧음 │ ④ U2 5m     │                 │
        │ ② UX 45m    │                 │
        ├─────────────┼─────────────────┤
   김   │             │ ① Realtime 1~2h │
        │             │ ③ 13 RPC 1일    │
        └─────────────┴─────────────────┘
```

---

## 7. 일괄 적용 vs 분리 4 PR

### 일괄 적용 시 문제
- ① + ② 동시에 평상 예약 현황 화면에 영향 → 회귀 발현 시 원인 격리 어려움
- ③ 마이그 + 코드 PR 혼재 → 롤백 시 `git revert` 만으로 부족 (마이그 down 필요)
- ④ env flag 활성은 코드 PR 과 무관 — 분리 시 burn-in 일정 분리 가능

### 분리 4 PR 권고 (RECOMMENDED)

| 순서 | PR | 트리거 시점 |
|---|---|---|
| **PR 1** | ② 자동갱신 UX Phase 1 (별도 plan 승인 후 즉시) | kk Q1=A 즉시 |
| **PR 2** | ① Realtime 401 옵션 1 (setAuth 즉시 호출) | kk Q2=옵션1 즉시 |
| **PR 3** | ③ 13 RPC 통일 마이그 083 | kk Q3=Go 후 — 트래픽 적은 시간대 (KST 새벽) |
| **PR 4** | ④ U2 활성화 (env + redeploy) | 5/22 (1주 burn-in 경과) 또는 kk 결정 시 즉시 |

각 PR 독립 검증 + 독립 롤백 가능.

---

## 8. kk 결정 필요 항목 정리 (plan §1 에서 상세화)

| Q | 항목 | 옵션 | 권고 |
|---|---|---|---|
| Q1 | ② 자동갱신 UX Phase 1 적용 | A(적용) / B(보류) | **A** |
| Q2 | ① Realtime 옵션 1 (setAuth 즉시 호출) | 옵션1(setAuth) / 옵션2(localStorage 동기) / 옵션3(supabase-js 직접) / 옵션4(debug 모드만) | **옵션1** |
| Q3 | ③ 13 RPC 통일 마이그 083 | A(Go) / B(보류) | **A** (PIPA 의무) |
| Q4 | ④ U2 활성화 시점 | 즉시 / 5/22 (1주 burn-in 경과) / 5/29 (2주) | **5/22** |
| Q5 | 커밋 전략 | 일괄 1 PR / 분리 4 PR | **분리 4 PR** |

---

## 9. 참조

- `thoughts/sessions/20260516-1230_handover.md` (Realtime 401 진단 + 옵션 1~4 후보)
- `thoughts/sessions/20260516-1100_handover.md` (U2 코드 완료 + flag burn-in)
- `thoughts/research/20260516-1000_three_residuals_research.md` (Realtime + #418 + nested Link 깊은 검수)
- `thoughts/plans/20260516-0930_bbq_board_refresh_plan.md` (자동갱신 UX Plan A — 본 plan 에서 참조 + 우선순위 결정)
- `supabase/migrations/078_admin_helper_and_anon_revoke.sql` (assert_admin_with_audit 헬퍼 본체)
- `supabase/migrations/063_member_lifecycle.sql:62` (is_admin() 본체)
- `supabase/migrations/063_member_lifecycle.sql:96,156,198,263` (suspend/unsuspend/request_del/restore)
- `supabase/migrations/064_membership_zone_change.sql:99,207` (change_zone, get_available_farms)
- `supabase/migrations/065_063_hotfix_search_path_and_restore.sql:23,52,86` (search_path 재정의)
- `supabase/migrations/073_toggle_notice_pin_diagnostic.sql:28` (toggle_notice_pin 인라인 admin)
- `supabase/migrations/021_trigger_error_logs_ack.sql:27,49` (ack_trigger_error_log, ack_all)
- `supabase/migrations/022_admin_check_readonly_rpcs.sql:5,29` (get_unacked_error_count, trigger_error_monthly_summary)
- `lib/supabase/client.ts:19-58` (createClient + accessTokenFn)
- `components/layout/Sidebar.tsx:12-15,189-192` (IA_V2 + mobileEnabled)
- `app/dashboard/bbq-board/page.tsx:71-86` (lastFetched + 새로고침 버튼)
- Supabase Realtime Authorization: https://supabase.com/docs/guides/realtime/authorization
- Stripe.js loadStripe 패턴: https://docs.stripe.com/js/including
- React #418: https://react.dev/errors/418
