# Realtime 401 깊은 디버깅 + get_farms_board RPC 분리 리서치 (2026-05-16)

> **목적**: (1) Realtime 401 3차 시도 실패 원인 정밀 추적 + 옵션 5 도출 (2) get_farms_board RPC 분리 설계
> **스킬**: senior-fullstack + senior-backend + code-reviewer + WebSearch (Supabase 공식 + GitHub issues)
> **상태**: kk 검토 대기 → plan.md (별도) 로 권고안 확정

---

## 0. 한 줄 요약

> **Realtime 401**: GRANT 권한은 정상 (anon+authenticated 둘 다 SELECT). WebSocket upgrade 자체가 anon key로 시작 → setAuth 이전에 첫 connection 시도가 거부됨. 옵션 2 (localStorage 동기 읽기) + 옵션 5 (NEW — createClient의 `global.headers.Authorization` 옵션 동시 적용)이 가장 가능성 높음. **get_farms_board RPC**: search_bbq_reservations와 동일 패턴 (admin only + PIPA audit + LEFT JOIN), 마이그 085로 분리.

---

## 1. Realtime 401 — 3차 시도 실패 정밀 분석

### 1-1. 시도 history

| # | 커밋 | 변경 | 결과 |
|---|---|---|---|
| 1 | `5361889` | TopBar `notifications` 채널에 setAuth | 8건 → 8건 |
| 2 | `9de7b51` | `lib/supabase/client.ts` singleton + realtime.accessToken 옵션 | 8건 → 16건 |
| 3 | `676aaef` | createBrowserClient 직후 명시적 `setAuth(token)` IIFE | 16건 → **28건** |

**오히려 증가**: 16 → 28 — singleton 패턴이 reconnect 시도를 늘렸을 가능성 (이전엔 매 client 재생성).

### 1-2. 실측 데이터

| 항목 | 값 | 출처 |
|---|---|---|
| socketerror 메시지 | "HTTP Authentication failed; no valid credentials available" | Playwright 캡쳐 |
| WebSocket URL | `wss://lhuaxmzsvrmjavanunnv.supabase.co/realtime/v1/websocket?apikey=eyJhbGc...` | network |
| apikey 값 | anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY 그대로) | env 확인 |
| GRANT bbq_reservations | anon + authenticated 모두 SELECT ✓ | SQL 검증 |
| GRANT notifications | 동일 ✓ | SQL 검증 |
| RLS 정책 | `bbq_reservations` admin 만 SELECT (마이그 060) | 코드 확인 |
| 인증된 사용자 호출 시 supabase.from('bbq_reservations') | 정상 동작 (admin RLS 통과) | Playwright |

### 1-3. 원인 가설 (5가지)

| # | 가설 | 가능성 | 근거 |
|---|---|---|---|
| **A** | createBrowserClient 동기 호출 안에서 realtime connect 즉시 발생 → setAuth IIFE 보다 먼저 401 | HIGH | WebSearch GitHub #1559 — Node.js race, 이번엔 browser |
| **B** | RLS 정책이 anon 차단 → publication 거부 → 401 | MID | 마이그 060 admin only 정책. Realtime 서버가 anon으로 access policy cache 시도 |
| **C** | realtime.accessToken 옵션이 @supabase/ssr wrapper 에서 무시 | MID | issue #108 — autoRefreshSession 도 일부 무시 |
| **D** | apikey 만 URL 에 전달, JWT 는 별도 message — first connect 에서 JWT 미전송 | HIGH | 공식 docs: "access_token message 전송 시 정책 캐시" |
| **E** | reconnect loop — 첫 401 후 자동 재시도 8회 (이전 측정), singleton 도입 후 더 자주 reconnect | MID | issue #1088 |

### 1-4. WebSearch 핵심 발견

#### Supabase 공식 (Realtime Authorization)
> "Realtime Postgres Changes are separate from Channel authorization, and the private Channel option does not apply to Postgres Changes."
> "Postgres Changes already adheres to RLS policies on the tables you're listening to."

→ Postgres Changes 는 RLS 의존. setAuth 가 JWT 를 전송하면 RLS 가 admin 확인.

#### GitHub #26932 (Realtime 401 in Next.js)
> "Check Postgres grants — Prisma migrations can wipe out grants to public schema."

→ 우리 케이스는 GRANT 정상 (재확인). 이 가설 제외.

#### Issue #108 (@supabase/ssr autoRefreshSession 무시)
> "`autoRefreshSession: false` does nothing with createBrowserClient"

→ @supabase/ssr 가 일부 옵션을 silently 무시. realtime 옵션도 비슷할 가능성 ⚠.

#### Issue #848/1107 (Table INSERT subscriptions fail 401)
> "If you do not run **grant select on tables to the authenticated role**, you get a 401 error, regardless of whether RLS is enabled."

→ 우리 케이스는 GRANT 정상. 가설 제외.

#### Issue #1559 (WebSocket Race Condition in supabase-js Node.js)
> "Realtime subscriptions consistently timeout due to improper event handler registration timing when global.WebSocket is undefined."

→ Node 한정 — browser 우리 케이스와 다름. 단 race 컨셉 일치.

#### 공식 docs (Realtime Auth Flow)
> "Realtime updates the access policy cache for a client based on RLS policies **when a client connects to Realtime and subscribes to a Channel**, or when a **new JWT is sent to Realtime from a client via the access_token message**."

→ JWT 가 **access_token message** 로 전송됨. setAuth() 가 이 메시지를 보냄. 그러나 **첫 connection 단계 (WebSocket upgrade)는 apikey 만 사용** → upgrade 시 인증 필요한 경우 401.

---

### 1-5. 옵션 2/3/4 + 신규 옵션 5

| 옵션 | 설명 | 신뢰도 | 복잡도 |
|---|---|---|---|
| **2** | localStorage 동기 읽기 (`sb-<ref>-auth-token`) → setAuth 호출 전 token 보유 | MID | LOW |
| **3** | @supabase/supabase-js createClient 직접 호출 (ssr cookie 동기화 별도) | MID | HIGH |
| **4** | supabase-js debug 모드 활성 + GitHub issue 신규 등록 | 진단용 0 | LOW |
| **5** ⭐ NEW | `createBrowserClient` 의 `global.headers.Authorization` 옵션에 initial token 전달 | **HIGH** | LOW |

### 1-6. 옵션 5 상세 (NEW, 가장 가능성 높음)

```ts
// localStorage 동기 읽기 + global.headers + realtime.accessToken 3중 적용
function getInitialToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // Supabase 표준 storage key: sb-<projectRef>-auth-token
    const key = `sb-lhuaxmzsvrmjavanunnv-auth-token`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.access_token ?? null;
  } catch {
    return null;
  }
}

export function createClient() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return createBrowserClient(placeholder...);

  const initialToken = getInitialToken();

  _client = createBrowserClient(url, key, {
    global: initialToken ? {
      headers: { Authorization: `Bearer ${initialToken}` }
    } : undefined,
    realtime: {
      accessToken: accessTokenFn,  // 후속 reconnect 대응
      params: initialToken ? { apikey: key, access_token: initialToken } : { apikey: key },
    },
  });

  // setAuth 즉시 호출 — IIFE (PR2 유지)
  void (async () => {
    try {
      const { data: { session } } = await _client!.auth.getSession();
      if (session?.access_token) _client!.realtime.setAuth(session.access_token);
    } catch {}
  })();

  return _client;
}
```

핵심: **첫 WebSocket connection params 에 access_token 동시 전달** → upgrade 시점부터 JWT 사용 → 401 회피.

⚠ 주의:
- `sb-<ref>-auth-token` storage key 는 비공식. supabase-js 내부 구현 의존 — 향후 변경 위험
- 첫 진입 (로그인 직후) 시 localStorage 비어있을 수 있음 → fallback accessTokenFn

### 1-7. 영향 / 회귀

| 영역 | 영향 |
|---|---|
| `lib/supabase/client.ts` | 단일 변경 |
| 회원 측 (/m/*) | singleton 공유 — 동일 효과 |
| auth 흐름 | 변경 0 (auth.getSession() 그대로) |
| Realtime 채널 (`bbq_board` / `notifications`) | 동일 |
| Sentry/Axiom | 401 0건 시 노이즈 감소 |

---

## 2. get_farms_board RPC 분리 (Phase 2)

### 2-1. 현 상태 (useFarms)

```ts
// lib/use-data.ts:237-276
export function useFarms() {
  const [farmsRes, rentalsRes, zonesRes, ordersRes] = await Promise.all([
    supabase.from('farms_active').select('*').order('number'),
    supabase.from('farm_rentals').select('*, customer:customers(name, phone)').eq('status', 'active'),
    supabase.from('farm_zones_active').select('*').order('sort_order'),
    supabase.from('service_orders').select('*, product, member').in('status', [...]),
  ]);
  // ... enrichment
}
```

**문제**:
- 4 Promise.all (4 round trip)
- service_orders 는 /farms-board 에서 사용 안 함 (관리 페이지 전용)
- audit 누락 (PIPA 의무: 회원 PII 접근 기록)
- RLS 의존 (admin 외도 일부 데이터 노출 가능성)

### 2-2. 신규 RPC `get_farms_board()` 설계

```sql
CREATE OR REPLACE FUNCTION public.get_farms_board()
RETURNS TABLE (
  farm_id           UUID,
  farm_number       INT,
  farm_name         TEXT,
  area_pyeong       NUMERIC,
  zone_id           UUID,
  zone_name         TEXT,
  zone_is_operational BOOLEAN,
  rental_id         UUID,
  customer_id       UUID,
  customer_name     TEXT,
  customer_phone    TEXT,
  rental_plan       TEXT,
  rental_start_date DATE,
  rental_end_date   DATE,
  monthly_fee       INT,
  payment_status    TEXT,
  rental_status     TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $fn_085$
DECLARE v_caller UUID := (SELECT auth.uid()); v_recent_audit BOOLEAN;
BEGIN
  PERFORM public.assert_admin_with_audit('farms_board_read', 'farms_board', '{}'::jsonb);

  -- 1h dedup (079 패턴)
  SELECT EXISTS (SELECT 1 FROM public.audit_logs
    WHERE actor_id = v_caller
      AND action = 'farms_board_view'
      AND created_at > NOW() - INTERVAL '1 hour'
  ) INTO v_recent_audit;
  IF NOT v_recent_audit THEN
    INSERT INTO public.audit_logs (actor_id, action, resource_type, created_at)
    VALUES (v_caller, 'farms_board_view', 'farms_board', NOW());
  END IF;

  RETURN QUERY
  SELECT f.id, f.number, f.name, f.area_pyeong,
         f.zone_id, z.name, z.is_operational,
         r.id, r.customer_id, c.name, c.phone,
         r.plan, r.start_date, r.end_date,
         r.monthly_fee, r.payment_status, r.status
  FROM public.farms f
  LEFT JOIN public.farm_zones z ON z.id = f.zone_id
  LEFT JOIN public.farm_rentals r ON r.farm_id = f.id AND r.status = 'active'
  LEFT JOIN public.customers c ON c.id = r.customer_id
  WHERE f.deleted_at IS NULL
  ORDER BY z.sort_order NULLS LAST, f.number;
END $fn_085$;

GRANT EXECUTE ON FUNCTION public.get_farms_board() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_farms_board() FROM anon, PUBLIC;
```

### 2-3. 신규 훅 `lib/use-farms-board.ts`

```ts
'use client';
import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface FarmBoardRow {
  farm_id: string;
  farm_number: number;
  farm_name: string;
  area_pyeong: number;
  zone_id: string | null;
  zone_name: string | null;
  zone_is_operational: boolean | null;
  rental_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  rental_plan: string | null;
  rental_start_date: string | null;
  rental_end_date: string | null;
  monthly_fee: number | null;
  payment_status: string | null;
  rental_status: string | null;
}

export function useFarmsBoard() {
  const supabase = createClient();
  const [rows, setRows] = useState<FarmBoardRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await supabase.rpc('get_farms_board');
    setRows((data as FarmBoardRow[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetch(); }, [fetch]);
  return { rows, loading, refetch: fetch };
}
```

### 2-4. 농장 보드 컴포넌트 변경

`/dashboard/farms-board/page.tsx` 가 `useFarms()` → `useFarmsBoard()` 로 전환:
- KPI: rows → 도메인 객체 변환 (Farm + zone + rental 합쳐서 Farm[]으로 매핑)
- Matrix: 동일 매트릭스 렌더 (Farm 도메인 객체)

### 2-5. 영향 비교

| 항목 | Before (useFarms) | After (useFarmsBoard) |
|---|---|---|
| Network round trip | 4 (Promise.all) | **1** |
| Payload 크기 | 4 테이블 전체 | 보드 전용 컬럼만 |
| audit 기록 | 없음 | `farms_board_view` 1h dedup |
| 권한 | RLS 의존 | admin only + assert helper |
| /farms 페이지 영향 | - | 0 (useFarms 그대로) |

### 2-6. 사용자 결정 필요

- **Q3**: 데이터 source 옵션 (이번 plan)
  - (1) useFarms 그대로 유지 (Phase 2 보류)
  - (2) ⭐ get_farms_board RPC 분리 적용 (이번 plan)
  - (3) RPC 추가 + useFarms 도 그대로 (병행)

---

## 3. 8축 + 7점 종합

### Realtime 401 옵션 5

| 축 | 결과 |
|---|---|
| A 보안 | ✅ JWT 첫 connection 부터 전달 — RLS 정확 |
| B RLS | ✅ 변경 없음 |
| C UX | ✅ 콘솔 노이즈 0건 기대 |
| D 성능 | ✅ reconnect 줄어 비용 ↓ |
| E 통합/회귀 | ⚠ storage key 비공식 의존 — 향후 supabase-js 변경 시 risk |
| F 명명 | ✅ getInitialToken 명확 |
| G 사이드이펙트 | ✅ 회원 측 동일 client 공유 |
| H 배포안전 | ✅ 즉시 롤백 (git revert) |

### get_farms_board RPC

| 축 | 결과 |
|---|---|
| A 보안 | ✅ admin only + assert helper |
| B RLS/DB | ✅ SECURITY DEFINER + search_path='' |
| C UX | ✅ 영향 0 (UI 동일) |
| D 성능 | ✅ 4 round → 1 round |
| E 통합/회귀 | ✅ /farms 영향 0 |
| F 명명 | ✅ get_farms_board / useFarmsBoard / FarmBoardRow 일관 |
| G 사이드이펙트 | ✅ 마이그 단독, view 영향 0 |
| H 배포 | ✅ DB 적용 + client 점진 |

### 7점 모두 통과 (#1 #2 #5 #6 — tsc/build 검증 필수)

---

## 4. 리스크

| # | 항목 | 가능성 | 완화 |
|---|---|---|---|
| R1 | 옵션 5 도 효과 미발현 (5차 실패) | MID | 옵션 4 fallback (debug 모드 + GitHub issue 등록) |
| R2 | sb-<ref>-auth-token storage key 변경 | LOW | supabase-js v3 nullable 또는 명시 옵션 |
| R3 | global.headers.Authorization 이 회원 측 RLS 우회 | LOW | RLS 정책 unchanged, JWT decode 시 user_id 정확 |
| R4 | get_farms_board RPC 첫 호출 latency | LOW | 60 행 단일 query — < 50ms |
| R5 | useFarmsBoard 도입 후 /farms-board 회귀 | LOW | Playwright spec 1건 |
| R6 | farms_board_view audit 폭증 | LOW | 1h dedup 적용 |

---

## 5. 출처

- [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)
- [Supabase Realtime setAuth Reference](https://supabase.com/docs/reference/javascript/realtime-setauth)
- [GitHub: Realtime 401 in Next.js Discussion #26932](https://github.com/orgs/supabase/discussions/26932)
- [GitHub: WebSocket Race Condition #1559](https://github.com/supabase/supabase-js/issues/1559)
- [GitHub: @supabase/ssr autoRefreshSession Issue #108](https://github.com/supabase/ssr/issues/108)
- [Supabase Docs: Database API 42501 errors](https://supabase.com/docs/guides/troubleshooting/database-api-42501-errors)
- 사내: lib/supabase/client.ts (3차 시도 누적)
- 사내: lib/use-data.ts:237-276 (useFarms)
- 사내: supabase/migrations/082_search_bbq_reservations.sql (RPC 패턴)
- 사내: supabase/migrations/079_bbq_board_audit_dedup.sql (1h dedup)
- 사내: thoughts/sessions/20260516-1900_handover.md (3차 시도 history)
