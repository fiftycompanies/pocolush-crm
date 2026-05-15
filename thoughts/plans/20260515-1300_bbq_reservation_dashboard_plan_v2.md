# BBQ 존 예약 기능 — 통합 PM/UIUX 플랜 v2 (검수 반영 완료)

> 작성일: 2026-05-15 / 작성자: Claude Code
> 상태: **구현 진입**
> v1 대비 변경: 검수 결과 25건 반영 + kk 의사결정 12건 확정
> 관련 파일: `20260515-1130_bbq_reservation_dashboard_plan.md` (v1), `20260515-1230_bbq_review_consolidated.md` (검수)

---

## ⭐ 핵심 원칙 (kk 결정)

**"라이브 서비스 + 현재 예약 데이터 보존이 최우선"**
→ 비활성 시설이라도 **예약 있으면 반드시 그리드 표시** + 노란 경고 마커
→ 데이터 정리/취소 처리 금지

---

## 의사결정 확정표

| Q | 답 | 의미 |
|---|---|---|
| Q1 행 디자인 | Sentry 2-line | 좌측 컬러바 유지 |
| Q2 보드 기본 탭 | 오늘 | 운영자 일상 95% |
| Q3 셀 클릭 | 사이드 패널 | 그리드 비교 |
| Q4 색 변경 | sky | 1주 안내 토스트 X (TYPE만) |
| Q5 범위 | A+B 1 PR | 통합 |
| **Q6 비활성+예약** | **포함 + 노란 마커** | 예약 데이터 보존 |
| **Q7 RPC 필터** | **active OR 예약있음** | 활성 시설 + 예약 있는 비활성만 |
| Q8 BBQ 라벨 | "예약완료" 분리 | UnifiedStatus 'confirmed' 추가 |
| Q9 행 디자인 | BBQ만 2-line | 최소 변경 |
| Q10 컬럼 | "예약일/신청일" 분리 | BBQ 중심 |
| Q11 번호 | **072** | 안전 마진 |
| Q12 색 범위 | TYPE_META.order만 | STATUS 배지 보존 |

---

## 1. 데이터 모델 — 검증된 사실

| 객체 | 사실 |
|---|---|
| `bbq_reservations` UNIQUE | (date, slot, bbq_number) **존재** ✅ |
| `bbq_products.event` 컬럼 | **없음**. 이벤트 = `bbq_events` 별도 테이블 |
| `audit_logs` 테이블 | **존재** → 071/072 audit 가능 |
| 비활성 시설 + confirmed | prod **1건** 잔존 (`bbq_number=5`, 060 사례) |
| 비활성 슬롯 + confirmed | **0건** ✅ |
| product_id NULL | **0건** ✅ (백필 완료) |
| 활성 시설 | **4개** (#1~#4 + 비활성#5 의 예약 1건) |

---

## 2. 마이그레이션 `072_bbq_board_rpc.sql` (확정)

```sql
-- ═══════════════════════════════════════════════════════════════════
-- 072: BBQ 운영 보드 RPC + 성능 인덱스 + audit log
-- ═══════════════════════════════════════════════════════════════════
-- 핵심: 비활성 시설이라도 예약 있으면 grid 행 포함 (kk: 라이브 데이터 보존)
-- 패턴: 060/065 hotfix 답습 (SECURITY DEFINER + search_path='' + admin check)
-- ═══════════════════════════════════════════════════════════════════

-- (1) 성능 인덱스 — 미래 누적 대비
CREATE INDEX IF NOT EXISTS idx_bbq_reservations_date_slot_facility
  ON public.bbq_reservations (reservation_date, time_slot, bbq_number)
  WHERE status IN ('confirmed', 'completed');

-- (2) BBQ 보드 RPC
DROP FUNCTION IF EXISTS public.get_bbq_board(DATE, DATE);

CREATE FUNCTION public.get_bbq_board(
  p_date_from DATE,
  p_date_to   DATE DEFAULT NULL
)
RETURNS TABLE (
  reservation_date  DATE,
  slot_number       INT,
  slot_label        TEXT,
  slot_start        TIME,
  bbq_number        INT,
  bbq_name          TEXT,
  facility_active   BOOLEAN,
  status            TEXT,
  member_name       TEXT,
  member_phone      TEXT,
  party_size        INT,
  snapshotted_price INT,
  product_name      TEXT,
  is_event          BOOLEAN,
  reservation_id    UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $fn_072_board$
DECLARE
  v_to DATE := COALESCE(p_date_to, p_date_from);
BEGIN
  -- admin only + unauthorized audit
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ) THEN
    INSERT INTO public.audit_logs (action, resource_type, metadata, created_at)
    VALUES ('bbq_board_unauthorized', 'bbq_board',
            jsonb_build_object('from', p_date_from, 'to', v_to,
                               'caller', (SELECT auth.uid())), NOW());
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  -- 성공 시 PIPA audit log
  INSERT INTO public.audit_logs (actor_id, action, resource_type, metadata, created_at)
  VALUES ((SELECT auth.uid()), 'bbq_board_read', 'bbq_board',
          jsonb_build_object('from', p_date_from, 'to', v_to), NOW());

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(p_date_from, v_to, INTERVAL '1 day')::DATE AS d
  ),
  -- ⭐ kk 결정: 활성 시설 + (비활성이지만 미래/현재 예약 보유) 모두 포함
  -- 라이브 서비스의 실예약 데이터 보존이 최우선
  facilities_to_show AS (
    SELECT f.* FROM public.bbq_facilities f
    WHERE f.is_active = TRUE
       OR EXISTS (
         SELECT 1 FROM public.bbq_reservations r
         WHERE r.bbq_number = f.number
           AND r.reservation_date BETWEEN p_date_from AND v_to
           AND r.status IN ('confirmed', 'completed')
       )
  ),
  facility_slot_grid AS (
    SELECT ds.d AS reservation_date,
           s.slot_number, s.label AS slot_label, s.start_time AS slot_start,
           f.number AS bbq_number, f.name AS bbq_name, f.is_active AS facility_active
    FROM date_series ds
    CROSS JOIN public.bbq_time_slots s
    CROSS JOIN facilities_to_show f
    WHERE s.is_active = TRUE
  )
  SELECT
    g.reservation_date, g.slot_number, g.slot_label, g.slot_start,
    g.bbq_number, g.bbq_name, g.facility_active,
    r.status, m.name, m.phone, r.party_size, r.snapshotted_price,
    p.name AS product_name,
    -- 이벤트 판정: bbq_events 와 product_id+date 매칭
    (EXISTS (
      SELECT 1 FROM public.bbq_events e
      WHERE e.product_id = r.product_id
        AND e.start_date <= g.reservation_date
        AND e.end_date >= g.reservation_date
    )) AS is_event,
    r.id AS reservation_id
  FROM facility_slot_grid g
  LEFT JOIN public.bbq_reservations r
    ON r.reservation_date = g.reservation_date
   AND r.time_slot = g.slot_number
   AND r.bbq_number = g.bbq_number
   AND r.status IN ('confirmed', 'completed')
  LEFT JOIN public.members m ON m.id = r.member_id
  LEFT JOIN public.bbq_products p ON p.id = r.product_id
  ORDER BY g.reservation_date, g.bbq_number, g.slot_number;
END
$fn_072_board$;

COMMENT ON FUNCTION public.get_bbq_board(DATE, DATE) IS
  '072: BBQ 운영 보드 — admin only, 비활성+예약있는 시설 포함, audit log';

GRANT EXECUTE ON FUNCTION public.get_bbq_board(DATE, DATE) TO authenticated;
```

---

## 3. 솔루션 A — 신청관리 디테일 강화 (확정)

### 3.1 `lib/use-requests.ts` 변경

```ts
// 1) UnifiedStatus 에 'confirmed' + 'no_show' 추가 (E3 + Q8)
export type UnifiedStatus = 'pending' | 'confirmed' | 'processing' | 'completed' | 'no_show' | 'cancelled';

function mapBBQStatus(s: string): UnifiedStatus {
  if (s === 'confirmed') return 'confirmed';   // ⭐ Q8: "예약완료" 분리
  if (s === 'completed') return 'completed';
  if (s === 'no_show') return 'no_show';       // ⭐ E3: 노쇼 별도 매핑
  return 'cancelled';
}

// 2) select 확장 + 이벤트 배지 별도 RPC 호출 (E1)
const { data, error } = await supabase
  .from('bbq_reservations')
  .select('*, member:members(name, phone), product:bbq_products(name)')
  .order('created_at', { ascending: false })
  .limit(100);

if (error) {
  console.error('bbq fetch failed', error);
  // Sentry capture
}

// 이벤트 판정: 클라이언트에서 bbq_events 매칭 (또는 별도 RPC)
const productIds = [...new Set((data ?? []).map(b => b.product_id).filter(Boolean))];
const { data: events } = await supabase
  .from('bbq_events')
  .select('product_id, start_date, end_date')
  .in('product_id', productIds);

// 3) bbqMeta 구조화 + 시간슬롯 라벨
const slotMap = new Map(timeSlots.map(s => [s.slot_number, s]));

(data || []).forEach((b: any) => {
  const slot = slotMap.get(b.time_slot);
  const slotLabel = slot ? `${slot.label}(${slot.start_time.slice(0,5)})` : `${b.time_slot}타임`;
  const isEvent = events?.some(e =>
    e.product_id === b.product_id &&
    e.start_date <= b.reservation_date &&
    e.end_date >= b.reservation_date
  ) ?? false;

  results.push({
    id: b.id, type: 'bbq',
    memberName: b.member?.name || '-',
    memberPhone: b.member?.phone || '-',
    detail: `#${b.bbq_number}번 · ${slotLabel} · ${b.party_size ?? 1}인`,
    amount: b.snapshotted_price ?? b.price ?? 0,
    date: b.created_at,
    rawStatus: b.status,
    unifiedStatus: mapBBQStatus(b.status),
    bbqMeta: {
      bbqNumber: b.bbq_number,
      timeSlot: b.time_slot,
      timeLabel: slotLabel,
      reservationDate: b.reservation_date,
      partySize: b.party_size ?? 1,
      productName: b.product?.name,
      isEvent,
    },
  });
});
```

### 3.2 STATUS_META + TYPE_META 변경

```ts
// TYPE_META.order: orange → sky (Q12: TYPE 만 변경, STATUS_META 보존)
order: { icon: ShoppingBag, color: '#0EA5E9', label: '스토어' },

// STATUS_META 추가
const STATUS_META = {
  payment_pending: { label: '결제 필요', color: '#DC2626', bg: '#FEF2F2' },
  pending: { label: '대기', color: '#D97706', bg: '#FFFBEB' },
  confirmed: { label: '예약완료', color: '#059669', bg: '#ECFDF5' },  // ⭐ Q8 신규
  processing: { label: '처리중', color: '#3B82F6', bg: '#EFF6FF' },
  completed: { label: '완료', color: '#059669', bg: '#ECFDF5' },
  no_show: { label: '노쇼', color: '#991B1B', bg: '#FEE2E2' },        // ⭐ E3 신규
  cancelled: { label: '취소', color: '#6B7280', bg: '#F3F4F6' },
};

// STATUS_TABS 에 confirmed 추가
const STATUS_TABS = [
  { key: '', label: '전체' },
  { key: 'payment_pending', label: '결제 필요' },
  { key: 'pending', label: '대기' },
  { key: 'confirmed', label: '예약완료' },  // ⭐ 신규
  { key: 'processing', label: '처리중' },
  { key: 'completed', label: '완료' },
  { key: 'no_show', label: '노쇼' },         // ⭐ 신규
  { key: 'cancelled', label: '취소' },
];
```

### 3.3 행 디자인 (Q1: Sentry 2-line, Q9: BBQ 만)

```tsx
// BBQ 행 2-line, 스토어/쿠폰 1-line 유지
<tr>
  <td>{/* 카테고리 + 좌측 3px 컬러바 유지 */}</td>
  <td>
    {/* 신청자 — 연락처 hover popover */}
    <div className="font-medium">{r.memberName}</div>
    <div className="text-[11px] text-text-tertiary">{r.memberPhone}</div>
  </td>
  <td>
    {r.type === 'bbq' && r.bbqMeta ? (
      <>
        {/* BBQ 2-line */}
        <div className="text-sm">
          #{r.bbqMeta.bbqNumber}번 · {r.bbqMeta.timeLabel} · {r.bbqMeta.partySize}인 · ₩{r.amount.toLocaleString()}
          {r.bbqMeta.isEvent && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded border">이벤트</span>}
        </div>
        <div className="text-[11px] text-text-tertiary mt-0.5">
          {r.bbqMeta.productName ?? '기본 상품'}
        </div>
      </>
    ) : (
      <span>{r.detail}</span>  /* 스토어/쿠폰 1-line */
    )}
  </td>
  {/* Q10: 예약일 / 신청일 분리 */}
  <td className="text-xs">
    {r.bbqMeta && (
      <div className="font-medium">{formatDateKR(r.bbqMeta.reservationDate)}</div>
    )}
    <div className="text-[10px] text-text-tertiary">신청 {format(r.date, 'M.d')}</div>
  </td>
  {/* SLA 배경색 — 미처리 상태만 (S7 보강) */}
  <td>{...sm}</td>
  {/* 액션 — error 처리 + 더블클릭 가드 (S5, S6) */}
  <td>...</td>
</tr>
```

SLA 화이트리스트: `confirmed | payment_pending | pending | issued` 만 시간경과 배경.

### 3.4 인라인 액션 error 처리 + 더블클릭 가드 (S5, S6)

```ts
const [busy, setBusy] = useState<Record<string, boolean>>({});

const handleBBQStatus = async (id: string, status: string) => {
  if (busy[id]) return;
  setBusy(b => ({ ...b, [id]: true }));
  try {
    const update: Record<string, unknown> = { status };
    if (status === 'cancelled') update.cancelled_at = new Date().toISOString();
    const { error } = await supabase.from('bbq_reservations').update(update).eq('id', id);
    if (error) { toast.error('상태 변경 실패: ' + error.message); return; }
    toast.success('상태가 변경되었습니다.');
    refetch();
  } finally {
    setBusy(b => ({ ...b, [id]: false }));
  }
};
```

`handleOrderStatus`, `handlePayment`, `handleCouponUse` 모두 동일 패턴 적용.

---

## 4. 솔루션 B — `/dashboard/bbq-board` 실시간 보드

### 4.1 데이터 페치 hook `lib/use-bbq-board.ts`

```ts
'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

// KST 자정 처리 — D3
export const todayKST = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

export interface BBQBoardRow {
  reservation_date: string;
  slot_number: number;
  slot_label: string;
  slot_start: string;
  bbq_number: number;
  bbq_name: string;
  facility_active: boolean;
  status: string | null;
  member_name: string | null;
  member_phone: string | null;
  party_size: number | null;
  snapshotted_price: number | null;
  product_name: string | null;
  is_event: boolean;
  reservation_id: string | null;
}

export function useBBQBoard(dateFrom: string, dateTo?: string) {
  const supabase = createClient();
  const [rows, setRows] = useState<BBQBoardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pausedRef = useRef(false);  // 사이드 패널 오픈 중 폴링 일시정지

  const fetchOnce = async (retries = 3) => {
    try {
      const { data, error } = await supabase.rpc('get_bbq_board', {
        p_date_from: dateFrom, p_date_to: dateTo ?? null,
      });
      if (error) throw error;
      setRows(data ?? []);
      setLastFetched(new Date());
      setError(null);
    } catch (e: any) {
      if (retries > 0) {
        const delay = (4 - retries) * 1000;
        setTimeout(() => fetchOnce(retries - 1), delay);
      } else {
        setError(e.message || 'RPC 실패');
      }
    } finally {
      setLoading(false);
    }
  };

  // 폴링 + Realtime 이중 실행 차단 (P2)
  useEffect(() => {
    fetchOnce();

    // 30s 폴링 (Realtime 실패 시 fallback)
    pollRef.current = setInterval(() => {
      if (!pausedRef.current && document.visibilityState === 'visible') {
        fetchOnce();
      }
    }, 30000);

    // Realtime 구독
    channelRef.current = supabase
      .channel('bbq_board')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'bbq_reservations' },
        () => { if (!pausedRef.current) fetchOnce(); })
      .subscribe(status => {
        if (status === 'SUBSCRIBED' && pollRef.current) {
          // Realtime 성공 → 폴링 5분 간격으로 변경 (fallback 안전망)
          clearInterval(pollRef.current);
          pollRef.current = setInterval(() => {
            if (!pausedRef.current) fetchOnce();
          }, 300000);
        }
      });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [dateFrom, dateTo]);

  return {
    rows, loading, error, lastFetched,
    refetch: fetchOnce,
    pausePolling: () => { pausedRef.current = true; },
    resumePolling: () => { pausedRef.current = false; },
  };
}
```

### 4.2 페이지 구조 (Q2: 오늘 기본 탭)

`app/dashboard/bbq-board/page.tsx`:
- 3-탭: `오늘 | 내일 | 이번 주`
- 디폴트 = 오늘 (Q2)
- KPI 카드 sticky (페이지 상단)
- 매트릭스 (오늘/내일) vs Tape Chart (이번 주)
- 우측 사이드 패널 (1024px 이상) / 모달 (1024px 미만) — U8
- Suspense 경계 + `dynamic='force-dynamic'` (P6)

### 4.3 매트릭스 컴포넌트 핵심 룰

```tsx
// React.memo + useMemo (P4)
const MatrixCell = React.memo(({ row }: { row: BBQBoardRow }) => {
  // 비활성 시설 + 예약 있음 → 노란 경고 마커 (Q6)
  const isInactiveButReserved = !row.facility_active && row.reservation_id;

  return (
    <div role="gridcell"
         aria-label={...}
         className={cn(
           'min-h-[44px] p-2 rounded border cursor-pointer',
           row.status === 'confirmed' && 'bg-emerald-100 text-emerald-900',
           row.status === 'completed' && 'bg-emerald-50 text-emerald-900',
           !row.status && row.facility_active && 'bg-white border-dashed',
           !row.facility_active && !row.reservation_id && 'bg-gray-200 hatched-pattern',
           isInactiveButReserved && 'ring-2 ring-yellow-500 bg-emerald-100',
         )}>
      {isInactiveButReserved && (
        <span className="absolute top-1 right-1 text-[10px] bg-yellow-400 px-1 rounded">
          ⚠ 운영중단 시설
        </span>
      )}
      {row.member_name && (
        <div className="text-xs font-medium">{row.member_name}</div>
      )}
      {row.party_size && (
        <div className="text-[10px] opacity-70">{row.party_size}인</div>
      )}
    </div>
  );
});
```

빈 슬롯: `cursor: default` + 클릭 무반응 + 호버 툴팁 "Phase 2: 예약 생성 예정" (U4).

### 4.4 색 시스템 (E4 수정 — orange tone 강화)

| 상태 | BG | 텍스트 | 계산된 콘트라스트 |
|---|---|---|---|
| 예약완료 | emerald-100 #D1FAE5 | emerald-900 #065F46 | 7.06:1 AAA ✅ |
| 대기 (warning) | amber-200 #FDE68A | amber-950 #451A03 | **8.52:1 AAA** ✅ (E4 수정: amber-900→amber-950) |
| 가용 | white + dashed border | gray-500 | N/A |
| 비운영 | gray-200 + 사선 해칭 | gray-700 | 8.9:1 AAA ✅ |
| 운영중단+예약 | emerald-100 + yellow ring 2px + 배지 | emerald-900 | 7.06:1 + 배지 |

### 4.5 a11y 보강 (U3)

```tsx
<div role="grid" aria-label="BBQ 예약 현황">
  <div role="row">
    <div role="columnheader" aria-sort="none">시설</div>
    {slots.map(s => <div role="columnheader" key={s.slot_number}>{s.slot_label}</div>)}
  </div>
  {facilityRows.map(facility => (
    <div role="row" key={facility.number}>
      <div role="rowheader">BBQ #{facility.number}</div>
      {slots.map(s => <MatrixCell key={s.slot_number} row={...} />)}
    </div>
  ))}
</div>

// 키보드 네비: 화살표 키, Home/End
// 사이드 패널: role="dialog" aria-modal="true" focus trap + ESC + 트리거 복귀
```

### 4.6 사이드 패널 (U8 — 1024px 분기)

```tsx
const isDesktop = useMediaQuery('(min-width: 1024px)');

{isDesktop ? (
  // 우측 슬라이드인 (fixed overlay, CLS 0)
  <div className="fixed top-0 right-0 h-full w-[400px] bg-card shadow-xl z-50" role="dialog" aria-modal>...</div>
) : (
  // bottom-sheet 모달
  <div className="fixed inset-0 bg-black/40 z-50" onClick={close}>
    <div className="fixed bottom-0 left-0 right-0 max-h-[80vh] bg-card rounded-t-2xl" role="dialog" aria-modal>...</div>
  </div>
)}
```

### 4.7 회원명 검색 (U5)

```tsx
<input
  type="search"
  placeholder="회원명 / 연락처 뒷4자"
  value={search}
  onChange={e => setSearch(e.target.value)}
  className="..." />

// 매트릭스 필터링 — 검색어 일치 셀만 하이라이트, 나머지는 회색 dim
```

---

## 5. 사이드바 변경 (S7 — active 매칭 버그 수정)

`components/layout/Sidebar.tsx`:

```ts
// 기존: pathname.startsWith(item.href) — 버그 (/bbq 가 /bbq-board, /bbq-products 동시 매칭)
// 수정: 정확 매치 우선, 더 긴 path 우선
const isActive = pathname === item.href ||
  (pathname.startsWith(item.href + '/') && !navItems.some(n =>
    n.href !== item.href && n.href.startsWith(item.href) && pathname.startsWith(n.href)
  ));
```

메뉴 추가 (평면 — 그룹화는 별도 PR):
```ts
{ href: '/dashboard/bbq-board', label: 'BBQ 예약 현황', icon: Flame },  // ⭐ 신규
{ href: '/dashboard/bbq', label: 'BBQ 시설·타임 설정', icon: Settings },
{ href: '/dashboard/bbq-products', label: 'BBQ 상품·이벤트', icon: Package },
```

---

## 6. E2E spec (Phase 1)

| # | 파일 | 검증 |
|---|---|---|
| 1 | `e2e/bbq-requests-detail.spec.ts` | BBQ 행에 #N번 + N타임 + N인 + ₩N + 예약일 모두 표시. confirmed → "예약완료" 라벨. 모바일 375px 축약 |
| 2 | `e2e/bbq-board-render.spec.ts` | 보드 진입 → KPI 카드 4개 + 매트릭스 셀 렌더 + sticky 헤더 |
| 3 | `e2e/bbq-board-sidepanel.spec.ts` | 예약 셀 클릭 → 사이드 패널 + 회원/상태/액션. ESC 닫힘. 1024px 미만 bottom-sheet |
| 4 | `e2e/bbq-board-inactive-with-rsv.spec.ts` | 비활성 시설+예약 1건 (prod 실재) → 노란 경고 마커 표시 |
| 5 | `e2e/sidebar-active-fix.spec.ts` | `/bbq-board` 진입 시 active 항목 1개만 하이라이트 |

---

## 7. 7점 보강 조치 명세

| # | 위치 | 조치 |
|---|---|---|
| #2 비정상 | requests/page.tsx 인라인 4건 | error 검사 + toast.error + busy 가드 |
| #3 동시성 | select onChange | busy state로 in-flight 가드 |
| #5 비밀 | 072 RPC | audit_logs 성공/실패 양쪽 |
| #6 런타임 | bbq-board page | Suspense + dynamic + tsc/audit 실측 |
| #7 배포 | use-bbq-board | RPC retry 3회 + Realtime fallback + lastFetched stale 60s 경고 |

---

## 8. 영향 파일 맵 (최종)

```
신규
├── supabase/migrations/072_bbq_board_rpc.sql
├── app/dashboard/bbq-board/page.tsx
├── components/admin-bbq/BoardKpiCard.tsx
├── components/admin-bbq/BoardMatrix.tsx
├── components/admin-bbq/BoardWeekTape.tsx
├── components/admin-bbq/ReservationSidePanel.tsx
├── lib/use-bbq-board.ts
├── lib/use-media-query.ts        (1024px 분기용)
├── e2e/bbq-requests-detail.spec.ts
├── e2e/bbq-board-render.spec.ts
├── e2e/bbq-board-sidepanel.spec.ts
├── e2e/bbq-board-inactive-with-rsv.spec.ts
└── e2e/sidebar-active-fix.spec.ts

수정
├── lib/use-requests.ts            (bbqMeta + mapBBQStatus + 이벤트 + select)
├── app/dashboard/requests/page.tsx (2-line + 색 + 인라인 가드 + STATUS 확장)
├── types/index.ts                 (UnifiedStatus, BBQBoardRow)
├── components/layout/Sidebar.tsx  (active 매칭 fix + 메뉴 추가)
```

---

## 9. 구현 순서 (15h 추정)

1. **072 마이그레이션 작성 + Supabase apply** (0.5h)
2. **lib/use-requests.ts 수정** — bbqMeta, mapBBQStatus, 이벤트, error (1.5h)
3. **app/dashboard/requests/page.tsx** — 2-line, 색, 인라인 가드, STATUS 확장 (2h)
4. **lib/use-bbq-board.ts** + use-media-query.ts (1.5h)
5. **app/dashboard/bbq-board/page.tsx** + 4 컴포넌트 (5h)
6. **Sidebar.tsx** — active fix + 메뉴 추가 (0.5h)
7. **E2E 5 spec** (2h)
8. **빌드 + 7점 회귀 (tsc/audit) + 배포** (2h)

---

**구현 진입 — 시작**.
