# BBQ 존 예약 기능 — 통합 PM/UIUX 플랜 (v1)

> 작성일: 2026-05-15 / 작성자: Claude Code (PM + UIUX Pro 스킬)
> 상태: **kk 피드백 대기**
> 관련 PR/마이그레이션: #11~#20 / 060-061-059 (BBQ 보안 + 가용성 RPC + 타임슬롯)

---

## 0. TL;DR

운영자가 BBQ 예약을 "한 눈에" 보고 처리할 수 있도록 **2개 작업**을 진행합니다.

| | 작업 | 영향 파일 | 효과 |
|---|---|---|---|
| **A** | `/dashboard/requests` BBQ 행 디테일 강화 | `lib/use-requests.ts`, `app/dashboard/requests/page.tsx` | "어느 #번 / 어느 타임 / 몇 명 / 얼마" 1행 식별 |
| **B** | `/dashboard/bbq-board` 실시간 현황 보드 신설 | 신규 페이지 + 신규 RPC 1개 | 오늘·내일·주간 점유율 카드 + 시설×타임 매트릭스 |

**범위 밖**: 회원측 예약 UI 는 이미 운영 중 — 이번 변경 없음. 예약 생성 모달 신설은 Phase 2 백로그.

---

## 1. 문제 정의 (PM)

### 1.1 As-Is (현재)

**신청관리(`/dashboard/requests`)** — BBQ 행이 정보 부족:
```
구분 | 신청자 | 연락처     | 내용                     | 날짜       | 상태  | 액션
BBQ  | 김철수 | 010-…    | 1번 바베큐 · 2026-05-23 | 5.20 14:30 | 대기 | 변경▼
```
- ❌ 타임슬롯(1/2/3타임) 표시 없음
- ❌ 인원수, 가격, 상품(이벤트/기본) 정보 누락
- ❌ "예약일" 과 "신청일" 컬럼 혼선
- ❌ 운영자가 BBQ 페이지로 이탈해야 상세 확인

**BBQ 현황 페이지 부재**:
- `/dashboard/bbq` 는 **시설 설정 페이지** (시설 CRUD, 타임슬롯 CRUD) 만 있고 예약 현황 뷰가 없음
- 운영자가 "오늘 어느 BBQ # 의 어느 타임이 비었나" 알려면 신청관리에서 일일이 스캔하거나 회원측 예약 페이지 가서 가용성 RPC 결과를 봐야 함

### 1.2 사용자 골 (kk 요청 명시)

1. **신청관리에 디테일 추가** — BBQ # + 타임 + 인원 + 가격 한 행에서
2. **BBQ 실시간 현황표** — 첨부 참고화면(객실 102/201/202 + 예약완료/예약불가/예약가능 카운트) 패턴을 BBQ 에 적용

### 1.3 비-목표 (Out of Scope)

- 어드민에서 직접 회원 예약 생성 — Phase 2
- 드래그-드롭으로 예약 이동 — Phase 3
- 결제 흐름 변경 — 별도 트랙
- 회원측 예약 UI 변경

---

## 2. 유사 서비스 리서치 핵심 인사이트

4축(캠핑·식당-골프·시각화·리스트행) 깊이 리서치 결과 종합:

### 2.1 공통 베스트 프랙티스 (채택)
1. **상태색 5개 이내** — 확정/대기/마감/가능/비운영. 색 + 텍스트 + 아이콘 3중 인코딩.
2. **2축 그리드** — 행=시설, 열=시간. 헤더와 첫 컬럼 sticky.
3. **상단 KPI 카드** — "완료 N / 대기 M / 가용 K". 그리드 보기 전 숫자로 먼저 파악.
4. **셀 안엔 핵심 1~2개만** — 이름 축약 + 인원. 나머지는 호버/패널.
5. **빈 셀 클릭 = 신규 예약 진입점** (Phase 2 예약 생성 시 활용)
6. **"오늘" 자동 하이라이트 + Today 버튼**.
7. **모바일은 그리드 포기** — "오늘 타임라인 리스트" + 시설 카드 캐러셀.

### 2.2 안티 패턴 (회피)
1. ❌ 상태색 7개 이상 (인지 부하 폭발)
2. ❌ 셀 안에 모든 정보 욱여넣기
3. ❌ 드래그 전용 인터랙션 (터치 실패)
4. ❌ 월간 뷰 기본값 (운영 일상은 오늘+이번주가 95%)
5. ❌ 15분/30분 간격 간트 적용 (BBQ는 3타임 고정 슬롯)

### 2.3 우리 규모(5~6 시설 × 3 타임 × 7일)에 최적

총 셀 ~126개 — **단일 화면 표시 가능한 골디락스 존**.

→ **CatchTable 매니저 + Glofox 카드 그리드 + 캠핑톡 KPI 카드** 하이브리드 채택.

---

## 3. 솔루션 A — 신청관리 BBQ 디테일 강화

### 3.1 데이터 강화 (lib/use-requests.ts)

**현재** (line 56~67):
```ts
detail: `${b.bbq_number}번 바베큐 · ${b.reservation_date}`,
```

**변경 후** — 구조화 메타 추가:
```ts
results.push({
  id: b.id, type: 'bbq',
  memberName: b.member?.name || '-',
  memberPhone: b.member?.phone || '-',
  detail: `#${b.bbq_number}번 · ${slotLabel} · ${formatDateKR(b.reservation_date)} · ${b.party_size}인`,
  amount: b.snapshotted_price || b.price || 0,
  date: b.created_at,
  rawStatus: b.status,
  unifiedStatus: mapBBQStatus(b.status),
  // 신규 메타
  bbqMeta: {
    bbqNumber: b.bbq_number,
    timeSlot: b.time_slot,           // 1/2/3
    timeLabel: slotLabel,            // "2타임(14:00)"
    reservationDate: b.reservation_date,
    partySize: b.party_size,
    productName: b.product?.name,
    isEvent: !!b.product?.event,
  },
});
```

**select 확장**:
```ts
.select('*, member:members(name, phone), product:bbq_products(name)')
```

**시간 슬롯 라벨 매핑** — `useTimeSlots()` hook (이미 존재) 의 결과로 `slot_number → label/start_time` 매핑 객체 만들어 캐싱.

### 3.2 컬럼 재설계

| 기존 | → | 신규 |
|---|---|---|
| 구분 | = | 구분 (좌측 3px 컬러 스트라이프 유지) |
| 신청자 | = | 신청자 |
| 연락처 | → | (신청자 hover popover 로 이동) |
| 내용 | ↑ 강화 | **내용** (2-line, Sentry 패턴 E) |
| 날짜 | → | **예약일** (primary, 굵게) + **신청일** (secondary 작게) |
| 상태 | = | 상태 |
| 액션 | = | 액션 |

### 3.3 행 디자인 (Sentry 패턴 E — 가장 적은 변경)

```
┌────────────────────────────────────────────────────────────────────┐
│▌🔥 BBQ│ 김철수 010-1234       #3번 · 2타임(14:00) · 2인 · ₩30,000  │
│       │                       예약: 5/23(금)   신청: 3일 전        │
│       │                       [이벤트]                       대기▾ │
└────────────────────────────────────────────────────────────────────┘
```

- 좌측 3px 컬러 스트라이프 (BBQ=red, 스토어=sky, 쿠폰=violet) — **현재 코드 line 219 그대로 유지**
- "내용" 컬럼 1줄차: `#번 · 타임 · 인원 · 금액`
- "내용" 컬럼 2줄차: `예약일 · 신청 D-N` (작은 글씨 `text-xs text-text-tertiary`)
- 상품 태그 (`[이벤트]`/`[기본]`) — outline pill

### 3.4 색·아이콘 조정

| 카테고리 | 현재 | 권고 |
|---|---|---|
| BBQ | 🔥 `#DC2626` | 유지 |
| 스토어 | 🛒 `#D97706` | → `#0EA5E9` (sky-500) — 빨강-주황 색맹 구분 개선 |
| 쿠폰 | 🎟 `#8B5CF6` | 유지 |

**SLA 시간 경과 배경** (KDS 패턴):
- 신청 후 1~6h: 행 배경 `bg-amber-50/40`
- 6~24h: `bg-amber-100/50` + ⏰
- 24h+ 미처리: `bg-red-50/40`

### 3.5 모바일 축약

```
≤640px:  #3·2타임·5/23 · 김철수 · 2인 ₩30,000 · 대기▾
≤420px:  #3·2타임·5/23 · 김철수 · 2인
```
절대 안 자르는 것: `#번 · 타임 · 날짜`.

---

## 4. 솔루션 B — `/dashboard/bbq-board` 실시간 현황

### 4.1 페이지 구조 (3-Tab)

```
┌─ BBQ 예약 현황 ───────────────────── [날짜 피커 ▾] [새로고침 30s ⟳] ─┐
│                                                                       │
│  [오늘] [내일] [이번 주]                                              │
│                                                                       │
│  ┌─ 점유율 카드 (sticky 상단) ─────────────────────────────────────┐ │
│  │ 오늘 53%  ████████████░░░░░░░░░░░░░                              │ │
│  │ [예약완료 8]  [대기 0]  [예약가능 6]  [비운영 4]                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─ 시설 × 타임 매트릭스 (메인) ───────────────────────────────────┐ │
│  │           1타임(11-14)    2타임(14-17)    3타임(17-20)          │ │
│  │  BBQ#1    ■ 홍길동 4인   ■ 김철수 6인    ○ 가용                │ │
│  │  BBQ#2    ■ 박영희 2인   ▲ 대기 1건     ■ 이지훈 3인           │ │
│  │  BBQ#3    ○ 가용         ○ 가용         ■ 최민준 4인           │ │
│  │  BBQ#4    ■ 강동원 2인   ■ 송혜교 4인   ▲ 대기 1건             │ │
│  │  BBQ#5    ○ 가용         ○ 가용         ○ 가용                  │ │
│  │  BBQ#6    ▓ 점검중       ▓ 점검중       ▓ 점검중               │ │
│  │                                                                  │ │
│  │  ■ 예약완료  ▲ 대기  ○ 가용  ▓ 비운영                          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  (셀 클릭 → 우측 사이드 패널 슬라이드인: 회원/연락처/메모/상태변경)   │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 "이번 주" 탭 — Tape Chart 변형

```
┌─ 주간 보드  5/15(목) → 5/21(수) ────────────── [← 지난주] [다음주 →] ─┐
│         5/15목  5/16금  5/17토  5/18일  5/19월  5/20화  5/21수         │
│  BBQ#1  ●●○   ●●●   ●●●   ●●●   ○○○   ○●○   ○○○         │
│  BBQ#2  ●▲●   ●●●   ●●●   ●●●   ○○○   ●○○   ○○○         │
│  BBQ#3  ○○●   ○●●   ●●●   ●●●   ○○○   ○○○   ○○○         │
│  BBQ#4  ●●▲   ●●●   ●●●   ●●●   ○○○   ●○○   ○○○         │
│  BBQ#5  ○○○   ○●○   ●●●   ●●●   ○○○   ○○○   ○○○         │
│  BBQ#6  ▓▓▓   ▓▓▓   ▓▓▓   ▓▓▓   ▓▓▓   ▓▓▓   ▓▓▓         │
│                                                                       │
│  각 셀 좌→우 = [1타임/2타임/3타임]                                    │
│  ● 예약완료  ▲ 대기  ○ 가용  ▓ 비운영                                 │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.3 색 시스템 (WCAG AA)

| 상태 | BG | 텍스트 | 아이콘 | 콘트라스트 |
|------|----|----|-----|----|
| 예약완료 | `#FEE2E2` red-100 | `#991B1B` red-900 | ● | 7.3:1 AAA |
| 대기 | `#FED7AA` orange-200 | `#9A3412` orange-900 | ▲ | 6.8:1 AAA |
| 가용 | `#D1FAE5` emerald-100 | `#065F46` emerald-900 | ○ | 7.1:1 AAA |
| 비운영 | `#E5E7EB` gray-200 + 사선 해칭 | `#374151` gray-700 | ▓ | 8.9:1 AAA |

**중요**: 색 + 아이콘 + (필요 시) 텍스트 라벨 3중. 색맹/저조도 야외 환경 대응.

### 4.4 모바일 변환 (`<768px`)

```
┌─────────────────────────┐
│ 오늘 53% ████░░         │
│ 완8 대0 가6 비4         │
├─────────────────────────┤
│ ▼ BBQ#1                 │
│  1타임  ■ 홍길동 4인    │
│  2타임  ■ 김철수 6인    │
│  3타임  ○ 가용          │
├─────────────────────────┤
│ ▼ BBQ#2 ...             │
└─────────────────────────┘
```

세로 카드 스택 + 시설별 collapse. 터치 타깃 44×44px 이상.

### 4.5 신규 RPC

```sql
-- 071_bbq_board_rpc.sql

CREATE OR REPLACE FUNCTION public.get_bbq_board(
  p_date_from DATE,
  p_date_to   DATE DEFAULT NULL  -- NULL이면 단일 일자
)
RETURNS TABLE (
  reservation_date DATE,
  slot_number      INT,
  slot_label       TEXT,
  slot_start       TIME,
  bbq_number       INT,
  bbq_name         TEXT,
  facility_active  BOOLEAN,
  status           TEXT,             -- 'confirmed' / 'completed' / 'cancelled' / NULL(=빈슬롯)
  member_name      TEXT,
  member_phone     TEXT,
  party_size       INT,
  snapshotted_price INT,
  product_name     TEXT,
  reservation_id   UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $fn_071_board$
DECLARE
  v_to DATE := COALESCE(p_date_to, p_date_from);
BEGIN
  -- admin 만 호출 가능 (회원 정보 노출)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(p_date_from, v_to, INTERVAL '1 day')::DATE AS d
  ),
  facility_slot_grid AS (
    SELECT ds.d AS reservation_date,
           s.slot_number, s.label AS slot_label, s.start_time AS slot_start,
           f.number AS bbq_number, f.name AS bbq_name, f.is_active AS facility_active
    FROM date_series ds
    CROSS JOIN public.bbq_time_slots s
    CROSS JOIN public.bbq_facilities f
    WHERE s.is_active = TRUE
  )
  SELECT
    g.reservation_date, g.slot_number, g.slot_label, g.slot_start,
    g.bbq_number, g.bbq_name, g.facility_active,
    r.status, m.name, m.phone, r.party_size, r.snapshotted_price,
    p.name AS product_name, r.id AS reservation_id
  FROM facility_slot_grid g
  LEFT JOIN public.bbq_reservations r
    ON r.reservation_date = g.reservation_date
   AND r.time_slot = g.slot_number
   AND r.bbq_number = g.bbq_number
   AND r.status IN ('confirmed','completed')
  LEFT JOIN public.members m ON m.id = r.member_id
  LEFT JOIN public.bbq_products p ON p.id = r.product_id
  ORDER BY g.reservation_date, g.bbq_number, g.slot_number;
END
$fn_071_board$;

GRANT EXECUTE ON FUNCTION public.get_bbq_board(DATE, DATE) TO authenticated;
```

**왜 단일 RPC?**
- 그리드 화면이 1회 fetch 로 단일 날짜 또는 N일치 모두 받아 클라이언트에서 가공
- 가용성 누수 차단 (RLS bypass + admin only)
- Supabase Realtime 채널은 `bbq_reservations` 테이블 변경 구독해서 invalidate (별도)

### 4.6 Stale 데이터 방지

1. **Supabase Realtime 구독** — `bbq_reservations` UPDATE/INSERT/DELETE 시 자동 refetch
2. **30초 폴링 fallback** — Realtime 실패 대응
3. **헤더 우상단 "30초 전 갱신 ⟳"** 타임스탬프 표시 — stale > 60s 시 노랑 경고 띠

### 4.7 사이드 패널 (셀 클릭 시)

```
┌─ BBQ #3 / 2타임 / 5/23(금) ──────────── [×] ─┐
│                                              │
│ 김철수  010-1234-5678  [회원 상세 ↗]         │
│                                              │
│ 예약 정보                                    │
│ ───────────────────────────────────────      │
│ 상품      프리미엄 BBQ 세트 (이벤트)         │
│ 가격      ₩30,000 (스냅샷)                   │
│ 인원      2인                                │
│ 신청      2026-05-20 14:30 (3일 전)          │
│                                              │
│ 상태 변경                                    │
│ [완료 처리]  [노쇼]  [취소]                 │
│                                              │
│ 관리자 메모 (옵션)                           │
│ [_____________________________]             │
└──────────────────────────────────────────────┘
```

빈 슬롯 클릭 시: "예약 생성" 버튼 (Phase 2 활성화).

---

## 5. 네비게이션 통합

`/dashboard` 사이드바 — BBQ 그룹 재구성:
```
└─ 🔥 BBQ
   ├─ 예약 현황          (신규, /dashboard/bbq-board)   ⭐
   ├─ 시설·타임 설정    (기존, /dashboard/bbq)
   └─ 상품·이벤트       (기존, /dashboard/bbq-products)
```

신청관리(`/dashboard/requests`) 도 그대로 — BBQ 외 스토어/쿠폰 통합 리스트로 유지.

---

## 6. Phase 분할

### Phase 1 — MVP (이번 PR 1건)

**A. 신청관리 디테일 강화** (4시간)
- [ ] `lib/use-requests.ts` — `bbqMeta` 객체 추가, select 확장, 시간슬롯 라벨 매핑
- [ ] `app/dashboard/requests/page.tsx` — 행 2-line 레이아웃 + 예약일/신청일 분리 + 상품 태그
- [ ] 색 조정 (스토어 orange → sky)
- [ ] SLA 시간 경과 배경 (1h/6h/24h)
- [ ] E2E 1 spec 추가 — BBQ 행에 #/타임/인원/가격 모두 노출 검증

**B. BBQ 현황 보드** (6시간)
- [ ] 마이그레이션 `071_bbq_board_rpc.sql` (admin only RPC)
- [ ] `app/dashboard/bbq-board/page.tsx` 신규 — 오늘/내일/주간 탭
- [ ] `components/admin-bbq/BoardKpiCard.tsx` — 점유율 KPI
- [ ] `components/admin-bbq/BoardMatrix.tsx` — 시설×타임 그리드 (오늘/내일)
- [ ] `components/admin-bbq/BoardWeekTape.tsx` — Tape Chart 변형 (주간)
- [ ] `components/admin-bbq/ReservationSidePanel.tsx` — 셀 클릭 슬라이드인
- [ ] 모바일 카드 캐러셀 분기 (Tailwind `md:` breakpoint)
- [ ] Supabase Realtime 구독 + 30s 폴링 fallback
- [ ] 사이드바 메뉴 추가
- [ ] E2E 2 spec 추가 — 점유율 카드 + 매트릭스 렌더 + 사이드 패널 오픈

**Phase 1 완료 기준**:
- 신청관리 BBQ 행에서 BBQ # + 타임 + 인원 + 가격 한눈에 식별
- `/dashboard/bbq-board` 진입 → 오늘 점유율 + 매트릭스 + 셀 클릭 사이드패널 동작
- 모바일 (375px) 에서 사용 가능
- E2E 3건 PASS

### Phase 2 — Strengthen (다음 PR)
- 빈 슬롯 클릭 → 어드민이 회원 예약 생성 (오프라인 워크인)
- 사이드 패널에서 시설/타임 이동 (예약 변경)
- 알림톡 발송 (확인/완료/취소 시점)
- 상품 이벤트 일정 표시 (그리드에 이벤트 배지)

### Phase 3 — Advanced
- 드래그-드롭으로 예약 이동
- 월간 히트맵 (점유율 분기 분석)
- BBQ #별 매출 리포트
- 노쇼 패턴 회원 자동 플래그

---

## 7. 리스크 & 미티게이션

| # | 리스크 | 영향 | 미티게이션 |
|---|---|---|---|
| 1 | RPC `SECURITY DEFINER` + `search_path=''` 검증 미스 | 권한 우회 | 063/065 hotfix 패턴 그대로 — `public.` 풀패스 + admin check 선행 |
| 2 | Realtime 구독 실패 시 stale | 운영자가 중복 예약 받음 | 30초 폴링 fallback + 60s 시 노랑 경고 띠 |
| 3 | 5~6 시설 × 3 타임 그리드가 시설 늘어나면 못 봄 | 미래 확장성 | Phase 3 에 가상화 (`react-virtual`) 도입 여지만 명시 |
| 4 | 모바일 그리드 가독성 | 운영자 폰 사용성 | 카드 캐러셀 분기 (`md:hidden`) 강제 |
| 5 | "비운영" 시설과 "빈 슬롯" 시각 혼동 | 운영 사고 | 사선 해칭 + lock 아이콘 + 회색 배경 3중 차별화 |
| 6 | 신청관리 색 변경 (orange→sky) 으로 기존 운영자 혼란 | UX disruption | 1주 transition 기간 동안 변경 로그 노출 + 안내 토스트 |

---

## 8. 검수 포인트 (테스트 매트릭스)

### Playwright E2E (3 신규 spec)

| # | 시나리오 | 페이지 | 검증 |
|---|---|---|---|
| 1 | 신청관리 BBQ 행 디테일 | `/dashboard/requests` | `#N번` + `N타임` + `N인` + `₩N` 모두 표시 |
| 2 | BBQ 보드 점유율 + 매트릭스 | `/dashboard/bbq-board` | KPI 카드 4개 + 매트릭스 6×3 셀 + sticky 헤더 |
| 3 | 셀 클릭 사이드 패널 | `/dashboard/bbq-board` | 예약 셀 클릭 → 회원정보+상태변경 버튼 노출 |

### 데이터 정합성
- 071 RPC 결과의 `status IS NULL` 셀 수 = `(active 시설 × active 타임 × 일자) - confirmed/completed` 와 일치
- `facility_active=false` 셀은 비운영 표시

### 7점 보안 체크 (CLAUDE.md)
- #1 인가: 071 RPC admin only — `RAISE EXCEPTION` 검증
- #2 비정상: 빈 슬롯/취소 데이터 정상 표시
- #5 비밀: 회원 phone 은 admin 만 노출 (RPC 통과)
- #6 런타임: tsc --noEmit 통과
- #7 배포: Vercel logs + Sentry 모니터링

---

## 9. 일정

| 단계 | 시간 | 누적 |
|---|---|---|
| (kk 피드백 반영) | - | - |
| 071 마이그레이션 작성 + apply | 0.5h | 0.5h |
| 신청관리 디테일 강화 | 4h | 4.5h |
| BBQ 보드 컴포넌트 (KPI + 매트릭스 + 사이드) | 5h | 9.5h |
| 주간 Tape + 모바일 분기 | 2h | 11.5h |
| Realtime + 폴링 + stale 경고 | 1.5h | 13h |
| E2E 3 spec | 1.5h | 14.5h |
| QA + 배포 | 1.5h | 16h |

**약 2일 분량 (1 PR)**.

---

## 10. 결정 필요 사항 (kk 피드백)

다음 5가지를 결정해주시면 곧바로 `/implement` 진입합니다:

### Q1. 신청관리 행 디자인 — 어느 패턴?
- (A) Sentry 2-line (현재 권고, 좌측 컬러바 유지) ⭐
- (B) Shopify 1-line dense (한 줄에 7~8 토큰)
- (C) 확장형 (행 끝 ▾, 펼침)

### Q2. BBQ 보드 메인 뷰 기본 탭?
- (A) 오늘 + 매트릭스 (운영자 일상 95%) ⭐
- (B) 이번 주 + Tape Chart (조망 우선)
- (C) 마지막 본 탭 기억 (localStorage)

### Q3. 사이드 패널 vs 모달?
- (A) 우측 슬라이드인 사이드 패널 ⭐ (그리드 보면서 비교 가능)
- (B) 중앙 모달 (집중도 높음, 그리드 가림)

### Q4. 스토어 색상 변경 (orange→sky)?
- (A) 변경 (색맹 구분 개선) ⭐
- (B) 유지 (기존 운영자 혼선 회피)
- (C) 변경 + 1주 transition 안내 토스트

### Q5. Phase 1 범위?
- (A) A(신청관리) + B(보드) 모두 1 PR ⭐
- (B) A 먼저 (작게) → B 별도 PR
- (C) B 먼저 → A 후속

---

## 부록: 영향 파일 맵

```
신규
├── supabase/migrations/071_bbq_board_rpc.sql
├── app/dashboard/bbq-board/page.tsx
├── components/admin-bbq/BoardKpiCard.tsx
├── components/admin-bbq/BoardMatrix.tsx
├── components/admin-bbq/BoardWeekTape.tsx
├── components/admin-bbq/ReservationSidePanel.tsx
├── lib/use-bbq-board.ts          (RPC 호출 + Realtime)
└── e2e/bbq-board.spec.ts

수정
├── lib/use-requests.ts            (bbqMeta 추가)
├── app/dashboard/requests/page.tsx (행 2-line + 컬럼 재설계)
├── types/index.ts                 (BBQBoardRow 타입)
├── components/layout/Sidebar.tsx  (BBQ 메뉴 그룹화 — 파일명 미확인, 구현 시 확인)
└── e2e/requests.spec.ts            (BBQ 디테일 검증)
```

---

**kk — 위 Q1~Q5 답변 + 추가 코멘트 주시면 바로 구현 들어갑니다.**
