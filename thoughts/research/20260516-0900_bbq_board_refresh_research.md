# 평상 예약 현황 — 자동갱신 메커니즘 검수 (2026-05-16)

> **목적**: 사용자 보고 "자동갱신 버튼 작동 안 함" 진단 + 현재 주기/업계 표준 비교 + 다른 기능 사이드 이펙트 검증
> **상태**: 사용자 (kk) 검토 대기 → plan.md (별도) 로 권고안 확정

---

## 0. 한 줄 요약

> 버튼 onClick(`refetch()`)는 **정상 동작**. 단 **시각 피드백 0** — 클릭 후 스피너 회전/disabled 없음 + lastFetched 가 즉시 "0초 전"으로 리셋되어 운영자가 "변화 없음 = 작동 안 함"으로 오인. 갱신 주기는 **Realtime 연결 시 5분 + Realtime 미연결 시 30s**로 업계 표준(10~30s) 부합. 권고: **버튼 UX 강화** + (선택) **카운트다운 표시**.

---

## 1. 현재 자동갱신 메커니즘 정밀 분석

### 1-1. 갱신 트리거 (4개)

| # | 트리거 | 주기/조건 | 코드 위치 |
|---|---|---|---|
| 1 | **Realtime postgres_changes** | `bbq_reservations` 테이블 INSERT/UPDATE/DELETE → debounce 500ms → fetch | `use-bbq-board.ts:152-170` |
| 2 | **폴링 (정상 시)** | Realtime SUBSCRIBED 후 **5분(300s)** 폴링 fallback | `use-bbq-board.ts:163-164` |
| 3 | **폴링 (Realtime 실패)** | CHANNEL_ERROR/TIMED_OUT 시 **30초** 폴링 | `use-bbq-board.ts:165-167` |
| 4 | **visibilitychange** | 탭 복귀(sleep/wake) 시 즉시 fetch | `use-bbq-board.ts:119-128` |
| 5 | **수동 버튼** | 우측 상단 ⟳ 클릭 → `refetch()` | `page.tsx:79` |

### 1-2. 폴링 안전장치

```ts
// use-bbq-board.ts:91-95
pollRef.current = setInterval(() => {
  if (pausedRef.current || !mountedRef.current) return;
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  fetchOnce();
}, intervalMs);
```

✓ pausedRef (사이드 패널 오픈 중)
✓ mountedRef (unmount 후 setState 방지)
✓ document.visibilityState (탭 비활성 시 폴링 일시 중지) — **모범 패턴**

### 1-3. 사용자 가시 표시

```tsx
// page.tsx:71-77
<span className={isStale ? 'text-amber-700 font-semibold' : 'text-text-tertiary'}>
  {isStale && '⚠ '}
  {Math.floor(staleSeconds)}초 전 자동 갱신
  {isRealtimeOk && <span className="text-emerald-600">● 실시간 연결됨</span>}
</span>
<button onClick={() => refetch()} aria-label="새로고침">
  <RefreshCw className="size-4" />
</button>
```

- `staleSeconds > 60` 시 ⚠ + amber 강조 (현재 캡쳐는 "0초 전" 정상)
- isRealtimeOk 상태가 `● 실시간 연결됨` 도트로 표시

---

## 2. "버튼이 작동 안 함" 원인 진단

### 2-1. 코드 동작 — 정상 ✓

`onClick={() => refetch()}` → `fetchOnce()` 호출 → RPC → setRows → setLastFetched(new Date()) → UI 갱신

### 2-2. 운영자 인지 — 4가지 문제

| # | 문제 | 영향 |
|---|---|---|
| **B1** | 클릭 시 **즉각 시각 피드백 0** — 버튼 자체 변화 없음 | "응답 없음" 인지 |
| **B2** | RefreshCw 아이콘 **회전 애니메이션 없음** (fetch 진행 중에도 정적) | 작동 여부 불명 |
| **B3** | **disabled 상태 없음** — 중복 클릭 가능, fetch race | 잠재 다중 fetch |
| **B4** | lastFetched 즉시 "0초 전" 리셋 → 클릭 전후 동일 표시 | "갱신 안 됨" 오인 |
| **B5** | fetch 실패 시 1s/2s/3s 백오프 retry → 최대 6s 무응답 | "응답 없음" 인지 |

### 2-3. Playwright dev 검증 결과

- 버튼 click → 200ms 내 supabase.rpc 호출 ✓
- network 응답 정상 (200 OK) ✓
- rows state 갱신 ✓
- lastFetched 갱신 → "0초 전" 즉시 변경 ✓
- **단 시각 차이 0** (이전에도 "0초 전")

**결론**: 코드는 정상, **UX 피드백 부족이 진짜 문제**.

---

## 3. 현재 주기 vs 업계 표준 비교

### 3-1. 업계 권고 (수집 자료 기준)

| 출처 | 권고 주기 | 적용 컨텍스트 |
|---|---|---|
| Site24x7 모니터링 | **10초** | 인시던트 관리, 자동화 |
| TanStack Query 공식 가이드 | **30초** | 일반 대시보드 (refetchInterval: 30_000) |
| Adaptive polling 전략 | 1s → 점진 2배 → 60s cap | 트래픽 적응형 |
| Hotel PMS 통합 (Cloudbeds/Mews) | 15~60s | 객실 상태 + 예약 |
| WebSocket + fallback polling | Realtime 우선 / 폴링 5분 | 모범 사례 |

### 3-2. pocolush 현재 vs 표준

| 항목 | pocolush | 업계 표준 | 평가 |
|---|---|---|---|
| Realtime 우선 | ✓ Supabase Realtime | ✓ WebSocket | **부합** |
| 폴링 fallback (Realtime 실패) | 30s | 30~60s | **부합** |
| 폴링 (Realtime 정상) | 300s (5분) | 60~300s | **부합** |
| 탭 비활성 폴링 정지 | ✓ visibilityState | ✓ refetchIntervalInBackground:false | **부합** |
| 탭 복귀 시 즉시 fetch | ✓ visibilitychange | ✓ refetchOnWindowFocus | **부합** |
| 사이드 패널 오픈 중 정지 | ✓ pausePolling | ✓ pause 패턴 | **부합** |
| Realtime 이벤트 debounce | ✓ 500ms | 권고 | **부합** |
| ETag/conditional GET | ✗ | 권고 | 미적용 (Supabase RPC 한계) |

**종합**: 갱신 메커니즘 자체는 업계 표준에 **잘 부합** — 주기 변경 권고 없음.

---

## 4. 권고 개선안 (3 단계)

### Phase 1 — 버튼 UX 강화 (라이브 영향 0)

**B1+B2+B3 해결**:
```tsx
const [isRefreshing, setIsRefreshing] = useState(false);
const handleRefresh = async () => {
  if (isRefreshing) return;  // 중복 차단
  setIsRefreshing(true);
  await refetch();
  // 시각 피드백 최소 600ms — 너무 빨라서 깜빡임 방지
  setTimeout(() => setIsRefreshing(false), 600);
};

<button
  onClick={handleRefresh}
  disabled={isRefreshing}
  aria-busy={isRefreshing}
  aria-label="새로고침"
  className="p-2 rounded-lg border border-border hover:bg-accent disabled:opacity-60"
>
  <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
</button>
```

**B4 해결** — lastFetched 문구 친화:
```tsx
const fmtAgo = (sec: number) => {
  if (sec < 5) return '방금 갱신';
  if (sec < 60) return `${Math.floor(sec)}초 전 갱신`;
  if (sec < 3600) return `${Math.floor(sec/60)}분 전 갱신`;
  return `${Math.floor(sec/3600)}시간 전 갱신`;
};
```

**B5 해결** — fetch 진행 중 표시:
```tsx
{loading && <span className="text-xs text-text-tertiary">갱신 중...</span>}
```

### Phase 2 — 카운트다운 표시 (옵션)

```tsx
// 다음 폴링까지 남은 시간 표시
const nextPollMs = isRealtimeOk ? 300000 : 30000;
const nextIn = nextPollMs - staleSeconds * 1000;
// "다음 갱신 4분 23초 후"
```

장점: 운영자 안심 (시스템 살아있음)
단점: 1초마다 re-render (성능 부담 micro)

### Phase 3 — 옵션 (사용자 결정, 영향 큼)

- 30s 폴링 단축 (예: 15s) — 비용/audit_logs 부담 ↑
- TanStack Query 도입 — over-engineering, 큰 리팩토링

---

## 5. 사이드 이펙트 검증

### 5-1. 영향 범위

| 항목 | 영향 |
|---|---|
| `useBBQBoard` 훅 사용처 | **/dashboard/bbq-board 1개 페이지만** (grep 검증 완료) |
| `get_bbq_board` RPC 부담 | 변경 없음 (Phase 1 권고는 UI만) |
| audit_logs (`bbq_board_read`) | 079 마이그 1h dedup 적용 — 폴링 30s × 운영자 1명 → dedup 후 1회/h. **영향 0** |
| Realtime 채널 (`bbq_board`) | 변경 없음 |
| TopBar Realtime (`notifications`) | 별개 채널, 영향 0 |
| 모바일 V2 (DashboardShell) | 영향 0 (page.tsx 내부만) |
| 사이드바 IA V2 | 영향 0 |

### 5-2. UI 자체 변경 risk

| 항목 | 권고 |
|---|---|
| 버튼 시각 피드백 (Phase 1) | ✅ 안전 (UI only) |
| disabled 동작 | ✅ 안전 (중복 차단만) |
| lastFetched 문구 친화 | ✅ 안전 (표시만 변경) |
| 카운트다운 (Phase 2) | ⚠ 1초마다 re-render — micro 비용 |

### 5-3. 폴링 주기 변경 시 (Phase 3 미권고)

만약 30s → 15s 단축한다면:
- audit_logs 일 30 → 일 ~60 (dedup 1h라 영향 적음)
- Realtime 채널 호출 빈도 증가 (서버 부담 micro)
- 데이터 신선도 ↑ (15s 안에 새 예약 반영)
- 클라이언트 트래픽 ↑ (배터리/네트워크 micro)
- **권고: 현재 30s 유지** — 업계 표준이고 운영자 1명 환경에 충분

---

## 6. ux-heuristics 진단

| Nielsen | 현 상태 | 점수 |
|---|---|---|
| #1 시스템 상태 가시성 | "0초 전 자동 갱신" 표시 ✓ / 버튼 클릭 시 응답 시각 부재 ✗ | 6/10 |
| #5 오류 방지 | 중복 클릭 방어 없음 | 7/10 |
| #7 효율성 | 키보드 단축키 없음 (선택) | 8/10 |
| #9 오류 복구 | 에러 카드 + "다시 시도" 버튼 ✓ | 9/10 |

**Krug Trunk Test**:
- "이 보드가 살아있나?" 운영자 직관 → 캡쳐의 "0초 전" + ⟳ 버튼 + (보이지 않는 경우) "● 실시간 연결됨" 으로 확인
- ⚠ "실시간 연결됨" 도트가 짧은 텍스트 안에 묻혀 발견성 낮음

---

## 7. 8축 / 7점 종합

| 축 | 결과 |
|---|---|
| A 보안 | 변경 없음 ✅ |
| B RLS | 변경 없음 ✅ |
| C UX | **개선 권고** ⚠ (B1~B5) |
| D 성능 | 현재 적정 ✅ |
| E 통합/회귀 | 영향 0 ✅ |
| F 데이터명 | 변경 없음 ✅ |
| G 사이드이펙트 | 영향 0 ✅ |
| H 배포안전 | UI only, 롤백 즉시 ✅ |

7점: #1/#2/#5/#6 변경 없음 ✅

---

## 8. 출처 (외부)

- [TanStack Query: Polling](https://tanstack.com/query/latest/docs/framework/react/guides/polling)
- [TanStack Query: Window Focus Refetching](https://tanstack.com/query/v4/docs/framework/react/guides/window-focus-refetching)
- [Site24x7: Polling Interval Factors](https://www.site24x7.com/solutions/how-to-choose-polling-interval.html)
- [Long Polling vs WebSockets — getstream.io](https://getstream.io/blog/long-polling-vs-websockets/)
- [Adaptive Polling Strategies — Zigpoll](https://www.zigpoll.com/content/how-can-i-implement-a-lightweight-fast-api-polling-solution-in-a-backend-service-to-optimize-realtime-data-updates)
- [Cloudbeds PMS Daily Operations](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/40771665486363-Your-Cloudbeds-PMS-Daily-Operations-Guide)
- 사내: thoughts/research/20260420-2200_v3.1_P0_P1_이슈_리서치.md (이전 D5 visibilitychange 권고)
- 사내: 079_bbq_board_read_dedup 마이그
