# 3 잔존 이슈 일괄 hotfix 플랜 v1

> **작성**: 2026-05-16 10:30
> **선행**: `thoughts/research/20260516-1000_three_residuals_research.md`
> **상태**: 🔴 **kk 승인 대기**
> **권고**: 3 이슈 모두 Quick Win 등급 → **단일 PR로 일괄 적용** 또는 개별 분리 (kk 선택)

---

## 0. 한 줄 요약

> 3 이슈 모두 라이브 영향 0 + Effort XS~S + 즉시 롤백 가능. 권고: **단일 hotfix PR**로 일괄 적용. 변경 3 파일 (`/dashboard/page.tsx`, `lib/supabase/client.ts`, `components/dashboard/StatsCards.tsx`). 예상 ~1.5h.

---

## 1. kk 결정 필요 (4건)

| Q | 항목 | 옵션 | 권고 |
|---|---|---|---|
| **Q1** | 이슈 1 (#418) 수정 방식 | (A) useState/useEffect / (B) suppressHydrationWarning / (C) 미적용 | **A** ⭐ |
| **Q2** | 이슈 2 (Realtime 401) supabase client 변경 | (A) accessToken 옵션 / (B) 미적용 (콘솔 노이즈만) / (C) supabase-js 업그레이드 | **A** ⭐ |
| **Q3** | 이슈 3 (nested Link) 수정 방식 | (A) 외부 Link 분리 / (B) 내부 button / (C) 미적용 | **A** ⭐ |
| **Q4** | 커밋 전략 | (1) 단일 커밋 / (2) 분리 3 커밋 | **2** ⭐ (롤백 정밀성) |

답변 형식: `Q1=A, Q2=A, Q3=A, Q4=2` 또는 **"권고대로"**.

---

## 2. 이슈 3 — Nested `<Link>` (가장 안전, 먼저)

### 2-1. 변경 파일: `components/dashboard/StatsCards.tsx` 라인 40-52

**Before**:
```tsx
<Link href="/dashboard/requests" className="bg-card border rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer">
  <div>...</div>
  <p>{s.pendingTotal}건</p>
  <div className="flex gap-2 mt-1 text-[11px]">
    {s.pendingBBQ > 0 && <Link href="...">BBQ {s.pendingBBQ}</Link>}
    ...
  </div>
</Link>
```

**After (안 A)**:
```tsx
<div className="bg-card border rounded-xl p-5 hover:shadow-md transition-shadow">
  <Link
    href="/dashboard/requests"
    className="block cursor-pointer"
  >
    <div className="flex items-start justify-between">
      <p className="text-xs font-medium text-muted-foreground">미처리 관리</p>
      <div className="size-8 rounded-lg bg-orange/10 flex items-center justify-center">
        <AlertCircle className="size-4 text-orange-500" />
      </div>
    </div>
    <p className="text-2xl font-bold tracking-tight mt-2">
      {s.pendingTotal}<span className="text-sm font-normal text-muted-foreground ml-1">건</span>
    </p>
  </Link>
  <div className="flex gap-2 mt-1 text-[11px]">
    {s.pendingBBQ > 0 && <Link href="/dashboard/requests?type=bbq&status=confirmed" className="text-red-600 hover:underline">BBQ {s.pendingBBQ}</Link>}
    {s.pendingOrders > 0 && <Link href="/dashboard/requests?type=order&status=pending" className="text-amber-600 hover:underline">스토어 {s.pendingOrders}</Link>}
    {s.pendingCoupons > 0 && <Link href="/dashboard/requests?type=coupon&status=pending" className="text-violet-600 hover:underline">쿠폰 {s.pendingCoupons}</Link>}
    {s.pendingTotal === 0 && <span className="text-muted-foreground">처리 완료</span>}
  </div>
</div>
```

- 외부 `<Link>` → `<div>` (HTML valid)
- 카드 헤더 + 본체 숫자 부분만 별도 `<Link>` (정확한 클릭 영역)
- 내부 chip 3개는 그대로 (semantic 유지)

### 2-2. 영향
- 시각: 동일 (hover/cursor 위치만 헤더로 이동)
- 접근성: HTML valid → 스크린리더 정확 해석
- 콘솔: error 2건 → **0건**

---

## 3. 이슈 1 — React #418 (`/dashboard/page.tsx`)

### 3-1. 변경 파일: `app/dashboard/page.tsx`

**Before**:
```tsx
'use client';
export default function DashboardPage() {
  const today = new Date();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  return (
    ...
    {today.getFullYear()}.{today.getMonth() + 1}.{today.getDate()} ({dayNames[today.getDay()]})
    ...
  );
}
```

**After (안 A — useState/useEffect)**:
```tsx
'use client';
import { useState, useEffect } from 'react';

export default function DashboardPage() {
  // SSR/hydration 자정 경계 mismatch 방지 — client 마운트 후만 표시
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const dateText = today
    ? `${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()} (${dayNames[today.getDay()]})`
    : '';  // 빈 표시 (한 번 깜빡임) — 자정 mismatch 보다 안전

  return (
    ...
    {dateText}
    ...
  );
}
```

또는 더 깔끔한 **안 B** (한 줄 fix):
```tsx
<span suppressHydrationWarning>
  {today.getFullYear()}.{today.getMonth() + 1}.{today.getDate()} ({dayNames[today.getDay()]})
</span>
```

**권고**: **안 A** (명시적). 첫 렌더 빈 표시는 50ms 이내 깜빡임 — 자정 경계 #418 보다 안전.

### 3-2. 영향
- React #418 0건
- 첫 렌더 시 날짜 빈 표시 ~50ms (대시보드 진입 후 즉시 표시)
- 다른 페이지 0
- 다른 11 위치 (#2~#11) 는 `new Date(string)` deterministic 이라 별도 수정 불필요

---

## 4. 이슈 2 — Realtime 401 (`lib/supabase/client.ts`)

### 4-1. 변경 파일: `lib/supabase/client.ts`

**Before**:
```ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return createBrowserClient('https://placeholder.supabase.co', 'placeholder-key');
  }

  return createBrowserClient(url, key);
}
```

**After (안 A)**:
```ts
import { createBrowserClient } from '@supabase/ssr';

let cached: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return createBrowserClient('https://placeholder.supabase.co', 'placeholder-key');
  }

  // singleton — 모든 hook 이 같은 client 사용 (Realtime connection 1회)
  cached = createBrowserClient(url, key, {
    realtime: {
      // 매 connection 직전 호출 — 첫 connection 부터 user token 사용
      accessToken: async () => {
        const { data: { session } } = await cached!.auth.getSession();
        return session?.access_token ?? null;
      },
    },
  });
  return cached;
}
```

⚠ **주의**:
1. **싱글톤 패턴**으로 모든 hook이 같은 client 공유 — 기존 코드는 매 호출 새 client 생성 (사실상 GC 안 됨). 싱글톤 명시적 적용.
2. `accessToken` 옵션 시그니처는 supabase-js v2.45+ 필요 → package.json 확인 후 적용

### 4-2. 영향 범위

| 위치 | 영향 |
|---|---|
| `lib/supabase/client.ts` | 직접 변경 |
| 모든 `createClient()` 호출처 (app/, components/) | 첫 connection user token 사용 |
| 회원 측 (/member/*) | 동일 client 사용 → 정상화 |
| RLS 정책 | 더 정확한 user_id 전달 (영향 0 — 이미 인증된 사용자만 호출) |
| audit_logs | 영향 0 (RPC 호출은 동일) |

### 4-3. 사이드 이펙트 검증 필요 (Phase 1 후 회귀)

- 회원 페이지 (member/page.tsx, member/reservation/*) Playwright 회귀
- 어드민 페이지 (dashboard/*) Playwright 회귀
- 모달 (회원 가입, 예약, 신청) 회귀

---

## 5. supabase-js 버전 확인

```bash
grep '"@supabase/' package.json
```

v2.45+ 인지 확인 후 진행. 구버전이면 accessToken 옵션 미지원 가능 → Q2=C (업그레이드) 옵션 고려.

---

## 6. 검증 계획

### 6-1. tsc / build
- `npx tsc --noEmit` 0 에러
- `npm run build` 0 에러

### 6-2. Playwright dev
- /dashboard 진입 → console.error 0
- /dashboard/bbq-board 5초 진입 → WebSocket socketerror 0
- StatsCards 카드 영역 클릭 → /dashboard/requests
- StatsCards 칩 클릭 → /dashboard/requests?type=bbq 등 (정확한 필터)

### 6-3. Playwright prod (배포 후)
- prod /dashboard 5초 → console.error 0
- prod /dashboard/bbq-board 5초 → socketerror 0 (현재 8건 → **0건 기대**)
- 회원 페이지 회귀 (자동 로그인 후 /member/reservation 진입)

---

## 7. 커밋 전략 (Q4)

### 권고 1: 분리 3 커밋
1. `fix(stats-cards): nested Link 풀기 (HTML valid + hydration)` — 안전
2. `fix(dashboard): 자정 경계 #418 hydration mismatch 방지` — 안전
3. `fix(supabase): client singleton + realtime accessToken 옵션` — 회원 측 영향 가능, 별도 검증

→ 이슈 3 (가장 안전) 먼저 배포, 이슈 1 다음, 이슈 2 마지막 (회귀 검증 시간 보장).

### 권고 2: 단일 PR
모든 변경을 한 번에 — 작업량 적지만 회귀 시 어느 이슈 원인인지 추적 어려움.

**권고**: **분리 3 커밋** (Q4=2) — 롤백 정밀성 + 점진 배포.

---

## 8. 작업량

| 단계 | 시간 |
|---|---|
| 이슈 3 (StatsCards) 수정 | 10m |
| 이슈 1 (/dashboard) 수정 | 15m |
| 이슈 2 (lib/supabase/client) 수정 + supabase-js 버전 확인 | 30m |
| tsc / build / Playwright dev (전체) | 30m |
| 커밋 3개 + push + 배포 검증 (각 50s) | 30m |
| 회원 측 회귀 Playwright | 30m |
| **합계** | **~2.5h** |

---

## 9. 잠재 리스크

| # | 항목 | 확률 | 대응 |
|---|---|---|---|
| R1 | supabase-js 가 v2.45 미만 → accessToken 옵션 미지원 | LOW | 버전 확인 후 결정 |
| R2 | client singleton 변경으로 인한 메모리 누수 (HMR) | LOW | useEffect cleanup 이미 OK |
| R3 | realtime accessToken async 함수 latency 추가 | LOW | session 캐시되어 ~1ms |
| R4 | 회원 측 Realtime 채널 회귀 | LOW | Playwright 회원 회귀 spec |
| R5 | StatsCards 시각 변경 회귀 | LOW | screenshot 비교 |

---

## 10. 8축 / 7점 종합

| 축 | 결과 |
|---|---|
| A 보안 | ✅ 인증 흐름 정상화 |
| B RLS | ✅ user_id 정확 전달 |
| C UX | ✅ 자정/콘솔/접근성 모두 ↑ |
| D 성능 | ✅ Realtime reconnect 8회 → 0 |
| E 통합/회귀 | ⚠ supabase client 전역 변경 — 회원 측 회귀 spec 필요 |
| F 데이터명 | ✅ 변경 없음 |
| G 사이드이펙트 | ✅ 분리 커밋으로 단계 점진 |
| H 배포안전 | ✅ 즉시 롤백 |

7점: #1 #2 #5 #6 모두 통과 (#6은 tsc/build 검증 후).

---

## 11. kk 피드백 (kk 직접 메모)

- **Q1 (#418 수정)**:
- **Q2 (Realtime 401)**:
- **Q3 (nested Link)**:
- **Q4 (커밋 전략)**:
- **추가 요구사항**:
- **반대/대안**:

---

## 12. 참조

- 리서치: `thoughts/research/20260516-1000_three_residuals_research.md`
- React #418: https://react.dev/errors/418
- Supabase Realtime accessToken: https://supabase.com/docs/reference/javascript/initializing
- HTML spec: a element content model

---

## 13. END — kk Q1~Q4 답변 후 `/implement three-residuals` 진입. 미승인 상태에서 구현 금지.
