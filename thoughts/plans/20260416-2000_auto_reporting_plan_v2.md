# 자동 리포트 시스템 v2 — UI 중심 (외부 알림 없음)

> **⚠️ DEPRECATED (2026-04-16 20:30)** — kk 답변(경로 `/dashboard/warning`, 사이드바 위치 등) 반영 + 8스킬 검수/7점 점검/타기능 영향도 추가하여 v3로 발전.
> 최신 플랜: `20260416-2030_auto_reporting_plan_v3.md`

**작성일**: 2026-04-16 20:00
**리서치**: `thoughts/research/20260416-1830_auto_reporting_research.md`
**선행 플랜**: `20260416-1900_auto_reporting_plan.md` (DEPRECATED)
**승인 상태**: DEPRECATED → v3로 발전

---

## 0. kk 피드백 반영 사항

> "그냥 별도 페이지에서 UI로 보여주고 매월 갱신, 수동갱신하자"

**제거**:
- Resend, Vercel Cron, vercel.json
- 이메일 발송, CRON_SECRET, RESEND_API_KEY, DIAGNOSTICS_EMAIL_TO
- Slack 웹훅
- Supabase Database Webhook

**유지**:
- `/dashboard/admin/diagnostics` 페이지
- 에러 확인(ack) 기능
- 관리자 권한 체크 (RLS + UI gate)

**추가**:
- **월별 집계** 카드 (이번 달 / 지난 달 / 최근 6개월 추세)
- **수동 갱신 버튼** (페이지 상단)
- **자동 월 갱신** — 월이 바뀌면 집계가 자동으로 새로 잡힘 (별도 pg_cron/스냅샷 저장 불필요, 페이지 로드 시 실시간 집계)

---

## 1. 설계 요약

### 데이터 흐름
```
trigger_error_logs (이미 존재)
  └─ 관리자가 /dashboard/admin/diagnostics 진입
     ├─ Server Component가 실시간 집계 쿼리 (월별 카운트 + 최근 에러)
     ├─ 화면 렌더링
     └─ "새로고침" 버튼 → router.refresh() → 재쿼리
```

### 월 갱신 원리
- 저장 안 함. 매번 쿼리 시 `DATE_TRUNC('month', created_at)` 로 월별 집계
- "이번 달" = 현재 월의 에러 / "지난 달" = 지난 월 / "6개월 추세" = DATE_TRUNC 그룹 바이
- 월이 바뀌면 자동으로 집계 범위가 이동. 관리자 관점에선 "매월 자동 갱신됨"

### 수동 갱신
- 페이지 상단 **새로고침 버튼** (lucide `RefreshCw` 아이콘)
- 클릭 → `router.refresh()` → Server Component 재실행 → 최신 데이터
- 캐시 혼동 방지 위해 Next.js Cache 미사용 (혹은 `cache: 'no-store'`)

---

## 2. 파일 변경 내역

### 신규 (6건)

| 파일 | 역할 |
|------|------|
| `supabase/migrations/021_trigger_error_logs_ack.sql` | `acked_at`/`acked_by` 컬럼 + ack RPC + 카운트 RPC |
| `app/dashboard/admin/diagnostics/page.tsx` | 진단 페이지 (Server Component) |
| `components/diagnostics/DiagnosticsSummary.tsx` | 월별 집계 카드 (이번 달/지난 달/6개월 추세) |
| `components/diagnostics/ErrorLogTable.tsx` | 최근 에러 리스트 테이블 |
| `components/diagnostics/AckControls.tsx` | 개별/일괄 확인 버튼 (Client) |
| `components/diagnostics/RefreshButton.tsx` | 수동 갱신 버튼 (Client, router.refresh) |

### 수정 (2건)

| 파일 | 변경 |
|------|------|
| `app/dashboard/layout.tsx` or `components/layout/Sidebar.tsx` | "시스템 진단" 메뉴 아이템 + 미확인 건수 배지 |
| `types/index.ts` | `TriggerErrorLog` 타입 추가 |

### 제거 (이전 플랜 대비)

| 항목 | 제거 사유 |
|------|-----------|
| `lib/email/*` | 이메일 미사용 |
| `app/api/cron/daily-digest/route.ts` | Cron 미사용 |
| `vercel.json` | Cron 등록 불필요 |
| `resend` 의존성 | 설치 안 함 |
| `RESEND_API_KEY`, `CRON_SECRET`, `DIAGNOSTICS_EMAIL_TO` | 환경변수 불필요 |

---

## 3. DB 설계 (migration 021)

```sql
-- 021: trigger_error_logs ack + count RPC
-- Idempotent

ALTER TABLE public.trigger_error_logs
  ADD COLUMN IF NOT EXISTS acked_at TIMESTAMPTZ;

ALTER TABLE public.trigger_error_logs
  ADD COLUMN IF NOT EXISTS acked_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_trigger_error_logs_unacked
  ON public.trigger_error_logs(created_at DESC)
  WHERE acked_at IS NULL;

-- 개별 확인 처리
CREATE OR REPLACE FUNCTION public.ack_trigger_error_log(
  p_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.trigger_error_logs
  SET acked_at = NOW(), acked_by = v_uid
  WHERE id = p_id AND acked_at IS NULL;
END;
$func$;

-- 일괄 확인 처리
CREATE OR REPLACE FUNCTION public.ack_all_trigger_error_logs()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_uid UUID := auth.uid();
  v_count INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.trigger_error_logs
  SET acked_at = NOW(), acked_by = v_uid
  WHERE acked_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$func$;

-- 미확인 건수 (Sidebar 배지용)
CREATE OR REPLACE FUNCTION public.get_unacked_error_count()
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
AS $func$
  SELECT COUNT(*)::INT
  FROM public.trigger_error_logs
  WHERE acked_at IS NULL;
$func$;

-- 월별 집계 (최근 6개월)
CREATE OR REPLACE FUNCTION public.trigger_error_monthly_summary()
RETURNS TABLE(
  month DATE,
  total_count BIGINT,
  unacked_count BIGINT,
  top_function TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $func$
  WITH monthly AS (
    SELECT
      DATE_TRUNC('month', created_at)::DATE AS month,
      function_name,
      COUNT(*) AS n,
      COUNT(*) FILTER (WHERE acked_at IS NULL) AS n_unacked
    FROM public.trigger_error_logs
    WHERE created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
    GROUP BY 1, 2
  ),
  ranked AS (
    SELECT month, function_name, n, n_unacked,
           ROW_NUMBER() OVER (PARTITION BY month ORDER BY n DESC) AS rn,
           SUM(n) OVER (PARTITION BY month) AS total,
           SUM(n_unacked) OVER (PARTITION BY month) AS total_unacked
    FROM monthly
  )
  SELECT month, total AS total_count, total_unacked AS unacked_count,
         function_name AS top_function
  FROM ranked
  WHERE rn = 1
  ORDER BY month DESC;
$func$;
```

---

## 4. UI 설계

### 4.1 사이드바 메뉴
```
[기존 메뉴들]
──────────────
시스템 진단  🔴 3   ← 미확인 N건일 때만 배지, 0이면 숨김
```
- 경로: `/dashboard/admin/diagnostics`
- role='admin' 아니면 항목 자체 숨김

### 4.2 진단 페이지 레이아웃
```
┌───────────────────────────────────────────┐
│ 시스템 진단              [🔄 새로고침]     │
├───────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────────┐  │
│ │ 이번 달  │ │ 지난 달  │ │ 미확인 합계  │  │
│ │   3건    │ │   0건    │ │    3건       │  │
│ └─────────┘ └─────────┘ └─────────────┘  │
│                                           │
│ ┌─────── 최근 6개월 추세 ────────────┐    │
│ │  (막대 차트: 월별 에러 수)          │    │
│ └─────────────────────────────────────┘    │
│                                           │
│ 최근 에러 (50건)        [모두 확인] 🔲미확인만 │
│ ┌───────────────────────────────────┐    │
│ │ 시각 | 함수 | 코드 | 메시지 | 작업 │    │
│ │ 2026-04-16 10:23 | auto_issue... │    │
│ │   → 상세 JSON (expandable)        │    │
│ │   [확인]                          │    │
│ │ ...                               │    │
│ └───────────────────────────────────┘    │
└───────────────────────────────────────────┘
```

### 4.3 컴포넌트 역할
- **page.tsx**: Server Component, supabase에서 RPC + 최근 50건 fetch
- **DiagnosticsSummary.tsx**: 3개 숫자 카드 + recharts BarChart
- **ErrorLogTable.tsx**: 테이블 (Server Component, row 단위 확장)
- **AckControls.tsx**: Client Component, Server Action 호출
- **RefreshButton.tsx**: Client, `router.refresh()`

### 4.4 디자인 원칙
- **빈 상태**: 초록 체크 + "최근 6개월 문제 없음"
- **배지 색상**: 0건=초록, 1-5건=노랑, 6건+=빨강
- **JSON 뷰어**: `<details><summary>context</summary>...</details>` (native) 또는 Monaco Editor 미니
- **시간 표시**: `date-fns format('yyyy.MM.dd HH:mm', { locale: ko })`

---

## 5. 구현 단계

1. **migration 021 작성 + SQL Editor 적용**
2. **types/index.ts** — `TriggerErrorLog` 타입
3. **diagnostics 페이지 + 컴포넌트 5개 작성**
4. **Sidebar에 메뉴 추가 + 배지 쿼리**
5. **로컬 빌드 + 타입체크**
6. **E2E 검증** (Playwright):
   - service_role로 가짜 에러 row INSERT
   - admin 로그인 → 사이드바 배지 +1
   - 진단 페이지 진입 → 요약 카드 + 테이블 렌더
   - "확인" 클릭 → 배지 0, row에 "확인됨" 표시
   - "새로고침" 클릭 → 재쿼리 확인
   - 월 전환 시뮬레이션은 생략 (시간 조작 어려움)

---

## 6. 성공 기준

- [ ] 관리자가 `/dashboard/admin/diagnostics` 페이지에서 **이번 달/지난 달/6개월 추세** 한눈에 확인
- [ ] 미확인 에러가 있으면 **사이드바 메뉴에 빨간 배지**
- [ ] **개별/일괄 확인** 버튼 동작
- [ ] **수동 새로고침** 버튼 동작
- [ ] 월이 바뀌면 "이번 달"이 자동으로 새 월 집계로 갱신 (현재 월 기준 쿼리)
- [ ] 모든 RPC admin 권한 체크 통과
- [ ] TypeScript 컴파일 에러 0
- [ ] E2E PASS 5/5

---

## 7. 리스크

| 리스크 | 완화 |
|--------|------|
| 로그 테이블 10만+ 행 성장 | 이미 인덱스 추가. 월별 집계는 `WHERE created_at >= 6개월`로 쿼리 가벼움 |
| Server Component 캐싱으로 최신 에러 안 보임 | `export const dynamic = 'force-dynamic'` 또는 `revalidate = 0` |
| 관리자 아닌데 URL 직접 진입 | 페이지 상단 서버에서 role 체크, 아니면 `notFound()` 또는 리다이렉트 |
| Recharts SSR 이슈 | 차트 컴포넌트만 `'use client'` |
| 월 집계 function의 SECURITY DEFINER 취약점 | role 체크 포함, RLS 이미 admin-only |

---

## 8. 장점 (기존 v1 대비)

| 항목 | v1 | v2 |
|------|-----|-----|
| 외부 서비스 의존 | Resend | 없음 |
| 환경변수 추가 | 3개 | 0개 |
| 신규 파일 수 | 11개 | 6개 |
| 월 비용 | 무료(Resend 한도 내) | 무료 |
| 감지 지연 | 최대 24h | 관리자 로그인/새로고침 시점 |
| 작업량 | ~하루 | 반나절 |
| 설정 의존성 | Resend 가입 | 없음 |

---

## 9. kk 피드백 (구현 전 확인)

- [ ] **진단 페이지 경로** `/dashboard/admin/diagnostics` OK? (다른 경로 선호 시 말씀)
- [ ] **사이드바 위치** — 기존 메뉴 그룹 중 어디? (예: "설정" 그룹 하단, 또는 별도 "관리" 섹션)
- [ ] **6개월 추세 차트** — recharts 사용 OK? (기존 `recharts` 설치돼 있음 → 추가 설치 불필요)
- [ ] **집계 기간** — 6개월 OK? 12개월로 늘릴지?
- [ ] **최근 에러 노출 건수** — 50건 OK?
- [ ] **자동 새로고침 필요 여부** — 페이지 진입 시만 vs 30초마다 자동 refresh?

---

## 10. 후속 — CLAUDE.md 업데이트 (구현 후)

- "관리자 시스템 진단" 섹션 추가
  - 페이지 위치, 확인 방법, 매월 자동 갱신 원리
  - 에러 발견 시 대응 플로우
- 신설 RPC 4개를 `run_schema_integrity_check` 필수 함수 목록에 추가 (만약 P0 P0-B를 나중에 진행한다면)

---

## 11. Phase 2 예고 (본 플랜 아님)

추후 운영 규모 커지거나 긴급 대응 필요 시:
- 이메일/Slack 즉시 알림 (v1 플랜 부활)
- Supabase Database Webhook
- 주간/월간 PDF 리포트 자동 생성
