# 평상 예약 현황 — 자동갱신 UX 강화 실행 플랜 v1

> **작성**: 2026-05-16 09:30
> **선행**: `thoughts/research/20260516-0900_bbq_board_refresh_research.md`
> **상태**: 🔴 **kk 승인 대기** (구현 금지)
> **권고**: research §4 의 **Phase 1 (버튼 UX 강화) 즉시 적용** + Phase 2/3 옵션 검토
> **변경 규모**: 코드 1 파일 (`app/dashboard/bbq-board/page.tsx`), DB 0, 라이브 영향 0

---

## 0. 한 줄 요약

> 자동갱신 코드는 정상이고 주기(Realtime + 5분/30s)는 업계 표준 부합. 사용자가 "작동 안 함"으로 오인한 원인은 **버튼 시각 피드백 0** + **lastFetched 즉시 리셋**. 권고: ⟳ 버튼 클릭 시 **회전 애니메이션 + disabled + "방금 갱신" 친화 문구**. 변경 1 파일, ~30분, 라이브 영향 0.

---

## 1. 진단 결과 (research §2 요약)

| 코드 | 동작 | 사용자 인지 |
|---|---|---|
| `onClick → refetch()` | ✅ 정상 (RPC 호출 + setRows) | "작동 안 함" |
| RefreshCw 아이콘 | 정적 (회전 X) | 시각 응답 부재 |
| lastFetched | 즉시 "0초 전" 리셋 | 클릭 전후 동일 |
| disabled 상태 | 없음 | 중복 클릭 가능 |
| 폴링 주기 | Realtime 5분 / 미연결 30s | 업계 표준 |

**진짜 문제**: UX 피드백 부족 — 코드는 정상.

---

## 2. kk 결정 필요 (2건)

| Q | 항목 | 옵션 | 권고 |
|---|---|---|---|
| **Q1** | Phase 1 적용 (버튼 UX 강화) | (A) 적용 / (B) 적용 안 함 | **A** ⭐ (즉시 안전) |
| **Q2** | Phase 2 카운트다운 추가 | (1) 적용 / (2) 미적용 / (3) "다음 갱신 X초 후" 텍스트만 | **2** ⭐ (현재 표시로 충분) |

**Phase 3** (폴링 주기 단축, TanStack Query 도입)은 **미권고** — 현재 업계 표준 부합 + over-engineering.

답변 형식: `Q1=A, Q2=2` 또는 "권고대로". §9 메모에 직접 기입.

---

## 3. Phase 1 — 버튼 UX 강화 (Q1=A 선택 시)

### 3-1. 변경 파일: `app/dashboard/bbq-board/page.tsx`

#### 변경 1: 새로고침 상태 + 핸들러
```tsx
// 추가 상태 (line 30 근처)
const [isRefreshing, setIsRefreshing] = useState(false);

// 새 핸들러 (line 51 근처)
const handleRefresh = async () => {
  if (isRefreshing) return;  // 중복 차단
  setIsRefreshing(true);
  try {
    await refetch();
  } finally {
    // 최소 600ms 시각 피드백 보장 (깜빡임 방지)
    setTimeout(() => setIsRefreshing(false), 600);
  }
};
```

#### 변경 2: lastFetched 친화 문구
```tsx
// 헬퍼 함수 (BoardClient 외부)
const formatAgo = (sec: number): string => {
  if (sec < 5) return '방금 갱신';
  if (sec < 60) return `${Math.floor(sec)}초 전 갱신`;
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전 갱신`;
  return `${Math.floor(sec / 3600)}시간 전 갱신`;
};

// 사용 (line 73)
{isStale && '⚠ '}{formatAgo(staleSeconds)}
```

#### 변경 3: 버튼 시각 피드백
```tsx
<button
  onClick={handleRefresh}
  disabled={isRefreshing}
  aria-busy={isRefreshing}
  aria-label={isRefreshing ? '갱신 중' : '새로고침'}
  className="p-2 rounded-lg border border-border hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
  data-testid="refresh-btn"
>
  <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
</button>
```

### 3-2. Tailwind animate-spin 확인
- Tailwind 4 기본 제공 ✓ (별도 설정 불필요)

### 3-3. 영향 분석 (1 파일, ~15 lines 변경)

| 항목 | 영향 |
|---|---|
| useBBQBoard 훅 | 0 (외부 동작 변경 없음) |
| Realtime 채널 | 0 |
| audit_logs / Supabase RPC | 0 (호출 빈도 동일) |
| 다른 페이지 | 0 (use-bbq-board는 이 페이지만 사용) |
| 모바일 V2 / 사이드바 IA V2 | 0 |
| E2E 기존 spec | 0 (data-testid="refresh-btn" 유지) |

---

## 4. Phase 2 — 카운트다운 (Q2 선택 시)

옵션 1: 실시간 카운트다운 (1초마다 re-render)
```tsx
const [now, setNow] = useState(Date.now());
useEffect(() => {
  const t = setInterval(() => setNow(Date.now()), 1000);
  return () => clearInterval(t);
}, []);
// "다음 갱신 4분 12초 후"
```

옵션 3: 정적 텍스트 (re-render 0)
```tsx
{isRealtimeOk
  ? <span>실시간 + 5분마다 갱신</span>
  : <span>30초마다 갱신</span>}
```

**권고**: Q2=2 (미적용) — 현재 표시 충분.

---

## 5. 검증 계획

### 5-1. tsc / build
- `npx tsc --noEmit` 0 에러
- `npm run build` 0 에러

### 5-2. Playwright dev
- 버튼 클릭 → `aria-busy="true"` + `animate-spin` 클래스 추가 확인
- 600ms 후 `aria-busy="false"` 복귀
- 중복 클릭 → 두 번째 클릭 무시 (disabled)
- `formatAgo(0.5)` → "방금 갱신"
- `formatAgo(45)` → "45초 전 갱신"
- `formatAgo(125)` → "2분 전 갱신"

### 5-3. Playwright prod (구현 후)
- 사이드바 [평상 예약 현황] 클릭
- ⟳ 버튼 클릭 → 회전 애니메이션 visible
- KPI/매트릭스 데이터 그대로 (현 운영 데이터 변경 0)

### 5-4. 시각 회귀
- `/tmp/board_before.png` (현재) vs `/tmp/board_after.png` (개선 후)
- 모바일 375 + 데스크탑 1280

---

## 6. 롤백

- `git revert <commit>` → 1분 + Vercel 빌드
- 영향: UI 강화만, 데이터 흐름 무관

---

## 7. 커밋

```
fix(bbq-board): 자동갱신 버튼 UX 강화 — 회전 애니메이션 + disabled + 친화 문구

배경
- 사용자 보고: "자동갱신 버튼 작동 안 함"
- 진단 (research §2): 코드 onClick → refetch() 정상,
  but 시각 피드백 0 → 운영자 "변화 없음 = 작동 안 함" 오인

변경 (app/dashboard/bbq-board/page.tsx)
- isRefreshing 로컬 state + handleRefresh 핸들러 (중복 차단)
- 버튼 클릭 시 RefreshCw animate-spin + disabled:opacity-60
- lastFetched 친화 문구 (formatAgo): "방금 갱신" / "N초/분/시간 전 갱신"
- aria-busy / aria-label 동적 갱신
- 최소 600ms 시각 피드백 보장 (깜빡임 방지)

폴링 주기 (변경 없음, 업계 표준 부합 확인)
- Realtime SUBSCRIBED: 5분 (300s) 폴링 + Realtime 이벤트 debounce 500ms
- Realtime 미연결: 30s 폴링 fallback
- 탭 비활성 폴링 정지 (visibilityState)
- 사이드 패널 오픈 중 정지 (pausePolling)

영향
- useBBQBoard 훅 미변경 (외부 동작 동일)
- audit_logs 부담 동일 (079 1h dedup 적용 중)
- 다른 페이지 0 (use-bbq-board는 이 페이지만 사용)

검증
- tsc 0 / build 0
- Playwright: 회전/disabled/문구 검증

근거
- thoughts/research/20260516-0900_bbq_board_refresh_research.md
- thoughts/plans/20260516-0930_bbq_board_refresh_plan.md
```

---

## 8. 작업량

| 항목 | 시간 |
|---|---|
| page.tsx 수정 (isRefreshing + handleRefresh + formatAgo + 버튼 클래스) | 15m |
| tsc / build / Playwright dev | 15m |
| 커밋 + push + prod 배포 검증 | 15m |
| **합계** | **~45m** |

---

## 9. kk 피드백 (kk 직접 메모)

- **Q1 (Phase 1 적용)**:
- **Q2 (Phase 2 카운트다운)**:
- **추가 요구사항**:
- **반대/대안**:

---

## 10. 참조

- 리서치: `thoughts/research/20260516-0900_bbq_board_refresh_research.md`
- 이전 적용: 079_bbq_board_read_dedup (audit 1h dedup)
- 이전 적용: D5 visibilitychange 핸들러 (use-bbq-board.ts:119-128)
- TanStack Query / SWR / Adaptive polling 공식 가이드

---

## 11. END — kk Q1/Q2 답변 후 `/implement bbq-board-refresh` 진입. 미승인 상태에서 구현 금지.
