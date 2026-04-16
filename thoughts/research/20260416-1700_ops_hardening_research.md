# 운영 강건성 리서치 — 트리거 관측성 / 스키마 드리프트 / 마이그레이션 규율

**작성일**: 2026-04-16
**근거 이슈**: 2026-04-16 E2E QA에서 발견된 2건의 실배포 결함
  - 버그 A: `benefits` jsonb 타입 mismatch → 수동/자동 발급 silent fail
  - 버그 B: `trg_auto_issue_membership` 트리거가 실배포 DB에 **존재하지 않음** → 원인 불명

두 버그 모두 **실제 운영 중 기능이 동작하지 않는다는 사실**을 알기 어렵게 만드는 공통 특성이 있음.
→ 단기 수정이 아닌 관측성·드리프트 감지·마이그레이션 규율 보강 필요.

---

## 1. Silent Fail 관측성 (운영 권고 #1)

### 1.1 유사 사례 / 산업 패턴

- **EnterpriseDB 가이드**: `EXCEPTION WHEN OTHERS` 블록에서 `GET STACKED DIAGNOSTICS`로 에러 컨텍스트를 캡처한 뒤 전용 **`trigger_error_log` 테이블에 INSERT**하는 것이 업계 표준 ([EDB](https://www.enterprisedb.com/postgres-tutorials/how-raise-errors-and-report-messages-within-stored-procedures-and-functions))
- **PostgreSQL 공식 문서**: `SQLSTATE`, `SQLERRM`, `PG_EXCEPTION_CONTEXT`, `PG_EXCEPTION_DETAIL` 등을 진단 항목으로 지원 ([PostgreSQL 41.9](https://www.postgresql.org/docs/current/plpgsql-errors-and-messages.html))
- **Bytebase 감사 로깅 가이드**: 감사/에러 로그는 AFTER ROW 트리거 + 별도 로그 테이블 조합이 표준 — 장애 시 원인 추적 유일 수단 ([Bytebase](https://www.bytebase.com/blog/postgres-audit-logging/))
- **Medium / Sehban Alam "Production-Ready Audit Logs"**: GDPR·SOC2·HIPAA 등 컴플라이언스 요건 대응용으로 trigger 내부 에러 절대 소실 방지 패턴 제시 ([Medium](https://medium.com/@sehban.alam/lets-build-production-ready-audit-logs-in-postgresql-7125481713d8))
- **Supabase 공식 Discussion #7061**: 트리거가 Auth 플로우에 묶여 있을 때 에러가 삼켜지면 서비스 저하로 이어지는 실례 보고

### 1.2 pocolush 현재 상태

- `auto_issue_membership` 함수의 EXCEPTION 블록이 `RAISE WARNING` 만 호출 → Supabase 로그에만 남고 **앱/DB에서 조회 불가**
- QA에서도 진짜 에러(`benefits` 타입 mismatch)를 찾기까지 **함수를 debug 버전으로 교체**해야만 확인 가능했음 (= 운영 중엔 진단 불가능)
- 실제 고객 계약이 납부완료됐는데 회원권이 발급되지 않는 경우, 관리자는 **어디서도 원인을 찾을 수 없음**

### 1.3 우리 서비스에 맞는 적용안

**① `trigger_error_logs` 테이블 신설**
```sql
CREATE TABLE trigger_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  context JSONB,            -- NEW/OLD 스냅샷, rental_id 등
  sqlstate TEXT,
  message TEXT,
  detail TEXT,
  hint TEXT,
  exception_context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON trigger_error_logs(function_name, created_at DESC);
```

**② 모든 SECURITY DEFINER 트리거 함수 EXCEPTION 블록을 표준화**
```sql
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS
    v_sqlstate = RETURNED_SQLSTATE,
    v_message  = MESSAGE_TEXT,
    v_detail   = PG_EXCEPTION_DETAIL,
    v_hint     = PG_EXCEPTION_HINT,
    v_context  = PG_EXCEPTION_CONTEXT;
  INSERT INTO trigger_error_logs(function_name, context, sqlstate, message, detail, hint, exception_context)
  VALUES ('auto_issue_membership',
          jsonb_build_object('rental_id', NEW.id, 'payment_status', NEW.payment_status, 'member_id', NEW.member_id),
          v_sqlstate, v_message, v_detail, v_hint, v_context);
  RAISE WARNING '%', v_message;
```

**③ 관리자 UI에 "시스템 진단" 섹션 — 최근 에러 10건 조회 페이지**
- 경로: `/dashboard/admin/diagnostics`
- RLS: `profiles.role='admin'` 만 SELECT 가능
- 하루 이상 오래된 건은 자동 7일 뒤 삭제 (`pg_cron`)
- 미해결 에러 >0 건이면 대시보드 Bell 아이콘에 빨간 배지

**④ 적용 범위(현 프로젝트에서 EXCEPTION 블록 사용 중인 함수)**
- `auto_issue_membership` (최우선)
- 이후 신설되는 모든 SECURITY DEFINER trigger 함수는 위 패턴 의무화 (CLAUDE.md 등재)

---

## 2. 스키마/트리거 드리프트 감지 (운영 권고 #2)

### 2.1 유사 사례 / 산업 패턴

- **Supabase 공식 "Managing Environments"**: GitHub Actions에서 `supabase db diff` + `supabase db lint`를 PR 체크로 실행하는 것이 권장 워크플로 ([Supabase Docs](https://supabase.com/docs/guides/deployment/managing-environments))
- **Discussion #18483 "Sync local and prod schemas"**: 운영팀이 겪는 대표 시나리오 — 로컬/원격 drift가 누적되면 `db pull`로 원격을 진실원천으로 삼아 리베이스
- **Prisma Issue #19100**: Supabase auth 스키마 자동 변경으로 인한 drift가 자주 발생 → CI에서 drift를 잡지 못하면 장기간 가려지는 경우 많음
- **Supabase 공식 pg_cron 디버깅 가이드**: 스케줄러 프로세스가 죽었을 때 `pg_stat_activity` 쿼리로 감지 가능; `cron.job_run_details`로 실행 이력 추적 ([Supabase](https://supabase.com/docs/guides/troubleshooting/pgcron-debugging-guide-n1KTaz))

### 2.2 pocolush 현재 상태

- **트리거가 실배포 DB에 없었음에도 migrations 파일에는 존재** — CI에서 비교를 안 하면 감지 불가
- `supabase/config.toml` 에 link가 없어 `supabase migration list --linked`도 수동 실행 불가
- pg_cron 설치 여부/활성 여부 확인 미비
- 관리자 대시보드에 "시스템 상태" UI 부재

### 2.3 적용안

**① `pg_cron` 기반 정기 자가 진단**
1일 1회 실행되는 `run_schema_integrity_check()` 함수:
```sql
CREATE OR REPLACE FUNCTION run_schema_integrity_check()
RETURNS VOID AS $$
DECLARE
  v_missing TEXT[];
BEGIN
  -- 필수 트리거 체크
  SELECT ARRAY_AGG(t_name) INTO v_missing
  FROM (VALUES
    ('trg_auto_issue_membership', 'farm_rentals'),
    ('memberships_updated_at', 'memberships'),
    ('members_updated_at', 'members')
    -- 필수 트리거 전체 등록
  ) AS req(t_name, tbl)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_trigger tg
    JOIN pg_class c ON tg.tgrelid = c.oid
    WHERE tg.tgname = req.t_name AND c.relname = req.tbl
  );

  IF array_length(v_missing, 1) > 0 THEN
    INSERT INTO trigger_error_logs(function_name, message, context)
    VALUES ('schema_integrity_check', 'MISSING_TRIGGERS',
            jsonb_build_object('missing', v_missing));
  END IF;

  -- 필수 함수 존재 체크
  -- ... 동일 패턴
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule('schema-integrity-daily', '0 3 * * *',
                     $$SELECT run_schema_integrity_check()$$);
```

**② GitHub Actions PR 체크 — `supabase db diff --linked`**
```yaml
- name: Check schema drift
  run: |
    supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
    supabase db diff --linked --schema public > drift.sql
    if [ -s drift.sql ]; then
      echo "Schema drift detected:"; cat drift.sql; exit 1
    fi
```

**③ 관리자 "시스템 상태" 페이지 (/dashboard/admin/health)**
- 필수 트리거/함수/테이블 존재 상태 green/red
- `trigger_error_logs` 최근 24시간 카운트
- `cron.job_run_details` 최근 실행 상태
- pg_cron 스케줄러 살아있는지 (`pg_stat_activity` 쿼리)

**④ 현 버그 재발 방지 차원**
- migration 019 가 신규 환경에 반드시 적용되도록 **README + CI에 가이드 등재**
- `trg_auto_issue_membership` 부재 시 PR 머지 차단

---

## 3. 마이그레이션 규율 (운영 권고 #3)

### 3.1 유사 사례 / 산업 패턴

- **Dev.to "Managing DB Migrations"**: Local / Staging / Production 3-tier 워크플로, PR 단위로 각각 `db push --dry-run`으로 사전 검증 ([dev.to](https://dev.to/parth24072001/supabase-managing-database-migrations-across-multiple-environments-local-staging-production-4emg))
- **Supabase CLI Reference — `supabase db diff`**: local이 동기화되지 않으면 diff 자체가 misleading — CI에서 먼저 `db pull` 실행 필요 ([Supabase CLI](https://supabase.com/docs/reference/cli/supabase-db-diff))
- **Discussion #37503 "Professional standard workflow"**: migration 파일에 **숫자 prefix + 의미있는 이름** + "매 배포 시 모든 환경에 같은 순서로 적용" 원칙

### 3.2 pocolush 현재 상태

- 마이그레이션 파일은 `001_init.sql` ~ `019_ensure_trigger.sql`까지 순번 관리 양호
- **그러나 실배포 적용 여부를 자동 검증할 방법이 없음** — 이번 버그 B의 근본 원인
- `supabase link` 안 돼있어 `supabase migration list --linked` 사용 불가 (PAT 필요)
- 로컬 DB 인스턴스 없음 → `supabase db diff` 로컬 기반 검증 불가능

### 3.3 적용안

**① Supabase link 수립 + PAT 발급**
- Vercel secrets에 `SUPABASE_ACCESS_TOKEN` 등록
- `supabase link --project-ref lhuaxmzsvrmjavanunnv` 실행 후 `.git` ignore된 link 파일 생성
- 로컬 개발자는 `supabase start`로 로컬 Postgres 구동 (Docker 필요)

**② README "DB 변경 절차" 섹션 신설**
```markdown
## DB 변경 절차
1. `supabase/migrations/NNN_<name>.sql` 신규 파일 작성
2. `supabase db diff --linked` 로 원격 상태와 차이 확인
3. PR 생성 → GitHub Actions가 `db diff`로 schema drift 자동 체크
4. 머지 후 Supabase Dashboard SQL Editor에서 해당 파일 실행
   또는 `supabase db push` (PAT 필요)
5. `run_schema_integrity_check()` 수동 호출로 트리거/함수 존재 확인
```

**③ GitHub Actions 워크플로 `.github/workflows/supabase-check.yml`**
- PR에 `supabase/migrations/**` 변경 포함되면 트리거
- Jobs: lint / diff / idempotency test (한 번 돌리고 또 돌려서 에러 안 나는지)

**④ Migration 템플릿**
```sql
-- Migration NNN: <title>
-- Idempotent: CREATE OR REPLACE, DROP IF EXISTS, CREATE * IF NOT EXISTS
-- Applied: [by who, when]
-- Rollback: [how to undo]

-- Your SQL here
```

**⑤ 현재 코드베이스 정리**
- `017_membership_issue_v2.sql` 의 RLS/policy 부분은 DROP IF EXISTS + CREATE 이라 재실행 안전
- `019_ensure_trigger.sql` 동일
- 018 도 CREATE OR REPLACE 안전
- 새 migration도 모두 idempotent 준수

---

## 4. 우선순위 및 단계 제안

| Phase | 항목 | 왜 지금 | 난이도 |
|-------|------|---------|-------|
| P0 (즉시) | §1.3 `trigger_error_logs` + 표준 EXCEPTION 패턴 적용 | 이번 버그 발견이 늦었던 근본 원인 | 낮음 (마이그레이션 1건) |
| P0 (즉시) | §2.3 ① `run_schema_integrity_check` + pg_cron 등록 | 트리거 drop 상태 재발 방지 | 중간 (pg_cron 활성 확인 필요) |
| P1 | §1.3 ③ 관리자 진단 UI | 담당자가 에러 즉시 인지 | 중간 (페이지 1개) |
| P1 | §2.3 ② GitHub Actions drift check | 드리프트 조기 감지 | 중간 (Supabase PAT 필요) |
| P2 | §3.3 ① Supabase link + local 개발 | 개발 생산성 + 검증 강화 | 높음 (Docker 환경) |
| P2 | §3.3 ③ CI idempotency test | 장기 운영 안정성 | 중간 |

---

## 5. 참고 자료

- [PostgreSQL 41.9 Errors and Messages](https://www.postgresql.org/docs/current/plpgsql-errors-and-messages.html)
- [EDB — Raise Errors in Stored Procedures](https://www.enterprisedb.com/postgres-tutorials/how-raise-errors-and-report-messages-within-stored-procedures-and-functions)
- [Bytebase — Postgres Audit Logging Guide](https://www.bytebase.com/blog/postgres-audit-logging/)
- [Sehban Alam — Production-Ready Audit Logs](https://medium.com/@sehban.alam/lets-build-production-ready-audit-logs-in-postgresql-7125481713d8)
- [Supabase — Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments)
- [Supabase — Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase — `db diff` CLI Reference](https://supabase.com/docs/reference/cli/supabase-db-diff)
- [Supabase — pg_cron 디버깅 가이드](https://supabase.com/docs/guides/troubleshooting/pgcron-debugging-guide-n1KTaz)
- [Discussion #18483 — Sync local and prod schemas](https://github.com/orgs/supabase/discussions/18483)
- [Discussion #37503 — Professional migration workflow](https://github.com/orgs/supabase/discussions/37503)
- [Supabase Discussion #7061 — Detailed errors from failed triggers](https://github.com/orgs/supabase/discussions/7061)
