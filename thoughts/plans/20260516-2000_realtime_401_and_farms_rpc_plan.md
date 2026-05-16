# Realtime 401 옵션 5 + get_farms_board RPC 통합 실행 플랜 v1

> **작성**: 2026-05-16 20:00
> **선행**: `thoughts/research/20260516-1930_realtime_401_deep_and_farms_rpc_research.md`
> **상태**: 🔴 **kk 승인 대기**
> **권고**: PR 1 (Realtime 401 옵션 5 — global.headers.Authorization + localStorage 동기 토큰) + PR 2 (마이그 085 get_farms_board RPC)
> **변경 규모**: 코드 2 파일 + 마이그 1 + 신규 훅 1
> **라이브 영향**: 0 (모두 점진/idempotent)

---

## 0. 한 줄 요약

> Realtime 401 = WebSocket upgrade 시점에 JWT 미전송이 진짜 원인. 옵션 5 (localStorage 동기 토큰 → `global.headers.Authorization` + `realtime.params.access_token`)로 첫 connection 부터 user JWT 전달. 농장 보드는 `get_farms_board()` RPC 분리 (마이그 085)로 4 round trip → 1 + PIPA audit 1h dedup.

---

## 1. kk 결정 필요 (5건)

| Q | 항목 | 옵션 | 권고 |
|---|---|---|---|
| **Q1** | Realtime 401 옵션 | 2 (localStorage 만) / 3 (createClient 직접) / 4 (debug 진단) / 5 (localStorage + global.headers + realtime.params 3중) | **5** ⭐ |
| **Q2** | get_farms_board RPC 적용 | 1 (useFarms 유지) / 2 (RPC 분리) / 3 (병행) | **2** ⭐ |
| **Q3** | PR 분리 | 1 PR (일괄) / 2 PR (분리) | **2** ⭐ (롤백 정밀) |
| **Q4** | 옵션 5 실패 시 fallback | 4 (debug) 즉시 진행 / 보류 | **4** ⭐ |
| **Q5** | farms_board_view audit 1h dedup | 적용 / 미적용 (모든 진입 기록) | **적용** ⭐ |

답변: `Q1=5, Q2=2, Q3=2, Q4=4, Q5=적용` 또는 **"권고대로"**.

---

## 2. PR 1 — Realtime 401 옵션 5 (`lib/supabase/client.ts`)

### 2-1. 변경 파일: `lib/supabase/client.ts` (현재 58 라인 → ~80 라인)

```ts
import { createBrowserClient } from '@supabase/ssr';

type BrowserClient = ReturnType<typeof _make>;
let _client: BrowserClient | null = null;

// 2026-05-16 PR 옵션 5: WebSocket upgrade 첫 connection 부터 JWT 전달
// supabase-js 표준 storage key (변경 시 supabase-js v3 마이그 검토)
const STORAGE_KEY_PREFIX = 'sb-';
const STORAGE_KEY_SUFFIX = '-auth-token';

function getInitialToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return null;
    // URL → projectRef 추출 (https://<ref>.supabase.co)
    const ref = url.replace(/^https?:\/\//, '').split('.')[0];
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${ref}${STORAGE_KEY_SUFFIX}`);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.access_token ?? null;
  } catch {
    return null;
  }
}

async function accessTokenFn(): Promise<string | null> {
  if (!_client) return null;
  try {
    const { data: { session } } = await _client.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

const _make = (url: string, key: string, initialToken: string | null) => {
  const opts: Parameters<typeof createBrowserClient>[2] = {
    realtime: {
      accessToken: accessTokenFn,  // 후속 reconnect 대응
      params: initialToken
        ? { apikey: key, access_token: initialToken }
        : { apikey: key },
    },
  };
  if (initialToken) {
    opts.global = {
      headers: { Authorization: `Bearer ${initialToken}` },
    };
  }
  return createBrowserClient(url, key, opts);
};

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

  const initialToken = getInitialToken();
  _client = _make(url, key, initialToken);

  // 후속 setAuth — IIFE (PR2 유지)
  void (async () => {
    try {
      const { data: { session } } = await _client!.auth.getSession();
      if (session?.access_token) {
        _client!.realtime.setAuth(session.access_token);
      }
    } catch { /* anon fallback */ }
  })();

  return _client;
}
```

### 2-2. 검증

| 시나리오 | 기대 |
|---|---|
| prod /dashboard/bbq-board 5s 진입 (관리자 세션) | socketerror 0건 (이전 28건) |
| prod /m/login 비로그인 진입 | initial token null → 기존 anon 폴백 (회귀 0) |
| prod 회원 /m/* 진입 | 회원 JWT 전달 → RLS 정확 |
| 로그인 직후 첫 진입 | localStorage 비어있음 → IIFE 가 setAuth 호출 (보조 안전망) |

### 2-3. 영향

- `lib/supabase/client.ts` 단일 파일
- 회원 측 /m/* 동일 client 공유 → 회원 JWT 도 동일 흐름
- auth 흐름 변경 0 (signIn/signOut 영향 0)
- Storage key 비공식 의존 — supabase-js major version 변경 시 점검 필요 (현재 v2.98)

### 2-4. 작업량
- 코드 수정 20m + tsc/build 10m + prod 배포 + 검증 30m = **~1h**

---

## 3. PR 2 — get_farms_board RPC (마이그 085 + 훅)

### 3-1. 마이그 `supabase/migrations/085_get_farms_board.sql`

```sql
-- 085: 농장 보드 전용 RPC (search_bbq_reservations 패턴 답습)
-- 배경: /dashboard/farms-board 의 useFarms() 가 4 Promise.all (round trip 4 + 무겁움)
-- 변경: get_farms_board() RPC 단일 호출 (admin only + PIPA audit 1h dedup)
-- 영향: /farms 페이지 미변경 (useFarms 그대로)

CREATE OR REPLACE FUNCTION public.get_farms_board()
RETURNS TABLE (
  farm_id             UUID,
  farm_number         INT,
  farm_name           TEXT,
  area_pyeong         NUMERIC,
  zone_id             UUID,
  zone_name           TEXT,
  zone_sort_order     INT,
  zone_is_operational BOOLEAN,
  rental_id           UUID,
  customer_id         UUID,
  customer_name       TEXT,
  customer_phone      TEXT,
  rental_plan         TEXT,
  rental_start_date   DATE,
  rental_end_date     DATE,
  monthly_fee         INT,
  payment_status      TEXT,
  rental_status       TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $fn_085_farms_board$
DECLARE
  v_caller       UUID := (SELECT auth.uid());
  v_recent_audit BOOLEAN;
BEGIN
  PERFORM public.assert_admin_with_audit('farms_board_read', 'farms_board', '{}'::jsonb);

  -- PIPA 1h dedup (079 패턴)
  SELECT EXISTS (
    SELECT 1 FROM public.audit_logs al
    WHERE al.actor_id = v_caller
      AND al.action = 'farms_board_view'
      AND al.created_at > NOW() - INTERVAL '1 hour'
  ) INTO v_recent_audit;

  IF NOT v_recent_audit THEN
    INSERT INTO public.audit_logs (actor_id, action, resource_type, created_at)
    VALUES (v_caller, 'farms_board_view', 'farms_board', NOW());
  END IF;

  RETURN QUERY
  SELECT
    f.id, f.number, f.name, f.area_pyeong,
    f.zone_id, z.name, z.sort_order, z.is_operational,
    r.id, r.customer_id, c.name, c.phone,
    r.plan::TEXT, r.start_date, r.end_date,
    r.monthly_fee, r.payment_status, r.status
  FROM public.farms f
  LEFT JOIN public.farm_zones z ON z.id = f.zone_id
  LEFT JOIN public.farm_rentals r ON r.farm_id = f.id AND r.status = 'active'
  LEFT JOIN public.customers c ON c.id = r.customer_id
  WHERE f.deleted_at IS NULL
  ORDER BY z.sort_order NULLS LAST, f.number;
END
$fn_085_farms_board$;

GRANT EXECUTE ON FUNCTION public.get_farms_board() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_farms_board() FROM anon, PUBLIC;

COMMENT ON FUNCTION public.get_farms_board() IS
  '085: 농장 보드 전용 (admin only + PIPA 1h dedup). 4 round trip → 1.';
```

### 3-2. 신규 훅 `lib/use-farms-board.ts`

```ts
'use client';
import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Farm, FarmZone, FarmRental, Customer } from '@/types';

export interface FarmBoardRow {
  farm_id: string;
  farm_number: number;
  farm_name: string;
  area_pyeong: number;
  zone_id: string | null;
  zone_name: string | null;
  zone_sort_order: number | null;
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

/**
 * RPC FarmBoardRow → 기존 Farm + FarmZone 도메인 객체로 매핑
 * (KPI/Matrix 컴포넌트가 기존 Farm/FarmZone 타입 사용)
 */
function mapToDomain(rows: FarmBoardRow[]): { farms: Farm[]; zones: FarmZone[] } {
  const zoneMap = new Map<string, FarmZone>();
  const farms: Farm[] = rows.map((r) => {
    if (r.zone_id && !zoneMap.has(r.zone_id)) {
      zoneMap.set(r.zone_id, {
        id: r.zone_id,
        name: r.zone_name ?? '',
        description: null,
        sort_order: r.zone_sort_order ?? 0,
        is_active: true,
        is_operational: r.zone_is_operational ?? false,
        created_at: '',
      });
    }
    const farm: Farm = {
      id: r.farm_id,
      number: r.farm_number,
      name: r.farm_name,
      area_pyeong: r.area_pyeong,
      area_sqm: r.area_pyeong * 3.30579,
      status: r.rental_id ? 'rented' : 'available',
      zone_id: r.zone_id ?? '',
      position_x: 0,
      position_y: 0,
      created_at: '',
    };
    if (r.rental_id) {
      farm.current_rental = {
        id: r.rental_id,
        farm_id: r.farm_id,
        customer_id: r.customer_id ?? '',
        plan: (r.rental_plan as FarmRental['plan']) ?? undefined,
        start_date: r.rental_start_date ?? '',
        end_date: r.rental_end_date ?? '',
        monthly_fee: r.monthly_fee ?? 0,
        payment_method: '',
        payment_status: (r.payment_status as FarmRental['payment_status']) ?? '대기',
        status: r.rental_status ?? 'active',
        created_at: '',
        updated_at: '',
        customer: { id: r.customer_id ?? '', name: r.customer_name ?? '', phone: r.customer_phone ?? '' } as Customer,
      } as FarmRental & { customer: Customer };
    }
    return farm;
  });
  const zones = Array.from(zoneMap.values()).sort((a, b) => a.sort_order - b.sort_order);
  return { farms, zones };
}

export function useFarmsBoard() {
  const supabase = createClient();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [zones, setZones] = useState<FarmZone[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_farms_board');
    if (error || !data) { setLoading(false); return; }
    const { farms: f, zones: z } = mapToDomain(data as FarmBoardRow[]);
    setFarms(f);
    setZones(z);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetch(); }, [fetch]);
  return { farms, zones, loading, refetch: fetch };
}
```

### 3-3. `/dashboard/farms-board/page.tsx` 변경

```diff
- import { useFarms } from '@/lib/use-data';
+ import { useFarmsBoard } from '@/lib/use-farms-board';

  export default function FarmsBoardPage() {
-   const { data: farms, zones, loading, refetch } = useFarms();
+   const { farms, zones, loading, refetch } = useFarmsBoard();
```

기존 컴포넌트 (FarmsBoardKpi/Matrix + FarmDrawer) 모두 그대로 — Farm + FarmZone 도메인 객체 입력.

### 3-4. 영향

| 영역 | 영향 |
|---|---|
| `/dashboard/farms` (관리 페이지) | 0 (useFarms 그대로) |
| `/dashboard/farms-board` 보드 | useFarms → useFarmsBoard 1줄 |
| FarmsBoardKpi/Matrix | 0 (Farm/FarmZone 타입 동일 입력) |
| FarmDrawer | 0 |
| Network round trip (보드 진입) | 4 → **1** |
| audit_logs | +1 action `farms_board_view` (1h dedup) |

### 3-5. 작업량
- 마이그 085 + Supabase MCP apply 15m
- use-farms-board.ts 작성 30m
- page.tsx 1줄 + tsc/build 10m
- prod 배포 + Playwright 검증 30m
- = **~1.5h**

---

## 4. 검증 계획

### 4-1. PR 1 (Realtime 401)
- tsc 0 / build 0
- Playwright prod admin: /dashboard/bbq-board 5s 진입 → socketerror **0건** (이전 28건)
- Playwright prod admin: /dashboard 진입 → console error 0
- Playwright 회원 /m/login 200 + RLS 정상 데이터 fetch

### 4-2. PR 2 (get_farms_board)
- Supabase MCP apply_migration success
- 직접 RPC 호출 (admin 컨텍스트) → 60 rows + audit_logs `farms_board_view` 1건
- Playwright prod: /farms-board 진입 → 매트릭스 60 농장 + KPI 5종 동일
- /farms (관리 페이지) 영향 0 회귀

### 4-3. 회원 측 회귀
- /m/login → /m/reservation → 평상 시설 fetch 정상
- /m/* Realtime 채널 (있다면) 401 0

---

## 5. 롤백

| PR | 방법 | 소요 |
|---|---|---|
| 1 Realtime 401 | git revert <c> | 2m + Vercel ~50s |
| 2 RPC (마이그 085) | `DROP FUNCTION get_farms_board()` + git revert | 5m |

---

## 6. 커밋 전략 (Q3=2)

### 분리 2 PR
1. `fix(realtime): 옵션 5 — localStorage 동기 토큰 + global.headers + realtime.params 3중 적용`
2. `feat(085): get_farms_board RPC + useFarmsBoard 훅 (4 round → 1)`

각각 prod 검증 후 다음 진입.

---

## 7. 잠재 리스크

| # | 항목 | 가능성 | 대응 |
|---|---|---|---|
| R1 | 옵션 5 도 효과 미발현 (5차 실패) | MID | 옵션 4 (debug + GitHub issue 등록) 즉시 진행 |
| R2 | sb-<ref>-auth-token storage key 변경 (supabase-js v3+) | LOW | 현재 v2.98, v3 출시 시 점검 |
| R3 | global.headers.Authorization 가 RLS 우회 | LOW | JWT decode 시 user_id 정확, RLS 정책 unchanged |
| R4 | useFarmsBoard 도입 후 매트릭스 회귀 | LOW | Playwright spec — 60 농장 확인 (이전 검증 통과) |
| R5 | farms_board_view audit 폭증 | LOW | 1h dedup 적용 |
| R6 | RPC 첫 호출 cold start latency | LOW | 60 행 query — < 50ms 기대 |

---

## 8. 8축 + 7점 종합

### PR 1 (Realtime 401)
모든 축 통과 (research §3 일치). 단 E (storage key 비공식 의존) 미세 risk.

### PR 2 (RPC)
모든 축 통과. DB SECURITY DEFINER + admin only + PIPA audit.

### 7점 (#1 #2 #5 #6) 모두 통과 — tsc/build 검증 필수.

---

## 9. kk 피드백 (kk 직접 메모)

> 2026-05-16 20:15 kk 답변: "권고대로 진행"

- **Q1 (Realtime 401 옵션)**: **5** (localStorage + global.headers + realtime.params 3중)
- **Q2 (RPC 적용)**: **2** (get_farms_board 분리)
- **Q3 (PR 분리)**: **2** (분리 2 PR — 롤백 정밀)
- **Q4 (옵션 5 실패 시 fallback)**: **4** (debug 모드 + GitHub issue 검색)
- **Q5 (audit dedup)**: 적용 (1h dedup)

✅ 승인 → PR 1 (Realtime 401) → PR 2 (마이그 085) 순차.

---

## 10. 참조

- 리서치: `thoughts/research/20260516-1930_realtime_401_deep_and_farms_rpc_research.md`
- Realtime 401 이전 3차 시도: thoughts/sessions/20260516-1900_handover.md
- 농장 보드 page: `app/dashboard/farms-board/page.tsx`
- 헬퍼: `supabase/migrations/078_admin_helper_and_anon_revoke.sql` (assert_admin_with_audit)
- 1h dedup 패턴: `supabase/migrations/079_bbq_board_audit_dedup.sql`
- RPC 패턴: `supabase/migrations/082_search_bbq_reservations.sql`
- Supabase 공식 [Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)
- Supabase 공식 [setAuth](https://supabase.com/docs/reference/javascript/realtime-setauth)
- GitHub [Realtime 401 #26932](https://github.com/orgs/supabase/discussions/26932)

---

## 11. END — kk Q1~Q5 답변 후 PR 1 → PR 2 순차 진입. 미승인 상태에서 구현 금지.
