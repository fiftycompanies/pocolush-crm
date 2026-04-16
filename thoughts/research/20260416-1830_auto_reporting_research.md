# 자동 리포트 시스템 리서치

**작성일**: 2026-04-16
**배경**: migration 020으로 `trigger_error_logs` 테이블이 운영 중이나, **조회가 수동**이라 사실상 감지 지연 발생. "정기체크 + 특정문제 조사"를 **자동 리포트**로 전환 필요.
**스택**: Supabase Postgres + Next.js 16 + Vercel

---

## 1. 유사 사례 리서치

### 1.1 Supabase Database Webhooks
- `pg_net` 확장 기반, 테이블 INSERT/UPDATE/DELETE 이벤트를 HTTP로 푸시 ([Supabase Docs](https://supabase.com/docs/guides/database/webhooks))
- 비동기 실행, DB 블로킹 없음
- 실패 시 자동 재시도 6시간, 대시보드에서 실패 응답 인스펙션 가능
- fire-and-forget 성향 — 중요 알림엔 이중 안전장치 필요
- [디버깅 가이드](https://supabase.com/docs/guides/troubleshooting/webhook-debugging-guide-M8sk47)

### 1.2 Vercel Cron Jobs
- `vercel.json` 의 `crons` 필드로 스케줄 등록 ([Vercel Template](https://vercel.com/templates/next.js/vercel-cron))
- `CRON_SECRET` Authorization 헤더로 엔드포인트 보호 ([Mert Enercan guide](https://medium.com/@mertenercan/automate-your-nextjs-api-routes-with-vercel-cron-jobs-64e8e86cbee9))
- 일일 요약 이메일 패턴이 표준 `0 9 * * *`
- Hobby 플랜에서도 무료로 사용 가능 (하루 2회 제한)

### 1.3 Supabase pg_cron + Edge Function
- `cron.schedule('job-name', '0 9 * * *', $$sql$$)`로 SQL 호출 등록 ([Supabase Cron](https://supabase.com/blog/supabase-cron))
- Edge Function을 직접 호출 가능 → Slack/Email 발송 로직 ([Samuel Mpwanyi - Medium](https://medium.com/@samuelmpwanyi/how-to-set-up-cron-jobs-with-supabase-edge-functions-using-pg-cron-a0689da81362))
- `cron.job_run_details`에서 실행 이력 확인
- DB 계층에서 끝낼 수 있어 외부 의존도 낮음

### 1.4 Sentry 대안 / 소규모팀 에러 관측
- **Honeybadger**: 이메일/대시보드 일체형, SaaS 소규모 최적 ([Last9](https://last9.io/blog/the-best-sentry-alternatives/))
- **GlitchTip**: 오픈소스, Sentry SDK 호환 드롭인
- **PostHog**: 100k events/월 무료
- **Better Stack**: 대용량 저비용
- 공통 결론: **1명 관리자 / <100 에러/월** 규모면 **별도 SaaS 불필요**. 앱 내부 테이블 + 이메일로 충분.

---

## 2. 8스킬 관점 분석

### ① senior-architect — 시스템 설계
- **3계층 구조** 권장 (이벤트-주도 + 스케줄 + UI 삼중 안전망):
  1. **즉시 알림**: DB 트리거 → 웹훅 → Vercel API Route → 이메일 (critical만)
  2. **일일 요약**: Vercel Cron → Next.js Route Handler → 집계 이메일
  3. **대시보드**: `/dashboard/admin/diagnostics` + Bell 배지 (read-time)
- 각 계층이 한 곳 장애 시 다른 곳에서 커버 → single-point-of-failure 제거

### ② senior-backend — DB/함수
- **Supabase Database Webhook**이 `trigger_error_logs` INSERT 이벤트 감지 시 Next.js 엔드포인트로 POST
- 조용한 실패 방지 목적이므로 **웹훅 자체 실패도 로깅**: pg_net에서 응답 상태 저장, 다음 cron 실행에서 누락 감지 가능
- Rate limiting: 같은 에러 반복 시 "이번 5분 내 N건" 집계 후 1회 알림 (dedup key: `function_name + sqlstate`)

### ③ senior-frontend — Next.js 16
- **Server Component**에서 `trigger_error_logs` 최근 24시간 카운트 fetch → Bell 배지 표시
- Cache Components (`'use cache'`) + `cacheLife('minutes')` 로 5분 캐시 → 과도한 쿼리 방지
- 에러 상세 페이지는 Server Action으로 pagination
- 알림 읽음 처리 UX: `trigger_error_logs`에 `acked_at TIMESTAMPTZ` 컬럼 추가 → 안 읽은 건만 배지 카운트

### ④ senior-security — 권한/비밀
- **이메일 수신자 목록**을 `profiles.email`에서 가져오되 role='admin' 만
- `CRON_SECRET` 환경변수로 Vercel Cron 엔드포인트 보호
- Supabase Webhook에도 Authorization 헤더 포함 (`WEBHOOK_SECRET`)
- 이메일 본문에 PII(고객 이름/전화) 포함 안 함 — rental_id, code만 노출하고 상세는 대시보드 링크로
- `trigger_error_logs` RLS는 이미 admin-only SELECT

### ⑤ code-reviewer — 품질/엣지케이스
- "에러 핸들러의 에러" 이중 안전장치: 알림 발송 실패 시 레이스/반복 방지 (`retry_count`, `last_attempted_at` 컬럼)
- 동일 에러 디바운스: `last_notified_at` 체크해서 5분 내 재알림 차단
- Cron 타임아웃 (60초 Hobby) → 긴 집계 SQL은 materialized view로 사전 계산

### ⑥ ui-ux-pro-max — 대시보드 UX
- **Bell 아이콘**: Lucide `Bell` + 빨간 배지 숫자 (현재 미읽음 건수)
- **다이제스트 카드**: 에러 그룹핑 (같은 sqlstate끼리), 시간 + 가장 최근 context snippet
- **읽음 처리**: 카드 hover 시 "확인" 버튼 → `acked_at` 업데이트
- **필터**: "미확인만 보기 / 전체"
- **빈 상태**: "모든 것이 정상입니다" 초록 체크 아이콘 + 마지막 에러 발생 시점

### ⑦ senior-devops — 배포/환경
- **Resend** 추천 (Vercel Marketplace 네이티브, 무료 3,000건/월)
- 대안: Slack (Incoming Webhook) — 관리자가 Slack 쓰면 더 즉각적
- 텔레그램 봇도 옵션이지만 SaaS 운영엔 이메일이 감사 추적 용이
- `vercel env add` 로 RESEND_API_KEY, CRON_SECRET, WEBHOOK_SECRET 주입
- `vercel.json`에 `crons` 정의 → 배포 즉시 자동 등록

### ⑧ webapp-testing — 검증
- E2E로 인위적 trigger_error_logs row INSERT → 웹훅 동작/이메일 발송 모킹 확인
- `/api/cron/daily-digest` 를 GET으로 호출해 이메일 내용 snapshot 검증
- Bell 배지 + 다이제스트 UI Playwright로 렌더링 검증
- Resend는 "테스트 모드 이메일 주소"로 외부 전송 없이 확인

---

## 3. pocolush 현재 상황

| 항목 | 현 상태 |
|------|---------|
| 관리자 수 | 1명 (admin@pocolush.test) |
| 에러 발생 빈도 | 매우 낮음 (QA 시점 0건) |
| Slack/Teams 사용 | 미확인 (질문 필요) |
| Resend/메일 서비스 연동 | 없음 |
| Vercel Cron 사용 | 없음 |
| 관리자 대시보드 배지 | 없음 |
| `trigger_error_logs` | 이미 존재 (migration 020) |

### 구체적 리스크
- 현재는 silent fail이 발생해도 **관리자가 수동 SQL 조회를 해야만 인지**. 실제로 이번 QA에서도 2건의 buggy 트리거가 이 방식으로 발견됨.
- 운영 후 **일주일~한달 조회를 잊으면** 문제 누적.

---

## 4. 설계 옵션 비교

### 옵션 A: **풀세트 3계층** (즉시+일일+대시보드)
- **장점**: 최고의 감지력, 이중 안전망
- **단점**: 구현 ~1일, Resend 가입 + Webhook 설정 + UI + Cron 다수 파일
- **비용**: 무료 (Resend 3,000건/월 안에)

### 옵션 B: **일일 요약 이메일만** (Cron + Resend)
- **장점**: 가장 단순 (엔드포인트 1개 + vercel.json)
- **단점**: 최대 24h 감지 지연
- **비용**: 무료
- **파일**: ~3개 (cron route, vercel.json, email template)

### 옵션 C: **대시보드 배지만** (UI-first)
- **장점**: 외부 의존 0, 수동 체크 주기를 "로그인 때마다"로 단축
- **단점**: 관리자가 로그인 안 하면 놓침
- **파일**: ~2개 (Bell 컴포넌트, 쿼리 훅)

### 옵션 D: **D-Webhook만** (즉시 알림)
- **장점**: 실시간
- **단점**: 스팸 위험 (rate-limit 로직 필요), 일일 요약 없음
- **파일**: 위에 더해 Supabase Dashboard 웹훅 설정 필요

---

## 5. 권고안 — **옵션 B + C 조합** (실용 중간층)

**근거**:
- pocolush 에러 빈도 = 극히 낮음 → 즉시 알림(옵션 D)은 과잉
- 관리자 1명 → 3계층(옵션 A) 유지 비용 과다
- **일일 이메일 요약(B)** + **로그인 시 Bell 배지(C)** 두 채널이면 24h 내 감지 보장

### 구성
1. **일일 이메일**: Vercel Cron `0 9 * * *` → `/api/cron/daily-digest` → Resend → admin@pocolush.test
   - 내용: 지난 24h 에러 수, function별 집계, 최근 3건 요약, 대시보드 링크
   - 0건이면 이메일 미발송 (노이즈 방지)
2. **Bell 배지**: `/dashboard/*` 헤더에 미확인 에러 카운트
3. **다이제스트 페이지**: `/dashboard/admin/diagnostics` 최근 50건 표 + "확인" 버튼

### 확장 경로
- 나중에 에러 빈도 증가 / 긴급 반응 필요 시 → **옵션 D(Database Webhook)** 추가로 "즉시 알림" 계층 활성
- Slack 쓰는 팀이 되면 Resend → Slack Webhook 병행

---

## 6. 기술 스펙 초안

### DB 변경
- `trigger_error_logs` 테이블에 `acked_at TIMESTAMPTZ NULL` 추가 (migration 021)
- ack RPC: `ack_trigger_error_log(p_id UUID)` admin 체크

### 앱 변경
- `/api/cron/daily-digest/route.ts` — Bearer CRON_SECRET 검증 후 Resend 호출
- `/dashboard/admin/diagnostics/page.tsx` — 테이블 UI
- `components/DiagnosticsBell.tsx` — 헤더 배지 (Server Component + cache)
- `lib/email/daily-digest.tsx` — Resend + React email template

### 인프라
- `vercel.json` — `crons` 정의
- `.env` — `RESEND_API_KEY`, `CRON_SECRET`, `DIAGNOSTICS_EMAIL_TO`
- Resend 도메인 인증 (또는 `onboarding@resend.dev` 초기값)

---

## 7. 참고 자료

- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks)
- [Webhook debugging guide](https://supabase.com/docs/guides/troubleshooting/webhook-debugging-guide-M8sk47)
- [Supabase CDC Options Compared (Stacksync)](https://www.stacksync.com/blog/supabase-cdc-options-triggers-webhooks-realtime-compared)
- [Vercel Cron Template](https://vercel.com/templates/next.js/vercel-cron)
- [Slack for Vercel](https://vercel.com/integrations/slack)
- [Automate Next.js API with Vercel Cron - Mert Enercan](https://medium.com/@mertenercan/automate-your-nextjs-api-routes-with-vercel-cron-jobs-64e8e86cbee9)
- [Supabase pg_cron Guide](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [pg_cron + Edge Function - Samuel Mpwanyi](https://medium.com/@samuelmpwanyi/how-to-set-up-cron-jobs-with-supabase-edge-functions-using-pg-cron-a0689da81362)
- [Best Sentry Alternatives 2026 - Last9](https://last9.io/blog/the-best-sentry-alternatives/)
- [Security Boulevard - Sentry Alternatives](https://securityboulevard.com/2026/04/best-sentry-alternatives-for-error-tracking-and-monitoring-2026/)
