# 운영 강건성 구현 플랜 — Phase P0

**작성일**: 2026-04-16
**리서치**: `thoughts/research/20260416-1700_ops_hardening_research.md`
**승인 상태**: (kk 승인 대기 중 — 구현 전 확인 요망)

---

## 0. 범위 결정

리서치의 P0 (즉시) 항목만 이 플랜에서 다룸. P1/P2는 승인 후 별도 플랜.

- **P0-A**: `trigger_error_logs` 테이블 + `auto_issue_membership` EXCEPTION 표준화
- **P0-B**: `run_schema_integrity_check()` 함수 + pg_cron 일일 실행

P1/P2 (관리자 진단 UI, GitHub Actions drift check, Supabase link, CI idempotency)는 다음 플랜에 분리.

---

## 1. 변경 사항 개요

### 1.1 DB 마이그레이션 신규 (2건)

#### migration 020 — `trigger_error_logs` + 표준 EXCEPTION 적용
```
supabase/migrations/020_trigger_error_logs.sql
```
- 테이블: `trigger_error_logs` (id, function_name, context JSONB, sqlstate, message, detail, hint, exception_context, created_at)
- 인덱스: (function_name, created_at DESC), created_at DESC (7일 정리용)
- RLS: admin만 SELECT. INSERT는 SECURITY DEFINER 함수에서 bypass
- `auto_issue_membership` 함수 재작성:
  - EXCEPTION 블록에서 `GET STACKED DIAGNOSTICS` 모든 항목 캡처
  - `trigger_error_logs`에 INSERT
  - context에는 `rental_id, payment_status, member_id, farm_id, plan` 포함
  - `RAISE WARNING`는 유지 (Supabase 로그 병행)

#### migration 021 — 스키마 무결성 체크 + pg_cron
```
supabase/migrations/021_schema_integrity_check.sql
```
- `run_schema_integrity_check()` 함수
  - 필수 트리거 검증: `trg_auto_issue_membership`, `members_updated_at`, `memberships_updated_at`, `plans_updated_at` 등 (현존 트리거 리스트 스캔)
  - 필수 RPC 함수 검증: `suspend_membership`, `resume_membership`, `update_membership_period`, `issue_membership`, `auto_issue_membership`, `change_member_status`, `run_daily_auto_expiry`
  - 필수 테이블 검증: `memberships`, `membership_logs`, `trigger_error_logs`
  - 누락 발견 시 `trigger_error_logs`에 `function_name='schema_integrity_check'`, `message='MISSING_OBJECTS'`, `context={missing: [...]}` 기록
- `pg_cron.schedule('schema-integrity-daily', '0 3 * * *', ...)` 등록
- 오래된 에러 로그 자동 정리: `pg_cron.schedule('error-log-cleanup', '0 4 * * *', $$DELETE FROM trigger_error_logs WHERE created_at < NOW() - INTERVAL '30 days'$$);`

### 1.2 앱 코드 변경

**P0 범위에서는 앱 코드 변경 없음.** (P1의 "/dashboard/admin/diagnostics" 페이지는 이후 플랜)

그러나 **즉각 관측 가능성은 확보해야 함** → 다음 중 택1:
- (a) 기존 `DashboardList` 또는 `DashboardStatusCards` 컴포넌트 하단에 "최근 시스템 에러" 경고 박스 추가 — 24시간 이내 trigger_error_logs 카운트가 0보다 크면 빨간 배지
- (b) P1에서 별도 페이지로 구현하고 P0에서는 DB만 준비

→ **(b) 권장** — P0은 DB 계층만 먼저 정착시키고 P1에서 UI 추가

### 1.3 문서 변경

- `CLAUDE.md` (프로젝트 루트) 말미에 "DB 트리거 규약" 섹션 추가
  - 새 SECURITY DEFINER trigger 함수는 **표준 EXCEPTION 템플릿** 의무
  - 새 함수는 반드시 `run_schema_integrity_check()`의 필수 목록에 추가
  - Migration 파일은 반드시 idempotent (`CREATE OR REPLACE`, `DROP ... IF EXISTS`, `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`)

---

## 2. 파일별 변경 내역

### 신규

| 파일 | 목적 |
|------|------|
| `supabase/migrations/020_trigger_error_logs.sql` | 에러 로그 테이블 + auto_issue 표준화 |
| `supabase/migrations/021_schema_integrity_check.sql` | 일일 자가 진단 함수 + pg_cron |
| `thoughts/plans/20260416-1730_ops_hardening_plan.md` | 본 파일 |

### 수정

| 파일 | 변경 |
|------|------|
| `CLAUDE.md` | "DB 트리거 규약" 섹션 추가 (약 20줄) |

---

## 3. 구현 단계

1. **pg_cron 활성 확인**
   - SQL Editor에서 `SELECT extname FROM pg_extension WHERE extname='pg_cron';`
   - 없으면 Dashboard → Database → Extensions → pg_cron 활성화 요청
2. **migration 020 작성 → SQL Editor 적용**
3. **migration 020 검증**: 일부러 트리거를 fail시켜 `trigger_error_logs`에 로그 쌓이는지 확인
4. **migration 021 작성 → SQL Editor 적용**
5. **migration 021 검증**:
   - `SELECT run_schema_integrity_check();` 수동 호출
   - 필수 목록에 가짜 이름 추가해 FAIL 케이스 재현
   - `SELECT * FROM cron.job WHERE jobname LIKE 'schema-%';` 스케줄 등록 확인
6. **CLAUDE.md 업데이트**
7. **커밋** — 한국어 conventional commit

---

## 4. 기대 효과 / 성공 기준

- ✅ 이번 같은 silent fail 상황에서 관리자가 `SELECT * FROM trigger_error_logs ORDER BY created_at DESC LIMIT 10;` 한 줄로 원인 즉시 파악
- ✅ 트리거/함수가 실수로 사라져도 **24시간 이내** 감지
- ✅ 매 migration마다 "필수 목록" 업데이트 문화 정착 (CLAUDE.md 등재)
- ✅ 로그 테이블 무한 증가 방지 (30일 자동 정리)

### 측정 지표

| 지표 | 기준 |
|------|------|
| `trigger_error_logs` 미수집 에러 | 0 (최근 7일) |
| `schema_integrity_check` FAIL 건수 | 0 (최근 7일) |
| pg_cron 스케줄 실행 성공률 | >99% |

---

## 5. 리스크 / 롤백

| 리스크 | 완화 |
|--------|------|
| pg_cron 미활성 시 migration 021 실패 | Phase를 2단으로: 함수만 먼저 생성 → pg_cron 스케줄은 활성화 후 등록 |
| `trigger_error_logs` INSERT 자체가 실패 시 무한 루프 가능성 | 에러 테이블 INSERT 실패는 catch 없이 그냥 raise (RAISE WARNING만) — 원본 UPDATE는 영향 받지 않음 (AFTER trigger) |
| 필수 목록 누락 → false alarm | 최초 목록은 현재 DB 상태 그대로 덤프로 생성 → 이후 PR 때 추가만 |

### 롤백

- migration 020 롤백: `DROP TRIGGER trg_auto_issue_membership; CREATE TRIGGER ... EXECUTE FUNCTION` (017 버전으로 복원)
- migration 021 롤백: `SELECT cron.unschedule('schema-integrity-daily'); DROP FUNCTION run_schema_integrity_check();`

---

## 6. kk 피드백 (구현 전 확인)

- [ ] P0 범위(DB 계층만)로 진행 OK?
- [ ] pg_cron 활성 요청해도 되는지 (dashboard 작업 필요)
- [ ] 관리자 UI는 P1으로 분리하는 방향 OK?
- [ ] CLAUDE.md 규약 추가 OK?

---

## 7. 후속 플랜 예고 (P1/P2)

구현 완료 후 별도 플랜으로 진행:

- **P1-플랜**: 관리자 대시보드 "/dashboard/admin/diagnostics" 페이지 + bell 배지 + 최근 에러 10건 UI
- **P1-플랜**: GitHub Actions `supabase db diff --linked` PR 체크 + Supabase PAT secret 설정
- **P2-플랜**: 로컬 Supabase Docker 개발환경 + `supabase db push` 파이프라인 + CI idempotency test
