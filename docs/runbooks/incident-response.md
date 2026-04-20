# Incident Response Runbook

## PIPA 침해 72h 통지 절차

### 1. 감지
- Sentry alert / Axiom 이상 로그 / UptimeRobot DOWN
- Slack #alerts 채널 확인

### 2. 분류 (15분 이내)
| 레벨 | 기준 | 대응 |
|------|------|------|
| P0 | 개인정보 유출, 서비스 전면 중단 | 즉시 대응, PIPA 72h 통지 |
| P1 | 일부 기능 장애, 데이터 정합성 | 1시간 내 대응 |
| P2 | 성능 저하, 비핵심 기능 | 영업일 내 대응 |

### 3. PIPA 침해 통지 (P0)
- [ ] 개인정보보호위원회 72시간 내 통지
- [ ] 정보주체 통지 (이메일/SMS)
- [ ] 침해 범위 파악 (영향받은 레코드 수)
- [ ] 로그 보존 (audit_logs + Axiom)

### 4. 복구
- Vercel: `vercel rollback`
- DB 마이그: migration-rollback.md 참조
- RPC: feature_flags 킬 스위치

### 5. 사후 분석
- [ ] 타임라인 작성
- [ ] 근본 원인 분석
- [ ] 재발 방지 대책
