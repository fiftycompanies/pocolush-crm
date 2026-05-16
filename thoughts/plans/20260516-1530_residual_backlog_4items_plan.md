# 잔여 백로그 4건 통합 실행 플랜 v1 (2026-05-16 15:30)

> **작성**: 2026-05-16 15:30
> **선행**: `thoughts/research/20260516-1500_residual_backlog_4items_research.md`
> **상태**: 🔴 **kk 승인 대기** (구현 금지)
> **권고**: **분리 4 PR**, 진입 순서 ② → ① → ③ → ④
> **변경 규모**: 코드 2 파일 + 마이그 1 (083) + Vercel env 1
> **라이브 영향**: 0 (모두 hotfix/idempotent/flag-gated)

---

## 0. 한 줄 요약

> 잔존 P0 2건 (Realtime 401 재진단 + 자동갱신 UX) + P1 2건 (13 RPC `is_admin()` 통일 + U2 모바일 햄버거 활성)을 **4개 독립 PR** 로 분리 실행. 의존성·충돌 0. 총 작업량 ~5h (병렬화 가능). 항목별 즉시 롤백 가능 + 평시 트래픽 시간대 회피 권고는 PR 3 마이그뿐.

---

## 1. kk 결정 필요 (5건)

| Q | 항목 | 옵션 | 권고 |
|---|---|---|---|
| **Q1** | ② 자동갱신 UX (Phase 1 적용) | A(적용) / B(보류) | **A** ⭐ |
| **Q2** | ① Realtime 401 옵션 | 옵션1(setAuth 즉시 호출) / 옵션2(localStorage 동기 읽기) / 옵션3(supabase-js 직접 호출) / 옵션4(debug 모드로 trace 먼저) | **옵션1** ⭐ (가장 빠름, 공식 가이드 준수) |
| **Q3** | ③ 13 RPC 통일 마이그 083 | A(Go) / B(보류) | **A** ⭐ (PIPA 5년 의무) |
| **Q4** | ④ U2 모바일 햄버거 활성화 시점 | (i) 즉시 / (ii) 5/22 (1주 burn-in 경과) / (iii) 5/29 (2주) | **(ii) 5/22** ⭐ (코드 배포 5/15 → 1주 경과) |
| **Q5** | 커밋 전략 | 일괄 1 PR / 분리 4 PR | **분리 4 PR** ⭐ |

**답변 형식**: `Q1=A, Q2=옵션1, Q3=A, Q4=ii, Q5=분리` 또는 "권고대로". §10 메모란 직접 기입.

---

## 2. ② 자동갱신 UX 강화 (P0)

> **상세 plan 본체**: `thoughts/plans/20260516-0930_bbq_board_refresh_plan.md` — 본 문서는 4건 통합 우선순위/충돌 평가 + 핵심 요약만 다룸. 변경 코드는 기존 plan §3 인용.

### 2-1. 변경 파일 + 라인
- `app/dashboard/bbq-board/page.tsx:30-86` (isRefreshing state + handleRefresh + formatAgo + 버튼 클래스)
- 변경 라인 수: ~15 lines
- 영향 파일: 1

### 2-2. 핵심 요약
- 클릭 → `isRefreshing=true` + `RefreshCw className="animate-spin"` + `disabled` + 최소 600ms 시각 피드백
- `lastFetched` 표기 → `formatAgo()`: "방금 갱신" / "N초 전 갱신" / "N분 전 갱신"
- E2E `data-testid="refresh-btn"` 유지 → 기존 spec 무영향

### 2-3. 4건 통합 시 우선순위 평가
- RICE **270** (4건 중 2위)
- 사용자 불만 직접 해소 — **PR 1 진입 권고**
- 다른 3건과 충돌 0 (다른 파일)

### 2-4. 시간 추정
- 코드 수정 15m + tsc/build/Playwright 15m + 커밋/배포/prod 검증 15m = **~45m**

---

## 3. ① Realtime 401 재진단 (P0)

### 3-1. 진단 (research §1-1)
이전 커밋 9de7b51 적용 (`createBrowserClient` + `realtime.accessToken: accessTokenFn`) 했으나 prod 검증 시 16건 socketerror 잔존.

원인 가설: `_make()` 호출 → 내부 realtime 즉시 connect → `accessTokenFn` 호출 시 `_client === null` → null 반환 → anon fallback → 첫 connection 401.

### 3-2. 변경 파일 + 라인
`lib/supabase/client.ts` (현재 1~58 라인)

### 3-3. 옵션 1 (권고) — singleton 생성 직후 setAuth 즉시 호출

**의도된 변경 골격** (실제 구현은 `/implement` 단계):

```ts
// lib/supabase/client.ts (현재 42~58 → 변경 후)
export function createClient() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'placeholder-key',
    );
  }
  _client = _make(url, key);
  // 추가: 생성 직후 비동기 setAuth — 첫 reconnect 부터 user token 사용
  // (첫 connect 의 race 는 accessTokenFn fallback 이 처리,
  //  setAuth 가 reconnect 전 완료되면 401 0건)
  void (async () => {
    try {
      const { data: { session } } = await _client!.auth.getSession();
      if (session?.access_token) {
        _client!.realtime.setAuth(session.access_token);
      }
    } catch {
      /* anon fallback 유지 */
    }
  })();
  return _client;
}
```

### 3-4. 옵션 비교

| 옵션 | 변경량 | 효과 신뢰도 | 회원 측 회귀 위험 |
|---|---|---|---|
| **1 setAuth 즉시 호출** ⭐ | +6 lines | 높음 (Supabase 공식 가이드) | 낮음 (Promise 비동기, 메인 흐름 무영향) |
| 2 localStorage 동기 읽기 | +10 lines | 중간 (storage key 구조 의존) | 중간 (SSR 분기 별도 처리) |
| 3 supabase-js 직접 호출 | +30 lines (SSR cookie 동기화 분리) | 높음 | 높음 (전역 client 교체) |
| 4 debug 모드만 | 0 lines | 0 (진단용) | 0 |

### 3-5. 영향 범위
- 전역 client 동작 (admin + 회원 측 /m/*)
- 신규 호출: `auth.getSession()` × 1 + `realtime.setAuth()` × 1 (singleton 생성 시 1회)
- 비용: 무시 가능 (메모리 캐시된 session 사용)

### 3-6. 7점 체크
- #1 인증: 첫 connection 부터 user token → RLS 정확 ✅
- #2 비정상: try/catch 누락 0 ✅
- #5 비밀: access_token 메모리 內 (로그/URL 노출 0) ✅
- #6 런타임: tsc/build 통과 + Playwright Realtime spec 신규 1건 권고

### 3-7. 시간 추정
- 코드 수정 15m + tsc/build 15m + Playwright (회원 + admin) 30m + 커밋/배포 30m = **~1.5h**

### 3-8. 검증 시나리오
- Playwright admin login → /dashboard/bbq-board 진입 5s → `page.on('websocket', w => w.on('socketerror', ...))` 0건 기대
- Playwright 회원 login → /m/* 진입 5s → 회귀 0건 기대

### 3-9. 4건 통합 시 우선순위 평가
- RICE **70** (4건 중 3위)
- 운영 영향 0 (콘솔 노이즈만) — 시급도 낮음
- 단, 코드 적용 미해결 상태 유지 시 다음 세션 디버깅 부담 ↑ → **PR 2 진입 권고**

---

## 4. ③ A2 13 RPC `is_admin()` 일괄 통일 (P1)

### 4-1. 대상 함수 (research §1-3, 13건)

| # | 함수 시그니처 | 현재 패턴 | 마이그 |
|---|---|---|---|
| 1 | `public.suspend_member(UUID, TEXT, TEXT)` | `IF NOT public.is_admin() THEN RAISE 'NOT_ADMIN'` | 063 / 065 재정의 |
| 2 | `public.unsuspend_member(UUID)` | 동일 | 063 |
| 3 | `public.request_member_deletion(UUID, TEXT, TEXT)` | 동일 | 063 / 065 |
| 4 | `public.restore_member_deletion(UUID)` | 동일 | 063 / 065 |
| 5 | `public.validate_zone_change(...)` | `OR public.is_admin()` (분기) — 통일 대상 외 | 064 |
| 6 | `public.change_membership_zone(...)` | `IF NOT public.is_admin() THEN RAISE` | 064 |
| 7 | `public.get_available_farms_for_transfer(...)` | 동일 | 064 |
| 8 | `public.get_zone_dashboard()` | 인라인 EXISTS profiles role='admin' | 065 |
| 9 | `public.toggle_notice_pin(UUID)` | 인라인 EXISTS | 073 |
| 10 | `public.ack_trigger_error_log(UUID)` | 인라인 EXISTS | 021 |
| 11 | `public.ack_all_trigger_error_logs()` | 인라인 EXISTS | 021 |
| 12 | `public.get_unacked_error_count()` | 인라인 EXISTS (read-only) | 021 / 022 |
| 13 | `public.trigger_error_monthly_summary()` | 인라인 EXISTS (read-only) | 021 / 022 |

#5 `validate_zone_change` 는 회원 본인 + admin 둘 다 허용하는 분기 패턴 — `assert_admin_with_audit` 일괄 적용 대상 외. **12건 통일 + 1건 보존** 으로 조정 가능. 단, 명목상 "A2 13 RPC" 백로그 항목과 일치시키려면 read-only 2건(#12, #13)을 포함하여 12건 통일 + 1건 패스 + 별도 보고.

### 4-2. 마이그 파일 (083_unify_admin_check_to_assert_helper.sql)

**의도된 변경 골격** (각 함수 DROP+CREATE 재정의, 시그니처 유지):

```sql
-- 083_unify_admin_check_to_assert_helper.sql (요지)
-- 모든 함수: 본문 첫 줄 `IF NOT public.is_admin() THEN RAISE 'NOT_ADMIN'` 를
-- `PERFORM public.assert_admin_with_audit('<action>', '<resource_type>', <metadata>);` 로 교체.

CREATE OR REPLACE FUNCTION public.suspend_member(
  p_member_id UUID, p_reason_category TEXT, p_reason_memo TEXT DEFAULT NULL
)
RETURNS public.members
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_member public.members;
BEGIN
  PERFORM public.assert_admin_with_audit(
    'suspend_member', 'member',
    jsonb_build_object('member_id', p_member_id, 'reason_category', p_reason_category)
  );
  -- ... 기존 본문 (065 마이그의 search_path-safe 버전 유지) ...
END $$;

-- 나머지 11건도 동일 패턴
```

### 4-3. 영향 분석

| 항목 | 영향 |
|---|---|
| 함수 시그니처 | 변경 없음 (caller 코드 영향 0) |
| GRANT EXECUTE | 기존 그대로 (DROP 없이 CREATE OR REPLACE) |
| Lock | 함수 객체 ms 단위 — 실행 중 호출은 기존 plan 으로 완주 (PostgreSQL semantic) |
| 정상 호출 audit_logs | 변화 없음 (기존 함수가 내부적으로 logs INSERT) |
| **unauthorized 호출 audit_logs** | **신규 row INSERT** (`action='<base>_unauthorized'`) ✅ 핵심 효과 |
| RLS 정책 (`OR public.is_admin()`) | 보존 (RLS 는 함수 호출 패턴 변경 없음) |
| PIPA 5년 보관 | audit_logs 적용 받음 |

### 4-4. 8축 + 7점 (research §2/§3 참조)

핵심: **#1 인증 검증의 audit 누락 0건화** — unauthorized 시도 감사 능력 확보.

### 4-5. 적용 절차 (Q3=A 선택 시)

1. dry-run: `supabase db diff` 또는 staging 적용 (가능 시)
2. 트래픽 적은 시간대 (KST 새벽 02~05) prod 적용
3. 즉시 검증 SQL:
   ```sql
   -- 각 함수가 헬퍼 호출 패턴 포함하는지
   SELECT proname FROM pg_proc WHERE prosrc ILIKE '%assert_admin_with_audit%';
   -- 12건 (#5 제외) 반환 기대
   ```
4. 회귀 검증: 정상 admin 호출 1건 / 비admin (회원) 호출 1건 → audit_logs `<base>_unauthorized` row 1건 확인

### 4-6. 롤백
- 마이그 083 적용 전 각 함수 정의를 `pg_get_functiondef(oid)` 로 snapshot (작업 시작 전 outbox/ 저장)
- 롤백 시 snapshot 그대로 재실행 → 1분

### 4-7. 시간 추정
- 함수 12건 마이그 작성 60m + dry-run 30m + prod 적용 + 검증 + audit 회귀 spec 90m + 커밋/배포 30m = **~1일 (3.5h 실효)**

### 4-8. 4건 통합 시 우선순위 평가
- RICE **48** (4건 중 4위)
- 평시 사용자 체감 0, 보안 감사 시 필요
- **PR 3 진입 권고** (트래픽 적은 시간 회피)

---

## 5. ④ U2 모바일 햄버거 활성화 (P1)

### 5-1. 현 상태
- 코드 완료: 커밋 a44be66 (2026-05-15)
- flag 미설정: `NEXT_PUBLIC_SIDEBAR_MOBILE_V2`
- burn-in 경과: 1일 (목표 1주 = 5/22)

### 5-2. 변경 사항
- 코드 변경 0
- Vercel env 1개 추가:
  ```bash
  printf "1" | vercel env add NEXT_PUBLIC_SIDEBAR_MOBILE_V2 production
  vercel deploy --prod --yes
  ```
- `printf "1"` 권고 이유: `echo "1"` 은 `\n` 포함 → `process.env.X === '1'` 미스. 단, `Sidebar.tsx:15` 에 `.trim()` 적용됐으므로 `echo` 도 안전 (방어 코드 검증 완료).

### 5-3. 활성화 시점 옵션

| 옵션 | 설명 | 권고 |
|---|---|---|
| (i) 즉시 | 2026-05-16 (1일 burn-in) | 비권고 |
| **(ii) 5/22** ⭐ | 1주 burn-in 경과 | **권고** |
| (iii) 5/29 | 2주 burn-in | over-conservative |

### 5-4. 검증 절차
1. 활성 직후 Playwright mobile 375 viewport
2. /dashboard 진입 → 햄버거 visible
3. 햄버거 클릭 → 사이드바 translate-x-0
4. 사이드바 링크 클릭 → 닫힘 (`onLinkClick` 콜백)
5. 회귀: 데스크탑 1280 → V1/V2 영향 0

### 5-5. 롤백
```bash
vercel env rm NEXT_PUBLIC_SIDEBAR_MOBILE_V2 production -y
vercel deploy --prod --yes
```
1~2분.

### 5-6. 4건 통합 시 우선순위 평가
- RICE **675** (1위) — 단, burn-in 일정에 결박
- **PR 4 진입 권고** (5/22 시점, 다른 3건 PR 완료 후)

### 5-7. 시간 추정
- env add + deploy 5m + Playwright mobile 검증 10m = **~15m**

---

## 6. 통합 검증 계획

### 6-1. PR 1 (② 자동갱신 UX) 검증
- `npx tsc --noEmit` 0 에러
- `npm run build` 0 에러
- Playwright dev: 회전 + disabled + "방금 갱신" 확인
- prod 배포 후 ⟳ 클릭 시 사용자 신호 ↑ 모니터링

### 6-2. PR 2 (① Realtime 401) 검증
- `npx tsc --noEmit` 0 에러
- Playwright admin: /dashboard/bbq-board 5s 진입 → socketerror 0건 (이전 16건 → 0건 기대)
- Playwright 회원 (`/m/login` → BbqGrid): socketerror 0건 + Realtime 채널 SUBSCRIBED OK
- Vercel logs 24h 모니터링 (Sentry/Axiom)

### 6-3. PR 3 (③ 13 RPC 통일) 검증
- SQL: `SELECT proname FROM pg_proc WHERE prosrc ILIKE '%assert_admin_with_audit%';` → 12건 반환
- 회귀: admin 정상 호출 (e.g. suspend_member) → 정상 작동 + 기존 audit row 1건
- 회귀: 비admin 호출 (회원 token) → `PERMISSION_DENIED` + `audit_logs.action='suspend_member_unauthorized'` row 1건
- 24h 후 `SELECT action, COUNT(*) FROM audit_logs WHERE action LIKE '%_unauthorized' GROUP BY action;` 모니터링

### 6-4. PR 4 (④ U2 활성화) 검증
- Playwright mobile 375 햄버거 + 사이드바 토글
- 데스크탑 1280 회귀 0
- iOS Safari + Android Chrome 실기기 권고 (선택)

---

## 7. 롤백 (PR별)

| PR | 롤백 명령 | 소요 |
|---|---|---|
| 1 자동갱신 UX | `git revert <c>` → push | 2m |
| 2 Realtime 401 | `git revert <c>` → push (옵션 1 코드만 제거, accessTokenFn 옵션은 유지/제거 선택) | 2m |
| 3 13 RPC | snapshot 마이그 (작업 시작 전 백업) 재실행 | 5m |
| 4 U2 활성화 | `vercel env rm NEXT_PUBLIC_SIDEBAR_MOBILE_V2 production -y` + redeploy | 2m |

---

## 8. 작업량 추정

| PR | 항목 | 시간 |
|---|---|---|
| 1 | ② 자동갱신 UX (기존 plan) | 45m |
| 2 | ① Realtime 401 옵션 1 | 1.5h |
| 3 | ③ 13 RPC 통일 마이그 083 | 3.5h (실효) |
| 4 | ④ U2 활성화 | 15m |
| | **합계** | **~6h** (순차) / **~3.5h** (병렬 시) |

---

## 9. 리스크 + 완화

| 리스크 | 가능성 | 영향 | 완화 |
|---|---|---|---|
| ① 옵션 1 도 효과 미발현 | LOW | 콘솔 노이즈 잔존 | 옵션 2/3 fallback 준비, debug 모드로 trace 병행 |
| ① 회원 측 회귀 | LOW | RLS 미스로 데이터 미노출 | Playwright 회원 spec 1건 신규 (sign-in → /m/* 데이터 fetch) |
| ② Phase 1 UX 변화로 운영자 혼란 | VERY LOW | 적응 1일 | "방금 갱신" 친화 문구로 학습 곡선 완만 |
| ③ 마이그 적용 중 트래픽 충돌 | LOW | 함수 lock ms — 거의 무영향 | KST 새벽 02~05 적용 |
| ③ pg_get_functiondef snapshot 누락 시 롤백 어려움 | LOW | 함수 정의 복구 어려움 | 작업 시작 전 12개 함수 snapshot 을 outbox/ 저장 — **필수** |
| ④ burn-in 1일 단축 활성 시 모바일 회귀 | MID | 모바일 운영자 영향 | (ii) 5/22 권고 — burn-in 충족 |
| 4 PR 동시 진행 시 검증 혼선 | LOW | 회귀 원인 격리 어려움 | 분리 PR + PR 별 24h 간격 권고 (또는 PR 1+2 묶기) |

---

## 10. kk 피드백 (kk 직접 메모)

- **Q1 (자동갱신 UX 적용)**:
- **Q2 (Realtime 401 옵션)**:
- **Q3 (13 RPC 통일 마이그 083)**:
- **Q4 (U2 활성화 시점)**:
- **Q5 (커밋 전략)**:
- **추가 요구사항**:
- **반대/대안**:

---

## 11. 참조

### 본 plan 의 근거
- 리서치: `thoughts/research/20260516-1500_residual_backlog_4items_research.md`
- 자동갱신 UX 별도 plan: `thoughts/plans/20260516-0930_bbq_board_refresh_plan.md`
- 3 잔존 리서치: `thoughts/research/20260516-1000_three_residuals_research.md`

### 인계 컨텍스트
- `thoughts/sessions/20260516-1230_handover.md` (Realtime 401 잔존 + 옵션 1~4)
- `thoughts/sessions/20260516-1100_handover.md` (U2 코드 완료 + 1주 burn-in)

### DB 마이그
- 헬퍼 본체: `supabase/migrations/078_admin_helper_and_anon_revoke.sql:4-25`
- is_admin() 본체: `supabase/migrations/063_member_lifecycle.sql:62-78`
- 통일 대상 함수: `063_member_lifecycle.sql:83,147,185,254` + `064_membership_zone_change.sql:183,335` + `065_063_hotfix_search_path_and_restore.sql:18,47,79,143` + `073_toggle_notice_pin_diagnostic.sql:11` + `021_trigger_error_logs_ack.sql:27,49,75,86`

### 코드
- `lib/supabase/client.ts:19-58` (createClient + accessTokenFn 현재 구현)
- `components/layout/Sidebar.tsx:12-15,189-192` (IA_V2 + mobileEnabled)
- `app/dashboard/bbq-board/page.tsx:30-86` (BoardClient 헤더 + 새로고침 버튼)

### 외부 가이드
- Supabase Realtime Authorization: https://supabase.com/docs/guides/realtime/authorization
- Stripe.js loadStripe (lazy singleton 패턴): https://docs.stripe.com/js/including
- React #418 (참고): https://react.dev/errors/418
- HTML5 anchor nesting (참고): https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-a-element

---

## 12. END — kk Q1~Q5 답변 후 PR 진입 (① 권고 순서: PR1 → PR2 → PR3 → PR4). 미승인 상태에서 구현 금지.
