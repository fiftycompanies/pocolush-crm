# Migration Rollback Runbook

## 마이그레이션 롤백 절차

### 1. 롤백 가능 여부 판단
- 데이터 손실 가능성 확인
- 종속 마이그레이션 확인 (§3 의존성 그래프)

### 2. 045 Revert 플레이북
```sql
-- 045_revert_notice_push.sql
-- 선택적 실행 — 비상 시에만

-- 1. feature_flags 비활성
UPDATE feature_flags SET enabled = false WHERE name = 'send_notice_push_enabled';

-- 2. RPC 삭제 (필요 시)
DROP FUNCTION IF EXISTS send_notice_push(BIGINT, TEXT);

-- 3. 테이블은 유지 (데이터 보존)
```

### 3. 일반 마이그레이션 롤백
```sql
-- 테이블 삭제 (빈 테이블만)
DROP TABLE IF EXISTS <table_name>;

-- 컬럼 삭제
ALTER TABLE <table> DROP COLUMN IF EXISTS <column>;

-- RLS 정책 삭제
DROP POLICY IF EXISTS <policy_name> ON <table>;
```

### 4. pg_cron 작업 제거
```sql
SELECT cron.unschedule('<job_name>');
```

### 주의사항
- Production에서 `DROP TABLE` 전 반드시 백업 확인
- 트랜잭션 내에서 실행 (가능한 경우)
- audit_logs에 롤백 기록
