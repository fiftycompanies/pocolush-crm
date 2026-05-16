# 평상 예약 현황 — 이력 검색 + 기간 설정 실행 플랜 v1

> **작성**: 2026-05-16 14:00
> **선행**: `thoughts/research/20260516-1330_bbq_board_history_research.md`
> **상태**: 🔴 **kk 승인 대기**
> **권고**: research §6 의 **안 A (단일 페이지 하단 신규 섹션)** + 마이그 082 + lazy fetch
> **변경 규모**: 마이그 1 + 코드 5 파일 + DB 인덱스 3 + 신규 RPC 1, ~6h

---

## 0. 한 줄 요약

> 운영 보드(매트릭스) 하단에 **§이력 검색 섹션** 추가. 기간 quick preset + 검색바 + 상태/시설 필터 + 페이지네이션. 신규 RPC `search_bbq_reservations` (마이그 082) + trigram 인덱스 + 1h dedup PIPA audit. lazy fetch (사용자 검색 시작 시만 API 호출). useBBQBoard 영향 0.

---

## 1. kk 결정 필요 (5건)

| Q | 항목 | 옵션 | 권고 |
|---|---|---|---|
| **Q1** | 통합 안 | (A) 하단 섹션 / (B) 4번째 탭 / (C) 별도 페이지 / (D) Cloudbeds 모방 | **A** ⭐ |
| **Q2** | 기본 fetch 시점 | (1) 페이지 진입 시 즉시 / (2) 사용자 검색 시작 시 lazy / (3) 기본 "최근 7일" 자동 | **3** ⭐ (사용성 + 빈 화면 회피) |
| **Q3** | 기간 입력 UI | (a) Quick preset + Custom date 2개 / (b) Date range picker (단일 컴포넌트) / (c) Quick only | **a** ⭐ |
| **Q4** | URL state 동기화 | (i) Phase 1 적용 / (ii) Phase 2 (별도 PR) | **ii** ⭐ (단순화) |
| **Q5** | 행 클릭 동작 | (1) 기존 ReservationSidePanel 재활용 / (2) 새 detail page / (3) 인라인 expand | **1** ⭐ |

답변 형식: `Q1=A, Q2=3, Q3=a, Q4=ii, Q5=1` 또는 **"권고대로"**.

---

## 2. 변경 파일 (5개 + 마이그)

| 파일 | 변경 | LOC |
|---|---|---|
| `supabase/migrations/082_search_bbq_reservations.sql` | 신규 RPC + 인덱스 3 | ~80 |
| `lib/use-bbq-history.ts` | 신규 훅 (search + pagination) | ~100 |
| `components/admin-bbq/BoardHistorySection.tsx` | 신규 섹션 (헤더 + 필터 + 리스트) | ~80 |
| `components/admin-bbq/HistoryFilterBar.tsx` | 신규 필터 (기간 + 검색 + 상태 + 시설) | ~120 |
| `components/admin-bbq/HistoryList.tsx` | 신규 리스트 (테이블 + 페이지네이션 + 행 클릭) | ~100 |
| `app/dashboard/bbq-board/page.tsx` | `<BoardHistorySection />` 하단 추가 + facilities prop 전달 | +5 |
| `types/index.ts` | `BBQHistoryRow` 타입 추가 | +20 |

---

## 3. Phase 1 — 안 A 구현 (라이브 영향 0)

### 3-1. 마이그 082 (DB)

```sql
-- supabase/migrations/082_search_bbq_reservations.sql

-- 1. 인덱스 (CONCURRENTLY — 락 없음)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bbq_reservations_date_status
  ON bbq_reservations (reservation_date DESC, status);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_name_trgm
  ON members USING gin (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_phone_trgm
  ON members USING gin (phone gin_trgm_ops);

-- 2. 신규 RPC
CREATE OR REPLACE FUNCTION public.search_bbq_reservations(
  p_date_from DATE,
  p_date_to DATE,
  p_query TEXT DEFAULT NULL,
  p_status TEXT[] DEFAULT NULL,
  p_facility_number INT DEFAULT NULL,
  p_page INT DEFAULT 0,
  p_limit INT DEFAULT 20
) RETURNS TABLE (
  reservation_id UUID,
  reservation_date DATE,
  time_slot INT,
  slot_label TEXT,
  bbq_number INT,
  bbq_name TEXT,
  status TEXT,
  member_id UUID,
  member_name TEXT,
  member_phone TEXT,
  party_size INT,
  snapshotted_price INT,
  product_name TEXT,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn_082_search$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- admin only
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    INSERT INTO public.audit_logs (actor_id, action, resource_type, metadata, created_at)
    VALUES ((SELECT auth.uid()), 'bbq_history_unauthorized', 'bbq_reservation',
            jsonb_build_object('from', p_date_from, 'to', p_date_to), NOW());
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  -- PIPA audit (1h dedup 적용 — 079 패턴)
  PERFORM public.assert_admin_with_audit(
    'bbq_history_search',
    'bbq_reservation',
    jsonb_build_object('from', p_date_from, 'to', p_date_to, 'query_present', p_query IS NOT NULL)
  );

  RETURN QUERY
  WITH filtered AS (
    SELECT
      r.id AS reservation_id,
      r.reservation_date, r.time_slot,
      s.label AS slot_label,
      r.bbq_number, f.name AS bbq_name,
      r.status,
      r.member_id, m.name AS member_name, m.phone AS member_phone,
      r.party_size, r.snapshotted_price,
      p.name AS product_name,
      r.created_at
    FROM bbq_reservations r
    LEFT JOIN members m ON m.id = r.member_id
    LEFT JOIN bbq_facilities f ON f.number = r.bbq_number
    LEFT JOIN bbq_time_slots s ON s.slot_number = r.time_slot
    LEFT JOIN bbq_products p ON p.id = r.product_id
    WHERE r.reservation_date BETWEEN p_date_from AND p_date_to
      AND (p_status IS NULL OR r.status = ANY(p_status))
      AND (p_facility_number IS NULL OR r.bbq_number = p_facility_number)
      AND (p_query IS NULL OR p_query = '' OR
           m.name ILIKE '%' || p_query || '%' OR
           m.phone ILIKE '%' || p_query || '%')
  ),
  counted AS (SELECT COUNT(*)::BIGINT AS total FROM filtered)
  SELECT
    f.reservation_id, f.reservation_date, f.time_slot, f.slot_label,
    f.bbq_number, f.bbq_name, f.status,
    f.member_id, f.member_name, f.member_phone,
    f.party_size, f.snapshotted_price, f.product_name, f.created_at,
    (SELECT total FROM counted)
  FROM filtered f
  ORDER BY f.reservation_date DESC, f.time_slot
  OFFSET (p_page * p_limit)
  LIMIT p_limit;
END;
$fn_082_search$;

GRANT EXECUTE ON FUNCTION public.search_bbq_reservations TO authenticated;
REVOKE EXECUTE ON FUNCTION public.search_bbq_reservations FROM anon, PUBLIC;

COMMENT ON FUNCTION public.search_bbq_reservations IS
  '평상 예약 이력 검색 (admin only + PIPA audit 1h dedup) — 2026-05-16';
```

**배포 순서**:
1. Staging Supabase (`jldxikanrjdtpsgatkrf`) 전체 실행 → 로그 확인
2. 운영 Supabase (`lhuaxmzsvrmjavanunnv`) 순차 실행
3. 검증 쿼리: `SELECT * FROM search_bbq_reservations('2026-04-01', '2026-05-16', NULL, NULL, NULL, 0, 5);`

### 3-2. `lib/use-bbq-history.ts` (신규 훅)

```ts
'use client';
import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export type BBQStatus = 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface BBQHistoryFilters {
  dateFrom: string;       // YYYY-MM-DD
  dateTo: string;
  query?: string;
  status?: BBQStatus[];
  facilityNumber?: number;
  page: number;
  limit: number;
}

export interface BBQHistoryRow {
  reservation_id: string;
  reservation_date: string;
  time_slot: number;
  slot_label: string | null;
  bbq_number: number;
  bbq_name: string | null;
  status: BBQStatus;
  member_id: string | null;
  member_name: string | null;
  member_phone: string | null;
  party_size: number;
  snapshotted_price: number;
  product_name: string | null;
  created_at: string;
  total_count: number;
}

export function useBBQHistory(filters: BBQHistoryFilters | null) {
  const supabase = createClient();
  const [rows, setRows] = useState<BBQHistoryRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!filters) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('search_bbq_reservations', {
        p_date_from: filters.dateFrom,
        p_date_to: filters.dateTo,
        p_query: filters.query || null,
        p_status: filters.status?.length ? filters.status : null,
        p_facility_number: filters.facilityNumber ?? null,
        p_page: filters.page,
        p_limit: filters.limit,
      });
      if (rpcErr) throw rpcErr;
      const list = (data as BBQHistoryRow[]) ?? [];
      setRows(list);
      setTotalCount(list[0]?.total_count ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '검색 실패');
    } finally {
      setLoading(false);
    }
  }, [supabase, filters]);

  // filters 변경 시 자동 refetch
  useEffect(() => { fetch(); }, [fetch]);

  return { rows, totalCount, loading, error, refetch: fetch };
}
```

### 3-3. `BoardHistorySection.tsx` (신규 섹션)

```tsx
'use client';
import { useState } from 'react';
import HistoryFilterBar from './HistoryFilterBar';
import HistoryList from './HistoryList';
import { useBBQHistory, type BBQHistoryFilters } from '@/lib/use-bbq-history';
import { todayKST, dateOffsetKST } from '@/lib/use-bbq-board';

interface Props {
  facilities: { number: number; name: string }[];
}

const PAGE_LIMIT = 20;

// 기본값: 최근 7일 자동 검색 (Q2=3 권고)
function defaultFilters(): BBQHistoryFilters {
  return {
    dateFrom: dateOffsetKST(-7),
    dateTo: todayKST(),
    page: 0,
    limit: PAGE_LIMIT,
  };
}

export default function BoardHistorySection({ facilities }: Props) {
  const [filters, setFilters] = useState<BBQHistoryFilters>(defaultFilters);
  const { rows, totalCount, loading, error, refetch } = useBBQHistory(filters);

  return (
    <section className="bg-card border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">예약 이력 검색</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            기간/회원/상태/시설로 과거 예약을 검색합니다 ({totalCount}건)
          </p>
        </div>
      </div>

      <HistoryFilterBar
        filters={filters}
        facilities={facilities}
        onChange={(next) => setFilters({ ...next, page: 0 })}
        onReset={() => setFilters(defaultFilters())}
      />

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error} <button onClick={refetch} className="underline">다시 시도</button>
        </div>
      )}

      <HistoryList
        rows={rows}
        loading={loading}
        page={filters.page}
        limit={filters.limit}
        totalCount={totalCount}
        onPageChange={(page) => setFilters({ ...filters, page })}
        onRowClick={(row) => {
          // Phase 1: 신청 관리 페이지로 이동 (또는 SidePanel — Q5=1 권고)
          // Phase 2: ReservationSidePanel 재활용
        }}
      />
    </section>
  );
}
```

### 3-4. `HistoryFilterBar.tsx` (신규 필터)

```tsx
'use client';
import { Search, X } from 'lucide-react';
import type { BBQHistoryFilters, BBQStatus } from '@/lib/use-bbq-history';
import { todayKST, dateOffsetKST } from '@/lib/use-bbq-board';

const QUICK_PRESETS = [
  { label: '지난 7일', days: 7 },
  { label: '지난 30일', days: 30 },
  { label: '지난 90일', days: 90 },
];

const STATUS_OPTIONS: { value: BBQStatus; label: string; color: string }[] = [
  { value: 'confirmed', label: '예약완료', color: 'emerald' },
  { value: 'completed', label: '완료',     color: 'gray' },
  { value: 'cancelled', label: '취소',     color: 'orange' },
  { value: 'no_show',   label: '노쇼',     color: 'red' },
];

interface Props {
  filters: BBQHistoryFilters;
  facilities: { number: number; name: string }[];
  onChange: (next: BBQHistoryFilters) => void;
  onReset: () => void;
}

export default function HistoryFilterBar({ filters, facilities, onChange, onReset }: Props) {
  const setPreset = (days: number) => {
    onChange({ ...filters, dateFrom: dateOffsetKST(-days), dateTo: todayKST() });
  };

  const toggleStatus = (s: BBQStatus) => {
    const cur = filters.status ?? [];
    const next = cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s];
    onChange({ ...filters, status: next.length ? next : undefined });
  };

  return (
    <div className="space-y-3 text-sm">
      {/* 기간 quick preset */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-secondary">기간:</span>
        {QUICK_PRESETS.map(p => (
          <button
            key={p.days}
            onClick={() => setPreset(p.days)}
            className="text-xs px-2.5 py-1 rounded-full border border-border hover:bg-accent"
          >
            {p.label}
          </button>
        ))}
        <input
          type="date"
          value={filters.dateFrom}
          onChange={e => onChange({ ...filters, dateFrom: e.target.value })}
          className="text-xs border border-border rounded-lg px-2 py-1"
        />
        <span className="text-text-tertiary">~</span>
        <input
          type="date"
          value={filters.dateTo}
          onChange={e => onChange({ ...filters, dateTo: e.target.value })}
          className="text-xs border border-border rounded-lg px-2 py-1"
        />
      </div>

      {/* 검색 + 시설 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-tertiary" />
          <input
            type="search"
            value={filters.query || ''}
            onChange={e => onChange({ ...filters, query: e.target.value })}
            placeholder="회원명 / 연락처 검색"
            className="w-full pl-9 pr-3 h-9 border border-border rounded-lg text-xs"
          />
        </div>
        <select
          value={filters.facilityNumber ?? ''}
          onChange={e => onChange({ ...filters, facilityNumber: e.target.value ? Number(e.target.value) : undefined })}
          className="h-9 px-3 border border-border rounded-lg text-xs"
        >
          <option value="">전체 시설</option>
          {facilities.map(f => (
            <option key={f.number} value={f.number}>{f.number}번 {f.name}</option>
          ))}
        </select>
        <button onClick={onReset} className="text-xs text-text-tertiary hover:text-text-primary flex items-center gap-1">
          <X className="size-3" /> 초기화
        </button>
      </div>

      {/* 상태 multi-select chip */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-secondary">상태:</span>
        {STATUS_OPTIONS.map(s => {
          const active = filters.status?.includes(s.value) ?? false;
          return (
            <button
              key={s.value}
              onClick={() => toggleStatus(s.value)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                active
                  ? `border-${s.color}-500 bg-${s.color}-50 text-${s.color}-700`
                  : 'border-border text-text-tertiary hover:bg-accent'
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

### 3-5. `HistoryList.tsx` (신규 리스트)

```tsx
'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { BBQHistoryRow } from '@/lib/use-bbq-history';

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: '예약완료', color: '#059669', bg: '#ECFDF5' },
  completed: { label: '완료',     color: '#6B7280', bg: '#F3F4F6' },
  cancelled: { label: '취소',     color: '#D97706', bg: '#FFFBEB' },
  no_show:   { label: '노쇼',     color: '#991B1B', bg: '#FEE2E2' },
};

interface Props {
  rows: BBQHistoryRow[];
  loading: boolean;
  page: number;
  limit: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onRowClick?: (row: BBQHistoryRow) => void;
}

export default function HistoryList({ rows, loading, page, limit, totalCount, onPageChange, onRowClick }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const startIdx = page * limit + 1;
  const endIdx = Math.min((page + 1) * limit, totalCount);

  if (loading && rows.length === 0) {
    return <div className="text-center text-sm text-text-secondary py-10">불러오는 중...</div>;
  }
  if (rows.length === 0) {
    return <div className="text-center text-sm text-text-tertiary py-10">검색 결과가 없습니다.</div>;
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-text-secondary">
              <th className="px-3 py-2 font-medium">예약일</th>
              <th className="px-3 py-2 font-medium">시간</th>
              <th className="px-3 py-2 font-medium">시설</th>
              <th className="px-3 py-2 font-medium">회원</th>
              <th className="px-3 py-2 font-medium">연락처</th>
              <th className="px-3 py-2 font-medium">인원</th>
              <th className="px-3 py-2 font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const st = STATUS_LABEL[r.status] ?? { label: r.status, color: '#000', bg: '#fff' };
              return (
                <tr
                  key={r.reservation_id}
                  onClick={() => onRowClick?.(r)}
                  className="border-b border-border last:border-0 hover:bg-accent/30 cursor-pointer"
                >
                  <td className="px-3 py-2.5">{r.reservation_date.replace(/-/g, '.')}</td>
                  <td className="px-3 py-2.5 text-xs text-text-secondary">{r.slot_label}</td>
                  <td className="px-3 py-2.5 font-medium">{r.bbq_number}번 {r.bbq_name}</td>
                  <td className="px-3 py-2.5">{r.member_name || '-'}</td>
                  <td className="px-3 py-2.5 text-xs text-text-secondary">{r.member_phone || '-'}</td>
                  <td className="px-3 py-2.5 text-xs">{r.party_size}인</td>
                  <td className="px-3 py-2.5">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: st.color, backgroundColor: st.bg }}>
                      {st.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-between text-xs text-text-tertiary pt-2">
        <span>{totalCount}건 중 {startIdx}–{endIdx}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
            className="p-1.5 rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="이전 페이지"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="px-2">{page + 1} / {totalPages}</span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page + 1 >= totalPages}
            className="p-1.5 rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="다음 페이지"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 3-6. `app/dashboard/bbq-board/page.tsx` 통합

```tsx
// 기존 코드 하단에 추가
import BoardHistorySection from '@/components/admin-bbq/BoardHistorySection';

// useState 추가
const [facilities, setFacilities] = useState<{number:number; name:string}[]>([]);
useEffect(() => {
  // 시설 목록 1회 fetch (드롭다운용)
  supabase.from('bbq_facilities').select('number,name').order('number')
    .then(({ data }) => setFacilities(data ?? []));
}, []);

return (
  <div className="space-y-5">
    {/* 기존 운영 보드 ... */}

    {/* 신규: 이력 검색 섹션 */}
    <BoardHistorySection facilities={facilities} />
  </div>
);
```

---

## 4. Phase 2 — 옵션 (사용자 결정 시 별도 PR)

| 항목 | 사유 | 작업량 |
|---|---|---|
| 행 클릭 → ReservationSidePanel 재활용 | 상세 조회 | 0.5h |
| URL state 동기화 (Q4=i 선택 시) | 공유/북마크 가능 | 1h |
| 정렬 (컬럼 헤더 클릭) | 다중 정렬 옵션 | 1h |
| CSV 내보내기 | 통계/감사 | 1h |
| Skeleton 로딩 | UX 향상 | 0.5h |

---

## 5. 검증 계획

### 5-1. tsc / build / lint
- `npx tsc --noEmit` 0
- `npm run build` 0

### 5-2. Supabase RPC 검증 (Staging → Prod)
- `SELECT * FROM search_bbq_reservations('2026-04-01', '2026-05-16', NULL, NULL, NULL, 0, 5);`
- `SELECT * FROM search_bbq_reservations(..., '김', NULL, NULL, 0, 5);` (검색)
- `SELECT * FROM search_bbq_reservations(..., NULL, ARRAY['cancelled'], NULL, 0, 5);` (상태)
- `SELECT * FROM search_bbq_reservations(..., NULL, NULL, 3, 0, 5);` (시설)
- 페이지네이션: page=0/1/2 → 다른 결과
- total_count 정확성

### 5-3. Playwright dev
- 페이지 진입 → 하단 §이력 검색 visible
- 기본 "최근 7일" 자동 검색 결과 표시
- 검색 입력 → 결과 갱신
- 필터 chip 클릭 → 결과 갱신
- 페이지네이션 동작
- 행 클릭 → (Phase 1) noop / (Phase 2) 사이드 패널

### 5-4. Playwright prod (배포 후)
- prod 운영 데이터 (~30건) 으로 검색 동작 확인
- 페이지네이션 2페이지 이상 (30건 → 2 페이지)

### 5-5. 성능
- EXPLAIN ANALYZE on search_bbq_reservations(...) — 인덱스 사용 확인
- 30건 < 1ms, 1800건 < 50ms 기대

---

## 6. 영향 / 회귀

| 영역 | 영향 |
|---|---|
| useBBQBoard 훅 | 0 (별도 use-bbq-history 훅) |
| Realtime 채널 `bbq_board` | 0 |
| audit_logs | +1 action `bbq_history_search` (1h dedup) |
| bbq_reservations / members | 인덱스 추가만 (CONCURRENTLY) |
| 다른 페이지 | 0 |
| 신청 관리 (`/requests?type=bbq`) | 0 (별개 컨텍스트) |

## 7점 체크

| # | 결과 |
|---|---|
| #1 인증/권한 | admin only + PIPA audit ✅ |
| #2 비정상 경로 | 빈 결과 / 검색 실패 fallback ✅ |
| #4 DB 정합성 | 인덱스 CONCURRENTLY (락 없음) ✅ |
| #5 비밀정보 | 변경 없음 ✅ |
| #6 런타임 | tsc + build + RPC 검증 ✅ |

---

## 7. 롤백 시나리오

| 단계 | 롤백 |
|---|---|
| 마이그 082 (DB) | `DROP FUNCTION search_bbq_reservations; DROP INDEX ...; DROP EXTENSION pg_trgm;` (다른 사용처 없으면) |
| UI 코드 | `git revert` |
| 인덱스만 유지 | UI/RPC 롤백, 인덱스 유지 (다른 쿼리에도 도움) |

---

## 8. 커밋 전략

### 권고: 분리 2 커밋

1. `feat(db): 082 마이그 — search_bbq_reservations RPC + trigram 인덱스`
2. `feat(bbq-board): 예약 이력 검색 섹션 (기간 + 검색 + 상태/시설 필터 + 페이지네이션)`

→ DB 먼저 적용 → 운영 검증 → UI 배포 (점진).

---

## 9. 작업량

| 단계 | 시간 |
|---|---|
| 마이그 082 작성 + Staging 적용 + 검증 | 1h |
| use-bbq-history.ts 훅 | 30m |
| BoardHistorySection / HistoryFilterBar / HistoryList | 2h |
| page.tsx 통합 + facilities fetch | 20m |
| types/index.ts | 10m |
| tsc / build / Playwright | 1h |
| 운영 DB 마이그 + 커밋 + push + 배포 검증 | 1h |
| **합계 (Phase 1)** | **~6h** |

---

## 10. 잠재 리스크

| # | 항목 | 가능성 | 대응 |
|---|---|---|---|
| R1 | pg_trgm 익스텐션 권한 부족 | LOW | Supabase Hosted 는 기본 지원 |
| R2 | search_bbq_reservations 의 audit_logs 폭증 | LOW | assert_admin_with_audit 1h dedup 적용 |
| R3 | total_count 매번 COUNT 계산 → 1800건 시 latency | MID | 인덱스 적용 후 EXPLAIN 확인, 필요 시 page 1만 COUNT 전송 |
| R4 | client query debounce 미적용으로 fetch 폭증 | LOW | use-bbq-history 내부에서 500ms debounce 옵션 추가 검토 |
| R5 | 모바일 viewport 에서 table 가로 스크롤 | MID | overflow-x-auto 적용 (이미 권고) |
| R6 | facilities prop drilling | LOW | useFacilities 훅으로 추출 (Phase 2) |

---

## 11. kk 피드백 (kk 직접 메모)

> 2026-05-16 14:30 kk 답변: "권고대로"

- **Q1 (통합 안)**: **A** — 단일 페이지 하단 신규 섹션 (운영 보드 매트릭스는 그대로 유지)
- **Q2 (기본 fetch 시점)**: **3** — 페이지 진입 시 "최근 7일" 자동 검색
- **Q3 (기간 입력 UI)**: **a** — Quick preset 칩 + Custom date 2 input
- **Q4 (URL state)**: **ii** — Phase 2 (단순화)
- **Q5 (행 클릭 동작)**: **1** — 기존 ReservationSidePanel 재활용

✅ 승인 → 즉시 `/implement` 진입

---

## 12. 참조

- 리서치: `thoughts/research/20260516-1330_bbq_board_history_research.md`
- Cloudbeds Reservations Tab UI
- Stripe Dashboard search/filter UX
- 마이그 072 (get_bbq_board 패턴 답습)
- 마이그 079 (1h dedup PIPA audit)
- assert_admin_with_audit 헬퍼 (078)

---

## 13. END — kk Q1~Q5 답변 후 `/implement bbq-board-history` 진입. 미승인 상태에서 구현 금지.
