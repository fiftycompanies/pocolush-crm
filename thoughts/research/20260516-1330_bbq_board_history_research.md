# 평상 예약 현황 — 이력 검색 + 기간 설정 리서치 (2026-05-16)

> **목적**: 사용자 요청 "예약 이력 하단 리스트 + 검색 + 임의 기간 설정" 을 위한 사실/근거/업계 표준 정리
> **선행**: `/dashboard/bbq-board` (운영 보드, 오늘/내일/이번 주 매트릭스)
> **스킬**: ui-ux-pro-max + product-manager-toolkit + ux-heuristics + 외부 자료 (Cloudbeds/Stripe)
> **상태**: 사용자 (kk) 검토 대기 → plan.md (별도) 로 권고안 확정

---

## 0. 한 줄 요약

> 현 운영 보드(매트릭스) + 신규 **하단 이력 검색 섹션** (검색바 + 날짜 범위 + 상태/시설 필터 + 페이지네이션) 추가. 데이터 모델은 신규 RPC `search_bbq_reservations()` (마이그 082) + 검색용 trigram 인덱스 + PIPA audit log. Cloudbeds/Stripe 패턴 모방. 4 안 중 **안 A (단일 페이지 하단 섹션, lazy fetch)** 권고.

---

## 1. 현재 코드 사실 (정밀 인용)

### 1-1. 페이지 구조 (`app/dashboard/bbq-board/page.tsx`, 172 lines)

```
헤더 (lastFetched + isStale + RefreshBtn)
탭 [오늘/내일/이번 주] + 검색 input (회원명/연락처 뒷4자리)
KPI sticky (BoardKpiCard)
오늘/내일 → BoardMatrix
이번 주    → BoardWeekTape
사이드 패널 (ReservationSidePanel) - 셀 클릭 시
```

검색 input(line 116-123)은 현재 매트릭스 셀 내부 필터링만 — **API 호출 X**, client-side 필터만.

### 1-2. RPC `get_bbq_board(p_date_from, p_date_to)` (마이그 072)

반환 컬럼 14개 (시설×슬롯 grid 형태):
- reservation_date, slot_number, slot_label
- bbq_number, bbq_name, facility_active
- status, member_name, member_phone, party_size
- snapshotted_price, product_name, is_event
- reservation_id

특성:
- 시설/타임 별 **모든 셀** 반환 (예약 없는 셀도 null로)
- admin only + PIPA audit log (079 1h dedup)
- 검색용으로 부적합 (페이지네이션 X, 정렬 X)

### 1-3. `useBBQBoard` 훅 (`lib/use-bbq-board.ts`, 191 lines)

- Realtime + 30s/5min 폴링 + visibilitychange
- `pausePolling/resumePolling` (사이드 패널 오픈 중)
- 5min/30s 두 단계 (Realtime SUBSCRIBED 여부)

---

## 2. DB 실측 (Supabase MCP)

| 항목 | 값 |
|---|---|
| 총 bbq_reservations | **30건** |
| 최근 30일 | 25건 |
| 상태별 | confirmed 1 / completed 26 / cancelled 3 / no_show 0 |
| reservation_date 범위 | 2026-04-11 ~ 2026-06-06 |
| **5년 후 예상** | 30/month × 12 × 5 = **~1,800건** |

→ **페이지네이션 필수**, 검색용 인덱스 사전 설치 권고.

### 2-1. 현재 인덱스 (추정, 마이그 077 참조)

- `bbq_reservations(reservation_date, time_slot, bbq_number)` UNIQUE
- `bbq_reservations(member_id)` FK
- `audit_logs(created_at)` 신규 (077)

### 2-2. 검색용 추가 인덱스 권고 (마이그 082)

```sql
-- 기간 + 상태 복합 (검색 hot path)
CREATE INDEX CONCURRENTLY idx_bbq_reservations_date_status
  ON bbq_reservations (reservation_date DESC, status);

-- 회원 검색 trigram (members.name/phone 부분 일치)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY idx_members_name_trgm
  ON members USING gin (name gin_trgm_ops);
CREATE INDEX CONCURRENTLY idx_members_phone_trgm
  ON members USING gin (phone gin_trgm_ops);
```

---

## 3. 유사 SaaS 패턴 (공식 가이드)

### 3-1. Cloudbeds Reservations Page (Hotel PMS — 가장 유사)

> "Search by First name, Last name, reservation number, email, phone number. **Filter icon** opens the **Filter Drawer**. **All columns sortable** ascending/descending."
> — [Cloudbeds Reservations Tab](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/218512847)

**패턴**:
- 상단 검색바 (다중 필드 통합)
- Filter Drawer (사이드 패널)
- 컬럼 정렬 (테이블 헤더 클릭)
- **별도 페이지** ("Reservations" 사이드바 항목)

### 3-2. Stripe Dashboard Payments

> "Filter by date range, payment method, amount, metadata. Natural language dates ('last week') + structured operators (gt/gte/lt/lte). Multiple filters combinable."
> — [Stripe Dashboard Search](https://docs.stripe.com/dashboard/search)

**패턴**:
- 검색바 + 필터 chip 누적 (이미 적용된 필터 표시)
- 자연어 날짜 입력
- URL state 보존 (공유 가능)
- 페이지네이션 (cursor-based)

### 3-3. Toss Place 매출 조회 (한국 SMB)

- 기간 선택: Quick preset 칩 (오늘 / 어제 / 7일 / 30일 / Custom)
- 단순 리스트 + 정렬

### 3-4. 패턴 추출

| 요소 | 권고 |
|---|---|
| 검색 input | 회원명/연락처 통합 (현재 구현 패턴 유지) |
| 날짜 범위 | Quick preset 칩 + Custom date range picker |
| 상태 필터 | multi-select chip |
| 시설 필터 | 단일 select 또는 multi |
| 정렬 | 기본 reservation_date DESC, 컬럼 헤더 클릭 가능 |
| 페이지네이션 | offset/limit 20개 (또는 cursor) |
| URL state | 검색/필터 URL 동기화 (공유 가능) — 선택 |

---

## 4. ux-heuristics 진단

### 4-1. 현 상태

| Nielsen | 현 상태 | 점수 |
|---|---|---|
| #1 시스템 가시성 | 오늘/내일/이번 주만 — 과거 조회 불가 | 5/10 |
| #2 매칭 | "검색 input" 있지만 client-side 필터만 — 검색 결과 없음 | 5/10 |
| #7 효율성 | 신청 관리(`/dashboard/requests?type=bbq`)에서 별도 검색 가능, 두 페이지 컨텍스트 스위치 비용 | 6/10 |

### 4-2. Krug Trunk Test

> "운영자가 지난 달 김XX 회원 평상 예약 이력 조회" — 현재 어디서? `신청 관리 → type=bbq` 진입 → 불완전 (취소/노쇼 별도 탭). 평상 예약 현황 페이지에는 과거 검색 X.

→ **새 섹션/페이지 필요** 명확.

### 4-3. 신청 관리(`/requests?type=bbq`)와 차별점

| 항목 | 신청 관리 (`type=bbq`) | 평상 예약 현황 (이력 NEW) |
|---|---|---|
| 컨텍스트 | 신청 처리 워크플로우 (결제/대기/처리중...) | 평상 예약 데이터 자체 조회 |
| 데이터 source | bbq_reservations + service_orders + coupon_issues 통합 | bbq_reservations 단독 |
| 운영자 의도 | 신청 처리 (액션 — 결제 확인, 상태 변경) | 과거 사실 조회 (감사, 통계, 회원 응대) |
| 결합 도메인 | 신청 (스토어/쿠폰 + bbq) | 평상 전용 (보드 + 이력 통합) |

→ 두 페이지가 **서로 다른 JTBD** 충족. 평상 이력은 평상 페이지에 두는 게 자연스러움.

---

## 5. PM JTBD + RICE

### 5-1. 운영자 Jobs to be Done

| JTBD | 빈도 | 현 경로 | 신규 |
|---|---|---|---|
| 오늘 예약 운영 확인 | 매일 5+회 | `/bbq-board` 오늘 탭 | 동일 |
| 이번 주 일정 확인 | 일 1~2회 | `/bbq-board` 이번 주 | 동일 |
| 김XX 회원 지난 달 예약 조회 | 주 1~2회 (회원 응대) | **없음** ❌ | 신규 §하단 검색 |
| 5월 노쇼 통계 | 월 1회 | **없음** ❌ | 신규 필터 + count |
| 환불 처리 위한 과거 예약 찾기 | 월 1~2회 | 신청 관리 cancelled 탭 | 신규 직접 검색 |
| 5번 시설 예약 이력 (수리 영향 파악) | 분기 1회 | **없음** ❌ | 신규 시설 필터 |

### 5-2. RICE

| 항목 | 값 | 근거 |
|---|---|---|
| Reach | admin 1 (낮음) | 운영자 1명 |
| Impact | **3 (high)** | 회원 응대 + 감사 + 통계 핵심 기능 |
| Confidence | **0.9** | 외부 패턴 명확 (Cloudbeds/Stripe) |
| Effort | **M (~6h)** | RPC 신규 + 인덱스 + UI 컴포넌트 3개 |

**RICE = 1 × 3 × 0.9 / 3 = 0.9** (운영자 1명이라 Reach 낮으나 Impact 높음 → **MUST HAVE**)

---

## 6. 통합 4 안 비교

### 안 A — 단일 페이지 하단 신규 섹션 ⭐ (권고)

```
┌──────────────────────────────────────┐
│ 평상 예약 현황                       │
│ 헤더 + lastFetched                  │
├──────────────────────────────────────┤
│ 탭: [오늘] [내일] [이번 주]          │
│ KPI (sticky)                         │
│ 매트릭스 / Tape                      │
├──────────────────────────────────────┤
│ § 예약 이력 검색 (NEW)               │
│ 기간: [Quick] [Custom from~to]      │
│ 검색: [회원명/연락처]                │
│ 필터: [상태 multi] [시설]            │
│ ───                                  │
│ 리스트 (20개/페이지, 정렬 가능)     │
│ ◀ 1 2 3 ... ▶                      │
└──────────────────────────────────────┘
```

**장점**:
- 사용자 명시 요청 그대로 ("하단에 리스트")
- 보드 + 이력 한 컨텍스트
- 검색은 lazy fetch (사용자가 검색 시작 시만 API 호출)

**단점**:
- 페이지 세로 길이 ↑ — 스크롤 부담

### 안 B — 4번째 탭 [이력]

```
탭: [오늘] [내일] [이번 주] [이력]
- 이력 탭 → 검색 UI + 리스트 (운영 보드 숨김)
```

**장점**:
- 컨텍스트 명확 분리 (보드 vs 이력)
- 한 번에 한 가지 fetch (성능)

**단점**:
- 운영자 "이번 주 보면서 김XX 이력 찾기" 동시 못 함
- 탭 전환 비용

### 안 C — 별도 페이지 `/dashboard/bbq-history`

**장점**:
- 가장 깊은 검색 기능 가능
- URL 공유 가능

**단점**:
- 사이드바 +1 (V2 6그룹 미세 깨짐)
- 컨텍스트 스위치

### 안 D — Cloudbeds 모방: "Reservations" 별도 페이지 (전체 예약)

**장점**:
- 업계 표준 직접 모방
- 신청 관리와 분리

**단점**:
- 신청 관리(`/requests?type=bbq`)와 기능 중복 가능
- 사이드바 +1

### 안 비교 표

| # | 안 | RICE | JTBD 충족 | 미래확장 |
|---|---|---|---|---|
| **A** | **단일 페이지 하단** | 0.9 ⭐ | 9/10 | 7/10 |
| B | 4번째 탭 | 0.7 | 7/10 | 7/10 |
| C | 별도 페이지 | 0.6 | 9/10 | 9/10 |
| D | Cloudbeds 풀 모방 | 0.5 | 9/10 | 9/10 (사이드바 +1) |

**권고**: **안 A** — 사용자 요청 + JTBD 최고 + 미래에 이력이 매우 무거워지면 안 C로 마이그레이션 가능.

---

## 7. 권고 UI 설계 (안 A 상세)

### 7-1. 섹션 구조

```tsx
// app/dashboard/bbq-board/page.tsx 하단 추가
<BoardHistorySection />

// components/admin-bbq/BoardHistorySection.tsx (신규)
- 헤더: "예약 이력" + count
- HistoryFilterBar (기간 + 검색 + 상태 + 시설)
- HistoryList (테이블 또는 카드 리스트)
- Pagination
```

### 7-2. HistoryFilterBar

```
┌──────────────────────────────────────────┐
│ 기간: [지난 7일][30일][90일][Custom]    │ ← quick preset chips
│       2026-04-15 ~ 2026-05-16           │ ← 현재 범위 표시
│                                          │
│ 검색: [🔍 회원명 / 연락처 뒷4자리]      │ ← debounce 300ms
│                                          │
│ 상태: [예약완료] [완료] [취소] [노쇼]   │ ← multi-select chip
│ 시설: [전체 ▼]                          │ ← select
│                                          │
│ [필터 초기화]                  검색 N건 │
└──────────────────────────────────────────┘
```

기간 quick preset:
- 지난 7일 / 30일 / 90일 / **Custom**
- Custom 선택 시 `<input type="date">` 2개 표시

### 7-3. HistoryList

테이블 헤더:
| 예약일 ▼ | 시간 | 시설 | 회원 | 연락처 | 상태 | 액션 |

행 클릭 → 기존 `ReservationSidePanel` 재활용 (선택)

페이지네이션:
- 20개/페이지
- "Showing 1-20 of 142"
- ◀ 1 2 3 ... 8 ▶

### 7-4. URL state 동기화 (선택)

```
/dashboard/bbq-board?
  hist_from=2026-04-01&hist_to=2026-05-16
  &hist_q=김
  &hist_status=cancelled,no_show
  &hist_facility=5
  &hist_page=2
```

장점: 공유/북마크 가능
단점: URL 길어짐 + Suspense boundary 필요

→ Phase 1 미적용 (단순 state), Phase 2 적용 검토.

---

## 8. 데이터 모델 (마이그 082)

### 8-1. 신규 RPC `search_bbq_reservations()`

```sql
CREATE OR REPLACE FUNCTION public.search_bbq_reservations(
  p_date_from DATE,
  p_date_to DATE,
  p_query TEXT DEFAULT NULL,            -- 회원명/연락처 부분 일치
  p_status TEXT[] DEFAULT NULL,         -- multi-select
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
  total_count BIGINT                    -- 전체 결과 수 (페이지네이션용)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn_082_search$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- admin only + PIPA audit log
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    INSERT INTO audit_logs(...) VALUES (..., 'bbq_history_unauthorized', ...);
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  -- search audit (1h dedup 적용 권고 — 079 패턴 답습)
  PERFORM public.assert_admin_with_audit('bbq_history_search', 'bbq_reservation',
    jsonb_build_object('from', p_date_from, 'to', p_date_to, 'query', p_query));

  RETURN QUERY
  WITH filtered AS (
    SELECT r.*, m.name AS member_name, m.phone AS member_phone,
           f.name AS bbq_name, s.label AS slot_label, p.name AS product_name
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
  counted AS (SELECT COUNT(*) AS total FROM filtered)
  SELECT
    f.id, f.reservation_date, f.time_slot, f.slot_label,
    f.bbq_number, f.bbq_name,
    f.status, f.member_id, f.member_name, f.member_phone,
    f.party_size, f.snapshotted_price, f.product_name,
    f.created_at,
    (SELECT total FROM counted)
  FROM filtered f
  ORDER BY f.reservation_date DESC, f.time_slot
  OFFSET (p_page * p_limit)
  LIMIT p_limit;
END;
$fn_082_search$;

GRANT EXECUTE ON FUNCTION search_bbq_reservations TO authenticated;
REVOKE EXECUTE ON FUNCTION search_bbq_reservations FROM anon, PUBLIC;
```

### 8-2. 인덱스 (마이그 082 동봉)

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bbq_reservations_date_status
  ON bbq_reservations (reservation_date DESC, status);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_name_trgm
  ON members USING gin (name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_phone_trgm
  ON members USING gin (phone gin_trgm_ops);
```

### 8-3. PIPA audit (079 dedup 패턴 답습)

`bbq_history_search` action 추가 — 1h dedup 적용 (검색 100회 → 1회 기록).

---

## 9. 영향 분석 (8축)

| 축 | 영향 | 평가 |
|---|---|---|
| A 보안 | admin only RPC + PIPA audit | ✅ |
| B RLS/데이터 | 신규 RPC 분리, 기존 get_bbq_board 무변경 | ✅ |
| C UX | 운영자 JTBD 충족 ↑↑, 페이지 길이 ↑ (mitigation: lazy fetch) | ✅ |
| D 성능 | 인덱스 사전 설치 + LIMIT 20 + lazy fetch | ✅ |
| E 통합/회귀 | useBBQBoard 영향 0 (새 hook `use-bbq-history`) | ✅ |
| F 데이터명 | search_bbq_reservations / use-bbq-history / BoardHistorySection | ✅ |
| G 사이드이펙트 | 페이지 진입 시 검색 X (사용자 액션 시만) | ✅ |
| H 배포안전 | 마이그 단계 (인덱스 CONCURRENTLY) + 코드 점진 | ✅ |

## 7점 체크

| # | 결과 |
|---|---|
| #1 인증/권한 | ✅ admin only + PIPA audit |
| #2 비정상 경로 | ✅ 빈 결과 / 잘못된 입력 fallback |
| #5 비밀정보 | ✅ 변경 없음 |
| #6 런타임 | ✅ tsc + build + Playwright (구현 후) |

---

## 10. 리스크

| # | 항목 | 가능성 | 대응 |
|---|---|---|---|
| R1 | 5년 후 1,800건 → 검색 latency | LOW | 인덱스 + LIMIT 20 |
| R2 | trigram 인덱스 디스크 증가 | LOW | 회원 수 100건 미만 — 영향 micro |
| R3 | 페이지 세로 길이 → 스크롤 피로 | MID | lazy fetch + collapsible 옵션 |
| R4 | URL state 미적용으로 새로고침 시 검색 초기화 | LOW | Phase 2에서 URL sync 추가 |
| R5 | 신청 관리(`/requests?type=bbq`)와 기능 중복 | LOW | JTBD 차별점 명확 (research §4-3) |

---

## 11. 출처

- [Cloudbeds Reservations Tab](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/218512847)
- [Cloudbeds New Reservations Page](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/28409627448091)
- [Stripe Dashboard Search](https://docs.stripe.com/dashboard/search)
- [Stripe Date Range Filtering](https://docs.stripe.com/changelog/clover/2025-11-17/invoice-payments-list-created)
- Toss Place 매출 조회 패턴 (한국 SMB)
- Mews PMS 검색 UI
- Refactoring UI — 정보 밀도 / 섹션 분할
- 사내: thoughts/research/20260516-0030_bbq_consolidation_research.md (4섹션 통합 패턴)
- 사내: supabase/migrations/072_bbq_board_rpc.sql / 079_bbq_board_read_dedup.sql
