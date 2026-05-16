# 3 잔존 이슈 깊은 검수 (2026-05-16)

> **목적**: 이번 세션 누적 발견된 3 잔존 이슈의 정확한 원인 + 영향 + 수정안 + 사이드 이펙트 분석
> **선행**: 사이드바 IA V2 / 평상 통합 / 자동갱신 UX (별개 plan)
> **스킬**: code-reviewer + senior-fullstack + ux-heuristics + refactoring-ui + Explore 다층 검수
> **상태**: 사용자 (kk) 검토 대기 → plan.md (별도) 로 권고안 확정

---

## 0. 한 줄 요약

> **이슈 1 (#418 hydration mismatch)**: `/dashboard/page.tsx:7` 의 client component `new Date()`가 SSR/hydration 시점 차이로 mismatch. 12 위치 후보 중 최강 의심 1건 + 부차 11건.
> **이슈 2 (Realtime 401)**: 코드 setAuth 적용 완료, 단 `createBrowserClient` 초기화 시 anon token으로 첫 connection → 첫 8건 401 race. 해결: realtime accessToken 옵션 전달.
> **이슈 3 (Nested Link)**: `StatsCards.tsx:40-52` 외부 `<Link>` 내부에 `<Link>` 3개 중첩 — 명확한 HTML 위반. 외부 Link → 카드 헤더만 감싸기 또는 내부 chip을 button으로.

---

## 이슈 1 — React #418 Hydration Mismatch

### 1-1. 위치 (Explore 결과, 12건)

| # | 파일:라인 | 코드 | 위험도 |
|---|---|---|---|
| **1** ⭐ | `app/dashboard/page.tsx:7` | `const today = new Date();` | **HIGH** |
| 2 | `app/dashboard/coupons/page.tsx:118,120` | `new Date(c.valid_until) < new Date()` | MID |
| 3 | `app/dashboard/settings/page.tsx:147` | `new Date(s.created_at).toLocaleDateString('ko-KR')` | LOW |
| 4 | `app/dashboard/notices/page.tsx:386` | 동일 패턴 | LOW |
| 5 | `app/dashboard/members/page.tsx:246` | 동일 패턴 | LOW |
| 6 | `components/dashboard/DashboardList.tsx:52` | `const today = new Date().toISOString()` | MID |
| 7 | `components/dashboard/ExpiringRentals.tsx:30` | `differenceInDays(new Date(r.end_date), new Date())` | MID |
| 8 | `components/dashboard/StatsCards.tsx:70` | `s.monthlyRevenue.toLocaleString()` | LOW |
| 9 | `components/layout/TopBar.tsx:155` | `format(new Date(notif.created_at), 'M월 d일 HH:mm', { locale: ko })` | LOW |
| 10 | `components/admin-bbq/BbqEventModal.tsx:19` | `const today = new Date().toISOString().slice(0,10)` | LOW (modal client only) |
| 11 | `components/admin-bbq/ProductsSection.tsx:71` | 동일 | LOW (modal client only) |

### 1-2. 주범 확정: `/dashboard/page.tsx`

```tsx
'use client';
// ...
export default function DashboardPage() {
  const today = new Date();                       // line 7
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  // ...
  {today.getFullYear()}.{today.getMonth() + 1}.{today.getDate()} ({dayNames[today.getDay()]})
}
```

**원리**:
- `'use client'` 명시지만 Next.js 16 App Router는 client component도 **server에서 한 번 SSR 후 hydration**
- SSR 시점 `new Date()` (UTC server time) vs hydration 시점 `new Date()` (KST client time)
- **자정 경계**에서 SSR=어제 / hydration=오늘 — 날짜 문자열 mismatch → React #418
- 평소엔 ms 단위 차이라 무증상이지만 자정 ±2초 사이 새로고침/방문 시 발현

### 1-3. 수정 옵션

| 옵션 | 코드 | 영향 |
|---|---|---|
| **A** ⭐ | `const [today, setToday] = useState<Date \| null>(null); useEffect(()=>setToday(new Date()), [])` | 안전, 첫 렌더 빈 표시 |
| B | `<span suppressHydrationWarning>{today.getFullYear()}...</span>` | 1줄, hydration 경고만 억제 (값은 client 사용) |
| C | server component로 변경 + KST 명시 | 큰 리팩토링 |

**권고**: **옵션 A** — 명시적 client only, refactoring-ui §정보 밀도 만족.

다른 위치 (#2~#11): 캐스팅 `new Date(string)`은 deterministic이라 #418 위험 낮음. **수정 안 함** (조사만).

---

## 이슈 2 — Realtime WebSocket 401

### 2-1. 적용 상태

| 채널 | setAuth 적용 | 결과 |
|---|---|---|
| `bbq_board` (use-bbq-board.ts:142) | ✓ | 정상 |
| `notifications` (TopBar.tsx:52) | ✓ | 정상 (5361889 커밋) |
| 다른 채널 | **없음** (grep 검증) | - |

코드는 정확. **그런데 prod 검증 시 여전히 8건 401 발생**.

### 2-2. 원인 후보 (supabase-js 라이브러리 동작)

```ts
// lib/supabase/client.ts
return createBrowserClient(url, key);  // anon key 만 전달
```

`createBrowserClient` 호출 시:
1. WebSocket connection 초기화 — anon key 사용
2. 첫 channel 구독 시점에 setAuth 호출 → 새 token 전달
3. **그러나 connection 자체는 이미 anon으로 열려서 401 시도 발생**
4. setAuth 후 다음 connection은 정상

**증거**: prod E2E 5초 동안 401 8건 — `socketerror: HTTP Authentication failed` — 8회 reconnect 시도. setAuth 후 안정화 추정.

### 2-3. 해결 옵션

**옵션 A** — accessToken 옵션 (supabase-js v2.45+ 권고):
```ts
// lib/supabase/client.ts
export function createClient() {
  return createBrowserClient(url, key, {
    realtime: {
      // 매 connection 직전 호출 — 항상 최신 토큰
      accessToken: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token ?? null;
      },
    },
  });
}
```
→ 첫 connection부터 user token 사용 → 401 0건

**옵션 B** — 채널 구독 전 명시 `await` 직렬화:
이미 use-bbq-board / TopBar에 적용. 그러나 supabase-js 내부 reconnect는 별도 라이프사이클이라 한계.

**옵션 C** — supabase-js 업그레이드 (현재 버전 확인 필요)

**권고**: **옵션 A** — createBrowserClient 초기화 단계에서 accessToken 함수 전달.

### 2-4. 영향 범위

- `lib/supabase/client.ts` 단일 수정
- 모든 client 호출 (browser side) 영향 — 전역 변경
- 첫 connection부터 user token 사용 → audit_logs 인증 흐름 OK
- 회원 측 (/member/*) 도 동일 client 사용 → 회원 Realtime 채널 (BbqGrid 등)도 영향

⚠ **회원 측 영향**: 회원 페이지의 모든 supabase fetch / channel 도 user token 으로 동작 — RLS 인증 흐름 정상화. 회귀 가능성 낮음 (anon key fallback도 같이 보유).

---

## 이슈 3 — Nested `<Link>` in StatsCards

### 3-1. 위치 인용

`components/dashboard/StatsCards.tsx:40-52`

```tsx
{/* 미처리 관리 */}
<Link href="/dashboard/requests" className="bg-card border rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer">
  <div className="flex items-start justify-between">
    <p className="text-xs font-medium text-muted-foreground">미처리 관리</p>
    <div className="size-8 rounded-lg bg-orange/10 flex items-center justify-center"><AlertCircle className="size-4 text-orange-500" /></div>
  </div>
  <p className="text-2xl font-bold tracking-tight mt-2">{s.pendingTotal}<span ...>건</span></p>
  <div className="flex gap-2 mt-1 text-[11px]">
    {s.pendingBBQ > 0 && <Link href="/dashboard/requests?type=bbq&status=confirmed" ...>BBQ {s.pendingBBQ}</Link>}
    {s.pendingOrders > 0 && <Link href="/dashboard/requests?type=order&status=pending" ...>스토어 {s.pendingOrders}</Link>}
    {s.pendingCoupons > 0 && <Link href="/dashboard/requests?type=coupon&status=pending" ...>쿠폰 {s.pendingCoupons}</Link>}
  </div>
</Link>
```

### 3-2. 문제

- HTML5 spec: `<a>` 안에 `<a>` 금지 — **invalid HTML**
- React 렌더링 시 `<a><a></a></a>` → 브라우저 자동 fix-up: 외부 `<a>` 가 첫 inner `<a>` 직전에 닫힘 → DOM 구조 변경 → hydration mismatch
- 매 dashboard 진입마다 console.error 2건 (이전 E2E 검증)

### 3-3. 해결 옵션

**옵션 A** ⭐ — 카드 헤더만 `<Link>`로 감싸기, 내부 chips 별도:
```tsx
<div className="bg-card border rounded-xl p-5 hover:shadow-md transition-shadow">
  <Link href="/dashboard/requests" className="block cursor-pointer">
    <div className="flex items-start justify-between">
      <p>미처리 관리</p>
      <div><AlertCircle /></div>
    </div>
    <p>{s.pendingTotal}<span>건</span></p>
  </Link>
  <div className="flex gap-2 mt-1 text-[11px]">
    {s.pendingBBQ > 0 && <Link href="...">BBQ {s.pendingBBQ}</Link>}
    {s.pendingOrders > 0 && <Link href="...">스토어 {s.pendingOrders}</Link>}
    {s.pendingCoupons > 0 && <Link href="...">쿠폰 {s.pendingCoupons}</Link>}
  </div>
</div>
```

**옵션 B** — 내부 chips를 `<button onClick={() => router.push(...)}>` 으로:
- semantic 이슈 (link role 손실)
- 우클릭 "새 탭에서 열기" 동작 안 됨

**옵션 C** — 외부 Link 제거, 카드 본문 클릭 시 router.push:
- 키보드 접근성 손실
- accessibility 회귀

**권고**: **옵션 A** — 카드 본체 클릭(상위 영역) + 내부 chip 클릭(상세 필터 링크) 둘 다 정상 작동, semantic 유지.

### 3-4. 영향 범위

- 단일 파일 (StatsCards.tsx)
- 시각 변경 없음 (CSS hover 영향은 외부 Link → 카드 본체 헤더 영역만)
- 접근성 ↑ (HTML valid)

---

## 8축 종합

| 축 | 이슈 1 (#418) | 이슈 2 (Realtime) | 이슈 3 (nested) |
|---|---|---|---|
| A 보안 | 영향 0 | 인증 흐름 정상화 ✅ | 영향 0 |
| B RLS | 영향 0 | RLS 정확한 user_id 전달 ✅ | 영향 0 |
| C UX | 자정 mismatch 1회 | 콘솔 노이즈 8건/진입 | console.error 2건 |
| D 성능 | 영향 0 | reconnect 8회 → 0 | 영향 0 |
| E 통합/회귀 | 1 파일 | 전역 client (회원 측 포함) ⚠ | 1 파일 |
| F 데이터명 | 영향 0 | 영향 0 | 영향 0 |
| G 사이드이펙트 | 0 | 회원 측 supabase 호출 전부 검증 필요 | 0 |
| H 배포안전 | 즉시 롤백 | git revert + 빌드 | 즉시 롤백 |

## 7점 체크

| # | 결과 |
|---|---|
| #1 인증/권한 | 이슈 2 — 정상화 ✅ |
| #2 비정상 경로 | 이슈 1 — 자정 mismatch 정상 fallback |
| #5 비밀정보 | 변경 없음 |
| #6 런타임 | tsc/build 통과 필수 |

## 검수 결론

| 이슈 | 위험 | Effort | RICE |
|---|---|---|---|
| **3 nested Link** | 가장 낮음 (UX 무관) | XS (1 파일, 10분) | **8.0** ⭐ |
| **1 #418** | LOW (1회/자정) | S (1 파일, 30분) | **5.0** |
| **2 Realtime 401** | MID (콘솔 노이즈, 비용 micro) | S (1 파일 + 회원 측 회귀 검증, 1h) | **4.0** |

전부 **Quick Win 등급** — 모두 즉시 안전 hotfix 적용 가능.

---

## 출처

- React #418 docs: https://react.dev/errors/418
- Supabase Realtime accessToken option: https://supabase.com/docs/reference/javascript/initializing
- HTML spec: nested anchor (`<a>` not allowed as descendant of `<a>`)
- Explore 에이전트 grep 결과 (2026-05-16)
- 사내: thoughts/sessions/20260515-2200_handover.md (Realtime 401 잠재 위험 #1)
