# 다음 세션 시작 프롬프트

---

## 안내

```
pocolush-crm 이전 세션 (2026-05-16 22:00) 이어서 진행할 거야.

먼저 이 4개 파일 읽어서 컨텍스트 복구:
1. thoughts/sessions/20260516-2200_handover.md         (인계인수서, 가장 먼저)
2. thoughts/sessions/20260516-1900_handover.md         (이전 세션 인계)
3. thoughts/plans/20260516-2000_realtime_401_and_farms_rpc_plan.md
4. thoughts/research/20260516-1930_realtime_401_deep_and_farms_rpc_research.md

읽고 운영 정합성 SQL 실행 후 결과 보고:

## 운영 체크
```sql
SELECT
  (SELECT COUNT(*) FROM bbq_reservations) AS bbq_total,
  (SELECT COUNT(*) FROM farms WHERE deleted_at IS NULL) AS farms_total,
  (SELECT COUNT(*) FROM memberships WHERE status='active') AS memberships_active,
  (SELECT COUNT(*) FROM memberships WHERE status='active' AND end_date <= CURRENT_DATE + INTERVAL '30 days') AS expiring_30d,
  (SELECT COUNT(*) FROM audit_logs WHERE action='bbq_board_read' AND created_at > NOW() - INTERVAL '24 hours') AS dedup_check,
  (SELECT COUNT(*) FROM audit_logs WHERE action='farms_board_view' AND created_at > NOW() - INTERVAL '24 hours') AS farms_dedup,
  (SELECT COUNT(*) FROM audit_logs WHERE action LIKE '%_unauthorized') AS unauthorized_total,
  (SELECT COUNT(*) FROM bbq_facilities WHERE name ILIKE 'QATEST_%') AS test_residue;
```

기대: farms_total 60 / memberships_active 34+ / dedup_check < 30 / unauthorized_total 0 / test_residue 0

체크 통과 후 다음 4안 중 선택:

---

## (A) 🔵 P2: Realtime 401 옵션 (C) — Supabase Dashboard Realtime Authorization 점검 (1h)

6차 시도 (옵션 7) 후에도 5건 잔존. **WebSocket upgrade 자체 401** (sent/received frames 0).
client-side 옵션은 모두 시도 완료. 진짜 원인은 server-side.

Dashboard 점검 항목:
- Project Settings → API → Realtime authorization 정책
- Authentication → Settings → JWT signing key rotation 이력
- Realtime → Settings → channel access control
- (가능 시 Supabase project 의 anon key 재발급)

risk: 운영 영향 MID — 변경 전 백업 + 회원 측 회귀 검증 필수

---

## (B) 🔵 P2: Realtime 401 옵션 (D) — Supabase support / GitHub issue 등록 (30m)

자체 진단 결과 패키지화 + Supabase support 문의:
- 6차 시도 코드 + 결과 매트릭스
- diagnose-channel-join.mjs (이번 세션 삭제됨, 필요 시 재작성)
- console.log + WebSocket frame 캡처
- Publication / RLS 정책 SQL 결과

risk: 0 (외부 문의만)

---

## (C) 🟢 P3: TopBar `notifications` → `member_notifications` 정합성 fix (15m)

components/layout/TopBar.tsx line 65:
- `.channel('notifications').on('postgres_changes', { table: 'notifications' })`
- publication 에는 `member_notifications` 만 있음 → 현재 무용 채널

수정: `notifications` → `member_notifications` (실제 구독 작동)
영향: 실제 알림 toast 활성화

---

## (D) 🟢 P2: 농장 현황 §이력 검색 섹션 (BBQ 패턴 답습, 4h)

평상 예약 이력 검색과 동일 패턴:
- 마이그 086: search_farm_rentals_history RPC
- 컴포넌트 3개 (FarmHistorySection / HistoryFilterBar / HistoryList)
- /dashboard/farms-board 하단 추가

기간 + 임차인 검색 + 상태 필터 + 페이지네이션

---

권고 순서: (B) 외부 문의 → (C) 정합성 fix → (D) 농장 이력 검색 → (A) Realtime Dashboard (수정 risk)
또는 "권고대로" 답변하면 (B) → (C) → (D) 순차 진행.
```

---

## 부가 참고

### 이번 세션 prod 배포 (5 커밋 + 1 마이그)
- 97d4a72 옵션 5 (3건)
- ea11c10 마이그 085 + useFarmsBoard ✅
- 5cde1b3 옵션 6 (6건, access_token URL 주입 성공)
- 01c7f03 옵션 7 (5건, realtime-js 표준 흐름)
- a6af5eb TruffleHog 이벤트별 base/head 분기 ✅

### 핵심 상수
- admin: admin@pocolush.co.kr / 123456
- Supabase project: lhuaxmzsvrmjavanunnv
- prod URL: https://app.pocolush.com / https://www.pocolush.com
- 다음 마이그 번호: **086**

### 운영 데이터 (22:00)
- 농장 60 / 활성 34
- BBQ 30+ / 평상 1상품 / 이벤트 1
- audit_logs farms_board_view 1h dedup 정상
- audit_logs farms_board_unauthorized 0건

### Realtime 401 결과 매트릭스 (참조)
```
1차 8 → 2차 16 → 3차 28 → 4차 3 → 5차 6 → 6차 5 (옵션 7 채택)
28건 → 5건 (82% 감소)
WebSocket upgrade 자체 401 (sent/received frames: 0)
→ client-side 한계 도달, server-side 점검 필요
```

### 닫힌 백로그 (이번 세션)
- 농장 보드 RPC 분리 (마이그 085) ✓
- Realtime 401 옵션 5/6/7 (3차 추가 시도) ✓ (82% 감소)
- TruffleHog 이벤트별 base/head 분기 ✓

### 미해결 (다음 세션)
- ⚠ Realtime 401 server-side 진단 (옵션 C/D)
- TopBar notifications 정합성 fix
- 농장 현황 §이력 검색 (Phase 2)
- 만료 임박 7일/30일 단계 분리 (Phase 2)
