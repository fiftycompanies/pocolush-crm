# Observability Escalation Runbook

## 알람별 대응 (pg_cron A1~A5)

### A1. opt-out 비율 > 30%
- **확인**: notification_preferences 테이블 카테고리별 비율
- **조치**: UX 검토, 공지 빈도 조절
- **에스컬레이션**: 50% 초과 시 알림 전략 재검토

### A2. RPC 에러율 급증 (Phase 3a 이후)
- **확인**: Sentry → pocolush-web 프로젝트
- **조치**: feature_flags 킬 스위치
- **에스컬레이션**: 5분 내 미해결 시 `vercel rollback`

### A3. cron sample_match < 5 (3회 연속)
- **확인**: cleanup_logs 최근 3건
- **조치**: Storage 버킷 구조 변경 여부 확인
- **에스컬레이션**: cron.unschedule 후 수동 점검

### A4. CSP enforce 위반 감지
- **확인**: csp_violations 테이블 최근 위반
- **조치**: CSP 정책 allowlist 업데이트
- **에스컬레이션**: 위반 급증 시 Report-Only로 일시 전환

### A5. 알림톡 실패율 > 10%
- **확인**: notification_logs WHERE channel='alimtalk' AND status='failed'
- **조치**: 알리고 API 상태 확인, API 키 유효성
- **에스컬레이션**: 30% 초과 시 알림톡 임시 중단

## 모니터링 도구 접근
| 도구 | URL | 용도 |
|------|-----|------|
| Sentry | sentry.io → fiftycompanies/pocolush-web | 에러 추적 |
| Axiom | axiom.co → pocolush-logs | 로그 |
| UptimeRobot | uptimerobot.com | 가동률 |
| Slack #alerts | Slack 워크스페이스 | 알림 수신 |
