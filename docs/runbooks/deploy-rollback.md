# Deploy Rollback Runbook

## Vercel 롤백
```bash
# 최근 배포 목록
vercel ls

# 이전 배포로 롤백
vercel rollback
```

## RPC 장애 시 킬 스위치
```sql
-- feature_flags에서 비활성화
UPDATE feature_flags SET enabled = false WHERE name = 'send_notice_push_enabled';
```

## 배포 시간대
- 화~목 14~17 KST
- Phase 2a 마이그: 수요일 오전 (48h 관찰 확보)
- Phase 3a RPC: 수요일 14시

## 롤백 판단 기준
- Sentry 에러율 5배 증가
- API 응답시간 2초 초과
- UptimeRobot DOWN 알림
