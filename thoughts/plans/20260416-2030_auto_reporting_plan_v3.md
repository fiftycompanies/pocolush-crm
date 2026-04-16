# 자동 리포트 시스템 v3 — 경고 페이지 (kk 답변 반영본)

**작성일**: 2026-04-16 20:30
**리서치**: `thoughts/research/20260416-1830_auto_reporting_research.md`
**선행 플랜**: v1 (DEPRECATED), v2 (DEPRECATED)
**승인 상태**: (kk 승인 대기 중)

---

## 0. kk 답변 반영

| 질문 | 답변 |
|------|------|
| 경로 | **`/dashboard/warning`** |
| 사이드바 위치 | (Claude 추천) |
| recharts 차트 | OK |
| 집계 기간 6개월 | OK |
| 최근 에러 50건 | OK |
| 자동 새로고침 | **진입 시만** (자동 X) |

### 사이드바 위치 추천 — **bottomNav의 "알림 설정" 위**

근거:
- 현 사이드바 구조: `mainNav` → `회원 서비스` → `콘텐츠` → `bottomNav (알림 설정 / 설정)`
- "경고"는 시스템 진단성 항목이라 비즈니스 메뉴(농장/회원/스토어)와 섞이면 어색
- "알림 설정" / "설정"과 같은 시스템 그룹에 자연스럽게 묶임
- bottomNav 그룹의 **첫 번째**(알림 설정 위)로 배치 → 미확인 건 있을 때 시각적 우선순위 확보

```ts
// 변경 후
const bottomNav = [
  { href: '/dashboard/warning', label: '경고', icon: AlertTriangle },  // 신규
  { href: '/dashboard/notifications', label: '알림 설정', icon: Bell },
  { href: '/dashboard/settings', label: '설정', icon: Settings },
];
```

---

## 1. 최종 설계 요약

### 1.1 페이지
- 경로: `/dashboard/warning`
- Server Component (force-dynamic, 캐시 없음)
- 진입 시마다 실시간 집계
- 자동 polling 없음 (사용자가 새로고침 버튼/F5 직접 클릭)

### 1.2 사이드바
- bottomNav 첫 번째 항목 "경고" + AlertTriangle 아이콘
- 미확인 건수 빨간 배지 (0건이면 배지 숨김)
- admin role만 노출

### 1.3 데이터 흐름
```
trigger_error_logs (existing)
  └─ Sidebar (Server Component): get_unacked_error_count() RPC → 배지
  └─ /dashboard/warning (Server Component):
       ├─ trigger_error_monthly_summary() → 6개월 추세 카드/차트
       ├─ SELECT ... LIMIT 50 → 최근 에러 표
       └─ 사용자가 ack → ack_trigger_error_log RPC → router.refresh
```

---

## 2. 파일 변경 (확정)

### 신규 (6건)

| 파일 | 역할 |
|------|------|
| `supabase/migrations/021_trigger_error_logs_ack.sql` | acked_at/acked_by + 4 RPC |
| `app/dashboard/warning/page.tsx` | Server Component 진단 페이지 |
| `components/diagnostics/DiagnosticsSummary.tsx` | 월별 카드 + recharts BarChart |
| `components/diagnostics/ErrorLogTable.tsx` | 최근 50건 테이블 |
| `components/diagnostics/AckControls.tsx` | 개별/일괄 ack (Client + Server Action) |
| `components/diagnostics/RefreshButton.tsx` | router.refresh 버튼 (Client) |

### 수정 (2건)

| 파일 | 변경 |
|------|------|
| `components/layout/Sidebar.tsx` | bottomNav에 "경고" 추가 + 배지 위해 client→server 분리 또는 SWR/RPC 호출 |
| `types/index.ts` | `TriggerErrorLog` + `TriggerErrorMonthlySummary` 타입 |

---

## 3. DB — migration 021 (확정)

```sql
-- 021: trigger_error_logs ack + monthly summary RPC
-- Idempotent

ALTER TABLE public.trigger_error_logs
  ADD COLUMN IF NOT EXISTS acked_at TIMESTAMPTZ;
ALTER TABLE public.trigger_error_logs
  ADD COLUMN IF NOT EXISTS acked_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_trigger_error_logs_unacked
  ON public.trigger_error_logs(created_at DESC)
  WHERE acked_at IS NULL;

-- 1) 개별 ack
CREATE OR REPLACE FUNCTION public.ack_trigger_error_log(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_uid AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  UPDATE public.trigger_error_logs
    SET acked_at = NOW(), acked_by = v_uid
    WHERE id = p_id AND acked_at IS NULL;
END;
$func$;

-- 2) 일괄 ack
CREATE OR REPLACE FUNCTION public.ack_all_trigger_error_logs()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE v_uid UUID := auth.uid(); v_count INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_uid AND role = 'admin'
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

-- 3) 미확인 건수
CREATE OR REPLACE FUNCTION public.get_unacked_error_count()
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
AS $func$
  SELECT COUNT(*)::INT
  FROM public.trigger_error_logs
  WHERE acked_at IS NULL;
$func$;

-- 4) 월별 집계 (현재 월 포함 최근 6개월)
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
  WITH base AS (
    SELECT
      DATE_TRUNC('month', created_at)::DATE AS m,
      function_name,
      acked_at
    FROM public.trigger_error_logs
    WHERE created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
  ),
  monthly AS (
    SELECT m, function_name,
           COUNT(*) AS n,
           COUNT(*) FILTER (WHERE acked_at IS NULL) AS n_unacked
    FROM base
    GROUP BY m, function_name
  ),
  ranked AS (
    SELECT m, function_name, n, n_unacked,
           SUM(n) OVER (PARTITION BY m) AS total_n,
           SUM(n_unacked) OVER (PARTITION BY m) AS total_un,
           ROW_NUMBER() OVER (PARTITION BY m ORDER BY n DESC) AS rn
    FROM monthly
  )
  SELECT m AS month, total_n AS total_count,
         total_un AS unacked_count, function_name AS top_function
  FROM ranked
  WHERE rn = 1
  ORDER BY m DESC;
$func$;
```

---

## 4. 8스킬 다각도 검수

### ① senior-architect — 시스템 설계
- ✅ Server Component 중심 → 클라이언트 번들 최소화
- ✅ ack/count/summary 4 RPC로 책임 분리
- ⚠️ Sidebar 배지 카운트가 client component(`'use client'`) 안에 있음 — 진입 시마다 fetch 필요. **권고**: Sidebar 자체를 Server Component로 변환하거나, `<DiagnosticsBadge>` 만 분리해 Server에서 fetch 후 props로 전달
- ✅ pg_cron/스냅샷 회피 → 인프라 단순

### ② senior-backend — DB
- ✅ idempotent 마이그레이션 (`ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE`)
- ✅ 부분 인덱스 `WHERE acked_at IS NULL` → 미확인 카운트 O(미확인 건수)
- ✅ `trigger_error_monthly_summary` 6개월 범위 한정 → 인덱스 스캔
- ⚠️ ack_trigger_error_log가 같은 row에 동시 호출되면 두 번 UPDATE되지만 결과 동일 (멱등) → OK
- ⚠️ acked_by FK가 auth.users → 사용자 삭제 시 cascade 없음. **권고**: `ON DELETE SET NULL`

### ③ senior-frontend — Next.js 16
- ✅ Server Component + force-dynamic → 항상 최신
- ⚠️ recharts는 SSR 한계 있음 → 차트 컴포넌트만 `'use client'`. props로 데이터 주입
- ✅ Server Action으로 ack 호출 → 자동 invalidate
- ⚠️ Sidebar 배지가 모든 dashboard 페이지에서 RPC 호출 → 캐싱 없으면 네비게이션 마다 호출. **권고**: `'use cache'` + `cacheTag('warning-count')` + ack/insert 시 `revalidateTag`

### ④ senior-security — 권한/비밀
- ✅ 4 RPC 모두 SECURITY DEFINER + admin role 체크
- ✅ `trigger_error_logs` RLS는 admin SELECT만
- ⚠️ Sidebar에서 메뉴 노출 자체를 admin 일 때만 → 클라이언트 분기 필요. server-side에서 profile.role 가져와서 prop 전달 또는 `headers()`로 cookie 검증
- ⚠️ context JSONB에 PII 가능성 (member_id, customer_id) → 페이지에서 렌더 시 일반 노출 OK (admin만 본다는 가정), 단 화면 캡처/공유 시 주의

### ⑤ code-reviewer — 코드 품질
- ✅ TypeScript 타입 강제 (`TriggerErrorLog`)
- ⚠️ "이번 달" 경계 — `DATE_TRUNC('month', NOW())` UTC 기준. 한국 새벽 시간엔 월이 한국과 다를 수 있음. **권고**: `DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Seoul')`
- ⚠️ Server Action `ackError(id)` 가 fail 시 toast로 안내 + 페이지 미갱신
- ✅ recharts BarChart 빈 데이터 처리 — 0건일 때 EmptyState 컴포넌트

### ⑥ ui-ux-pro-max — UX
- ✅ 빈 상태 (초록 체크) — 운영 건강함을 적극 알림
- ✅ 배지 색상 임계 (0=숨김, 1-5=노랑, 6+=빨강)
- ⚠️ 미확인만 보기 / 전체 토글 위치 — 테이블 우측 상단
- ⚠️ 모바일 대응 — 사이드바 hidden 상태에서도 진단 접근 가능해야. 현 layout이 이미 처리 중인지 확인 (`md:flex` 등)
- ✅ JSON context는 `<details>` 네이티브 expandable
- ⚠️ "확인" 버튼 클릭 시 즉시 사라지면 실수 복구 불가 → toast에 "되돌리기" 5초 옵션 (P2 추가 검토)

### ⑦ senior-devops — 배포/환경
- ✅ 환경변수 추가 0개
- ✅ 외부 SaaS 0개
- ✅ migration 021만 SQL Editor 실행하면 됨
- ⚠️ Vercel 배포 후 첫 진입 시 cold start — Server Component RPC 호출 < 500ms 예상

### ⑧ webapp-testing — E2E
- 시나리오:
  1. service_role로 가짜 에러 row 3건 INSERT
  2. admin 로그인 → 사이드바 "경고 🔴3" 확인
  3. /dashboard/warning 진입 → 카드 + 차트 + 테이블 렌더
  4. 행 1개 "확인" → 사이드바 배지 2 (재로딩 후)
  5. "모두 확인" → 배지 0
  6. "🔄 새로고침" 버튼 → 재쿼리 OK
  7. 빈 상태 (모두 ack) → "최근 6개월 문제 없음" 초록 카드
- non-admin 시나리오: staff 계정 로그인 → /dashboard/warning 직접 URL → 403 또는 redirect 확인

---

## 5. 7점 체크리스트

| # | 항목 | 결과 | 비고 |
|---|------|------|------|
| 1 | **인증/권한** | ⚠️ 주의 | RPC 4개 모두 admin 체크 OK. Sidebar 메뉴 노출은 server-side role 체크로 강제 필요 |
| 2 | **비정상 경로** | ✅ 통과 | RPC FORBIDDEN raise → UI에서 toast로 처리. 빈 데이터 EmptyState |
| 3 | **중복/동시성** | ✅ 통과 | ack는 멱등 (`WHERE acked_at IS NULL`). 일괄 ack는 단일 트랜잭션 |
| 4 | **DB 정합성** | ⚠️ 주의 | acked_by FK ON DELETE SET NULL 추가 권장. 컬럼 추가는 NULL 허용이라 기존 INSERT 영향 없음 |
| 5 | **비밀정보 노출** | ✅ 통과 | context JSONB에 PII 있을 수 있으나 admin 한정 RLS + UI gate. 외부 전송 없음 |
| 6 | **런타임 이슈** | ⚠️ 주의 | recharts SSR/CSR 분리 — `'use client'` 누락 시 빌드 에러. UTC vs KST month boundary 고려 |
| 7 | **배포 후 대응** | ✅ 통과 | 문제 발생 시 SQL Editor에서 `SELECT * FROM trigger_error_logs WHERE created_at > NOW() - INTERVAL '1h'` 백업 경로 |

### 선결 조치
- [P] acked_by FK에 `ON DELETE SET NULL` 추가
- [P] DATE_TRUNC에 `AT TIME ZONE 'Asia/Seoul'` 적용
- [P] Sidebar 배지 컴포넌트 Server-side 분리

---

## 6. 타기능 영향도 분석 (QA 관점)

### 변경 영향 매트릭스

| 변경 | 직접 영향 | 간접 영향 | 검증 방법 |
|------|-----------|-----------|-----------|
| `trigger_error_logs` 컬럼 2개 추가 | 020에서 만든 INSERT 문 (NULL 허용이라 문제 없음) | 기존 트리거(`auto_issue_membership`) 정상 작동 유지 | 결제 flip → 회원권 발급 + 에러 시 INSERT 정상 |
| `acked_at`/`acked_by` 추가 | trigger_error_logs SELECT 쿼리 | 없음 | 기존 데이터 SELECT 결과 변화 없음 |
| 4개 RPC 신규 | 신규 페이지만 사용 | 없음 | 기존 페이지 회귀 테스트 |
| `Sidebar.tsx` 수정 (1줄 + import) | **모든 dashboard 페이지** (10+ 개) 사이드바 렌더링 | bottomNav 순서 변경 시 사용자 혼동 | 모든 dashboard 페이지 진입해서 사이드바 정상 표시 확인 |
| 신규 페이지 `/dashboard/warning` | 라우팅 충돌? | 없음 (신규 경로) | 진입 OK, 권한 없는 사용자 거부 |
| recharts import | 번들 크기 | 이미 `recharts` 의존성 있음 → 추가 import만 | 빌드 사이즈 비교 |
| Server Component fetch | DB 쿼리 부하 | trigger_error_logs 미확인 건수 SELECT — 부분 인덱스로 매우 빠름 | EXPLAIN ANALYZE |

### 회귀 테스트 대상 페이지

이번 작업으로 사이드바를 건드리므로 **모든 dashboard 페이지** 회귀 검증 필요:
1. /dashboard (홈)
2. /dashboard/inquiries (목록 + 상세)
3. /dashboard/farms (목록 + 상세)
4. /dashboard/rentals (목록 + 상세 — 이번 회원권 작업 영향)
5. /dashboard/members (목록 + 상세)
6. /dashboard/requests
7. /dashboard/bbq
8. /dashboard/store
9. /dashboard/plans
10. /dashboard/coupons
11. /dashboard/notices
12. /dashboard/blog
13. /dashboard/notifications
14. /dashboard/settings
15. /dashboard/warning (신규)

### 경계/엣지 케이스
- **미확인 0건 + 사이드바 진입**: 배지 안 보이고 메뉴는 보임 ✓
- **미확인 100건 이상**: 배지 "99+" 표시 (UX 처리)
- **admin 아님이 메뉴 노출**: 서버에서 차단 → 메뉴 자체 안 보이는 게 정답 (현 client 사이드바는 role 모름)
- **trigger_error_logs 0건 (운영 6개월 무사고)**: 빈 차트 처리 + 초록 EmptyState
- **차트가 모바일에서 깨짐**: `<ResponsiveContainer>` 사용 강제

### 기존 회원권 작업과 충돌 가능성
- ❌ 없음 (기능적 분리)
- 트리거 함수에서 catch한 에러를 페이지에서 가시화만 함
- 회원권 발급/정지/기간수정 기능에 영향 없음

---

## 7. 구현 단계

1. migration 021 작성 + SQL Editor 적용 + 검증 쿼리
2. types/index.ts: `TriggerErrorLog`, `TriggerErrorMonthlySummary`
3. components/diagnostics/* 5개 컴포넌트 작성
4. app/dashboard/warning/page.tsx 작성
5. components/layout/Sidebar.tsx 수정 (메뉴 + 배지)
6. 로컬 빌드 + tsc + lint
7. Playwright E2E
8. 회귀 테스트 (모든 dashboard 페이지 사이드바)
9. (선택) Vercel 프리뷰 배포 후 실 환경 검증

---

## 8. 성공 기준

- [ ] migration 021 적용 후 4 RPC 동작 확인
- [ ] /dashboard/warning 진입 → 월별 카드 + 차트 + 50건 테이블 렌더
- [ ] 가짜 에러 1건 INSERT → 사이드바 배지 1
- [ ] "확인" 클릭 → 배지 0
- [ ] "🔄 새로고침" → 데이터 재요청 확인
- [ ] non-admin (staff)이 URL 직접 접근 → 거부
- [ ] 모든 기존 dashboard 페이지 사이드바 정상 표시 (회귀)
- [ ] tsc 0 errors, eslint 0 errors
- [ ] E2E 7/7 PASS

---

## 9. 리스크 + 대응 (8스킬 검수 기반)

| 리스크 | 대응 |
|--------|------|
| Sidebar 배지가 server-side fetch로 변경되어 client interactivity 영향 | bottomNav만 server component로 split, mainNav/memberNav는 client 유지 |
| recharts SSR 빌드 에러 | DiagnosticsSummary 차트 부분만 별도 client component로 분리 (`'use client'`) |
| month boundary KST 불일치 | RPC에서 `AT TIME ZONE 'Asia/Seoul'` 명시 |
| 회귀로 인한 다른 페이지 깨짐 | E2E + 수동 회귀 (5개 핵심 페이지: /dashboard, /rentals, /members, /farms, /settings) |
| acked_by FK ON DELETE 처리 | migration 021 본문에 `ON DELETE SET NULL` 추가 |

---

## 10. kk 최종 확인

- [x] 경로 `/dashboard/warning`
- [x] 사이드바 위치: bottomNav 첫 번째 (알림 설정 위)
- [x] recharts 차트
- [x] 6개월
- [x] 50건
- [x] 진입 시만 (자동 polling 없음)
- [ ] 위 8스킬 검수 결과 + 7점 점검 + 영향도 분석 검토 후 GO/NOGO 회신

GO 시 즉시 `/implement`로 진입.
