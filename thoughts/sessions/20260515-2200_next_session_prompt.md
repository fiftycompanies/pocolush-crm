# 다음 세션 시작 프롬프트 (복사 → 새 Claude 세션에 붙여넣기)

---

## 안내

```
pocolush-crm 이전 세션 (2026-05-15) 이어서 진행할 거야.

먼저 이 3개 파일 읽어서 컨텍스트 복구해:
1. thoughts/sessions/20260515-2200_handover.md  (인계인수서, 가장 먼저)
2. thoughts/sessions/20260515-2130_bbq_phase_abc_session.md  (이번 세션 핵심)
3. thoughts/plans/20260515-2000_backlog_safe_rollout_plan.md  (백로그 플랜)

읽고 나면 운영 체크 4건 먼저 실행해서 결과 보고:

## 운영 체크 1 — 정합성 (Supabase MCP)
```sql
SELECT
  (SELECT COUNT(*) FROM bbq_reservations) AS total,
  (SELECT COUNT(*) FROM bbq_reservations WHERE status='confirmed' AND reservation_date >= CURRENT_DATE) AS future_confirmed,
  (SELECT COUNT(*) FROM audit_logs WHERE action='bbq_board_read' AND created_at > NOW() - INTERVAL '24 hours') AS dedup_check,
  (SELECT COUNT(*) FROM audit_logs WHERE action='bbq_board_unauthorized') AS unauthorized,
  (SELECT COUNT(*) FROM members WHERE status='deleted' AND pii_purged=false) AS mask_pending,
  (SELECT COUNT(*) FROM bbq_reservations r JOIN bbq_facilities f ON f.number=r.bbq_number WHERE f.is_active=false AND r.status IN ('confirmed','completed')) AS rsv_in_inactive_fac;
```

기대:
- dedup_check: < 30 (079 1h dedup 효과 — 이전 일 30+ → 5~10 예상)
- unauthorized: 0
- mask_pending: 0
- rsv_in_inactive_fac: 1 (#5 잔존, 정상)

## 운영 체크 2 — Realtime 401 prod 콘솔 검증

사용자에게 요청: prod 어드민 로그인 후 BBQ 예약 현황 (`/dashboard/bbq-board`) 진입.
F12 콘솔에서 `wss://...realtime/v1/websocket` 401 에러 카운트 확인.
- 0건 → 076 publication 등록 효과 검증 완료
- >0건 → TopBar notifications 채널 setAuth 등 추가 조사

## 운영 체크 3 — 공지 고정해제 재현

prod `/dashboard/notices` → 임의 공지 핀 토글 시도.
정상: "고정 해제됨" / "고정됨" 토스트 + 콘솔 에러 0건.
실패: 토스트 메시지 + 콘솔 에러 보고 → 추가 진단.

## 운영 체크 4 — 모바일 운영자 확인

사용자가 모바일 (768px 이하) 에서 어드민 사용 빈도 확인.
높음 → U2 모바일 햄버거 (P0) 즉시 진행 권고.

---

체크 4건 결과 보고 후 다음 중 원하는 걸로 진행:

(A) **U2 모바일 햄버거** (P0, 0.5일)
   - layout.tsx server/client 분리 + DashboardShell wrapper
   - Sidebar + TopBar 모바일 토글

(B) **A2 13 RPC is_admin() 일괄 통일** (P1, 1일)
   - assert_admin_with_audit 헬퍼는 도입 완료 (078)
   - 13 함수 재정의 — audit 패턴 (3개) + 단순 패턴 (10개)

(C) **U8 native confirm → ConfirmDialog** (P2, 0.5일)
   - 신규 ConfirmDialog 컴포넌트
   - 9 callsite 교체 (feature flag NEXT_PUBLIC_USE_CONFIRM_DIALOG)

(D) **Phase D E2E spec 4건** (P2, 0.5일)
   - H1 회원측 / H4 Realtime / H6 모바일 viewport / H7 KST 자정
   - G8 Playwright 1.59 → 1.60 / G9 CI 야간 자동 (workflow_dispatch + Slack)

(E) **다른 요구사항** (그때 전달)

체크 4건 결과만 먼저 보고하고 시작해.
```

---

## 부가 참고 (복사 불필요)

### 이번 세션 누적 prod 배포 (9 커밋 + 10 마이그레이션)
- `eea1be6` BBQ 보드 + 신청관리 디테일
- `074c13b/090ffa2` 공지 고정해제 P0 hotfix
- `45cd527/ff94042/3fd5f6a` 평상 워딩 + Realtime publication + 회원 잔존
- `79b1f3e` Phase A 9 hotfix
- `f5c9977` Phase B-1 + C Q1~Q6 일괄
- `ca90b0e` 세션 기록

마이그: 072~081 (10건)

### 핵심 상수
- admin: `admin@pocolush.co.kr` / `123456`
- Supabase project: `lhuaxmzsvrmjavanunnv`
- prod URL: https://app.pocolush.com
- 다음 마이그레이션 번호: **082**

### 운영 zone
- A존 (40 farm) / B존 (20 farm) 운영
- C존 + 'ㅇㅇ' 미운영 (is_operational=false)
- BBQ 시설 활성 4 + 비활성 1 (#5 '테스트(예약금지!)')

### 닫힌 백로그 (검수에서 무효 판명)
- B1 auto_complete cron (이미 적용)
- B2 audit_logs 파티셔닝 (5년 ~150MB)
- C1 비활성 시설 #5 정리 (RPC 정상 처리)
- G7 Next.js async params (전제 오류)
