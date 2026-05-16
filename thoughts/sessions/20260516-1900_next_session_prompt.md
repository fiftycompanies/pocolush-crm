# 다음 세션 시작 프롬프트

---

## 안내

```
pocolush-crm 이전 세션 (2026-05-16 19:00) 이어서 진행할 거야.

먼저 이 4개 파일 읽어서 컨텍스트 복구:
1. thoughts/sessions/20260516-1900_handover.md      (인계인수서, 가장 먼저)
2. thoughts/sessions/20260516-1900_session_record.md (세션 기록)
3. thoughts/plans/20260516-1530_residual_backlog_4items_plan.md (Realtime 401 옵션 2 참조)
4. thoughts/plans/20260516-1730_farms_board_and_management_pivot_plan.md (농장 현황 — 구현 완료, Phase 2 후속)

읽고 운영 정합성 SQL 실행 후 결과 보고:

## 운영 체크
```sql
SELECT
  (SELECT COUNT(*) FROM bbq_reservations) AS bbq_total,
  (SELECT COUNT(*) FROM farms WHERE deleted_at IS NULL) AS farms_total,
  (SELECT COUNT(*) FROM memberships WHERE status='active') AS memberships_active,
  (SELECT COUNT(*) FROM memberships WHERE status='active' AND end_date <= CURRENT_DATE + INTERVAL '30 days') AS expiring_30d,
  (SELECT COUNT(*) FROM audit_logs WHERE action='bbq_board_read' AND created_at > NOW() - INTERVAL '24 hours') AS dedup_check,
  (SELECT COUNT(*) FROM audit_logs WHERE action='bbq_history_search' AND created_at > NOW() - INTERVAL '24 hours') AS hist_dedup,
  (SELECT COUNT(*) FROM audit_logs WHERE action LIKE '%_unauthorized') AS unauthorized_total,
  (SELECT COUNT(*) FROM bbq_facilities WHERE name ILIKE 'QATEST_%') AS test_residue;
```

기대: farms_total 60 / memberships_active 34+ / dedup_check < 30 / test_residue 0

체크 통과 후 다음 4안 중 선택:

---

## (A) 🔴 P0: Realtime 401 옵션 2 (1h)

3차 시도 후에도 28건 잔존. 옵션 2 = localStorage 동기 읽기로 initial token 보장.

lib/supabase/client.ts 에서:
- supabase storage key: sb-<projectRef>-auth-token (lhuaxmzsvrmjavanunnv)
- localStorage.getItem(key) → JSON.parse → access_token
- createBrowserClient global headers 또는 realtime params 로 전달

검증: prod /dashboard/bbq-board 5s 진입 → socketerror 0 기대 (이전 16-28건)

---

## (B) 🟡 P1: U2 모바일 햄버거 활성화 (5m)

5/22 burn-in 완료 시 (오늘 5/22 이상이면):
printf "1" | vercel env add NEXT_PUBLIC_SIDEBAR_MOBILE_V2 production
vercel deploy --prod --yes

검증: 모바일 375 viewport 햄버거 토글 + 사이드바 translate-x-0

---

## (C) 🟢 P2: 농장 현황 §이력 검색 (BBQ 패턴 답습, 4h)

평상 예약 이력 검색과 동일 패턴:
- 마이그 085: search_farm_rentals_history RPC
- 컴포넌트 3개 (FarmHistorySection / HistoryFilterBar / HistoryList)
- /dashboard/farms-board 하단 추가

기간 + 임차인 검색 + 상태 필터 + 페이지네이션

---

## (D) 🟢 P2: get_farms_board RPC 분리 (2h)

useFarms 가 4 Promise.all (무거움) → /farms-board 전용 RPC 분리:
- 마이그 086 get_farms_board() RPC (admin only + PIPA audit 1h dedup)
- useFarmsBoard 신규 훅
- /farms-board 만 영향 (기존 /farms 는 useFarms 그대로)

---

권고 순서: (A) Realtime 401 옵션 2 → (B) U2 활성화 (5/22 후) → (C) 또는 (D)
또는 "권고대로" 답변하면 (A) → (B) 순차 진행.
```

---

## 부가 참고

### 이번 세션 prod 배포 (10 커밋 + 4 마이그)
- b0701b9 / 38630f0 / 9de7b51 (Plan B 3 잔존)
- b3b5c3d / 40e2669 (평상 이력 검색 + 082b hotfix)
- 7bc7729 / 676aaef / 2d6dce8 (PR 1-3 잔존 백로그)
- 6edb9a8 / 2eeb431 / a0b0c2e (농장 현황 + view 갱신)

### 핵심 상수
- admin: admin@pocolush.co.kr / 123456
- Supabase project: lhuaxmzsvrmjavanunnv
- prod URL: https://app.pocolush.com / https://www.pocolush.com
- 다음 마이그 번호: **085**
- Vercel CLI 권고: 54.1.0

### 운영 데이터 (19:00)
- 농장 60 (A존 40 + B존 20) / 활성 34 / 만료 30일 0
- BBQ 30 / 평상 1상품 / 이벤트 1
- audit_logs 250+ row (079 1h dedup 정상)

### 사이드바 V2 (활성)
[일별 운영] 대시보드 / 농장 현황 / 평상 현황 / 신청 관리 / 문의 관리
[회원] 회원 / 회원권 / 공지
[자원·시설] 농장 관리 / 임대 계약 / 평상 설정
[상거래] 스토어 / 플랜 / 쿠폰
[콘텐츠] 블로그
[시스템 하단] 경고 / 감사 로그 / 알림 설정 / 설정

### 닫힌 백로그 (이번 세션)
- 평상 메뉴 페이지 통합 (이전 세션) ✓
- 평상 이력 검색 (마이그 082+082b) ✓
- 13 RPC is_admin 통일 (마이그 083) ✓
- 농장 현황 페이지 + 사이드바 순서 + 관리하기 (마이그 084) ✓
- React #418 (커밋 38630f0) ✓
- nested Link (커밋 b0701b9) ✓

### 미해결 (다음 세션)
- ⚠ Realtime 401 (3차 시도 후에도 잔존) — 옵션 2 (localStorage 동기 읽기)

### Phase 2 후보
- 농장 현황 §이력 검색 (Plan §10)
- get_farms_board RPC 분리 (Plan §10)
- 만료 임박 7일/30일 단계 분리
