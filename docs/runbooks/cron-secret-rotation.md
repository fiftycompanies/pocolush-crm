# Cron Secret Rotation Runbook

## CRON_SECRET 교체 (Vercel Cron)

### 용도
- `/api/cron/expire-memberships` 엔드포인트 인증용
- pg_cron 이관 대상 아님 (Vercel Cron 유지)

### 교체 절차
1. 새 시크릿 생성
```bash
openssl rand -hex 32
```

2. Vercel 환경변수 업데이트
```bash
vercel env rm CRON_SECRET production
vercel env add CRON_SECRET production
# 새 값 붙여넣기
```

3. 재배포
```bash
vercel --prod
```

4. 검증
- 다음 cron 실행 시간까지 대기
- Vercel logs에서 200 응답 확인

## Supabase Vault Secret 교체

### 절차
```sql
-- 기존 삭제
DELETE FROM vault.secrets WHERE name = '<secret_name>';

-- 새 값 등록
SELECT vault.create_secret('<new_value>', '<secret_name>', '<description>');
```

### 주의
- Vault secret은 캐시될 수 있음 (pg_net 호출 시 즉시 반영)
- 교체 직후 pg_cron 작업 수동 실행하여 검증
