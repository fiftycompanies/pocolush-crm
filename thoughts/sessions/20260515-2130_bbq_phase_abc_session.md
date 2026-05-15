# 세션 기록 — 2026-05-15 BBQ 보드 + 공지 hotfix + 백로그 Phase A/B/C

## 🎯 세션 핵심

연속 세션 단일 흐름:
1. BBQ 존 예약 운영 보드 신설 + 신청관리 디테일 강화
2. 공지 고정 해제 실패 hotfix
3. 8영역 검수 잔여 + 9영역 일괄 hotfix
4. 평상 워딩 통일 + Realtime publication 등록
5. 백로그 8스킬 리서치 + Phase A/B-1/C 일괄 안전 적용

**원칙**: 라이브 서비스 무영향, reversible, downtime 0

---

## 📦 누적 커밋 (8건)

| # | 커밋 | 제목 |
|---|---|---|
| 1 | `eea1be6` | BBQ 보드 신설 + 신청관리 디테일 강화 |
| 2 | `074c13b` | 공지 고정 해제 진단 + UNIQUE 충돌 회피 (P0 hotfix) |
| 3 | `090ffa2` | 핀 트리거 안전망 + StatsCards BBQ 링크 회귀 fix |
| 4 | `45cd527` | 8영역 검수 잔여 항목 일괄 + 워딩 변경 (평상 예약) |
| 5 | `ff94042` | 8스킬 검수 P0 회귀 — 워딩 + Realtime publication 등록 |
| 6 | `3fd5f6a` | 회원/대시보드 잔존 "바베큐" 4곳 추가 |
| 7 | `79b1f3e` | Phase A: 9개 즉시 안전 hotfix (라이브 영향 0) |
| 8 | `f5c9977` | Phase B-1 + C: 보안 + Q1~Q6 권고안 일괄 |

---

## 🗄 마이그레이션 — 10건 prod 적용

```
072 BBQ 운영 보드 RPC (admin only + audit + 시설 OR EXISTS)
073 toggle_notice_pin 진단 강화 + 2단계 shift
074 핀 트리거 2개 동일 패턴 (delete_pin_shift, unpin_on_unpublish)
075 get_bbq_board 슬롯 OR EXISTS (비활성 슬롯 잔존 예약 잠재 보호)
076 supabase_realtime publication 등록 (bbq_reservations + member_notifications + notices)
077 인덱스 정리 + audit_logs created_at 인덱스
078 assert_admin_with_audit 헬퍼 + 3 RPC anon REVOKE
079 bbq_board_read 1시간 dedup (5년 ~80MB, 99% 감축)
080 회원 탈퇴 PII 마스킹 BEFORE UPDATE 트리거
081 bbq_facilities RLS 강화 (비활성 시설 anon 차단)
+ 디스크 070 → 071 리네임 (충돌 해소)
```

---

## 🆕 신규 페이지/컴포넌트

```
신규 (8)
├── app/dashboard/bbq-board/page.tsx       (오늘/내일/주간 3 탭)
├── components/admin-bbq/BoardKpiCard.tsx
├── components/admin-bbq/BoardMatrix.tsx   (시설×타임 매트릭스)
├── components/admin-bbq/BoardWeekTape.tsx (Tape Chart)
├── components/admin-bbq/ReservationSidePanel.tsx (focus trap + audit)
├── lib/use-bbq-board.ts                    (Realtime + 폴링 + retry + visibilitychange)
├── lib/use-media-query.ts
└── e2e/qa-prod-validation.spec.ts

수정 (대규모)
├── lib/use-requests.ts            (bbqMeta + 이벤트 + UnifiedStatus 확장 + setError)
├── app/dashboard/requests/page.tsx (Sentry 2-line + STATUS 8탭 + snap-x + 색 + 가드)
├── app/dashboard/notices/page.tsx (error 진단 + 토스트 4초)
├── components/layout/Sidebar.tsx  (메뉴 라벨 + 아이콘 + ALL_NAV_HREFS DRY)
├── components/dashboard/StatsCards.tsx (BBQ 칩 confirmed + 카드 본체 정리)
└── 회원측 워딩 6 파일 (바베큐 → 평상)
```

---

## 🛡 보안 강화 (이번 세션)

| 항목 | 변경 |
|---|---|
| Realtime auth | `setAuth(session.access_token)` (use-bbq-board.ts) |
| Realtime publication | bbq_reservations + member_notifications + notices 등록 |
| admin only RPC | `get_bbq_board` + `toggle_notice_pin` + `reorder_notice_pins` anon REVOKE |
| PIPA audit | `assert_admin_with_audit()` 헬퍼 + 1h dedup |
| 비활성 시설 RLS | anon 차단 (admin/approved 회원만) |
| 회원 탈퇴 PII | DB 트리거 자동 마스킹 (앱 의존 제거) |

---

## 📊 데이터 검증 (Supabase MCP 실측)

- bbq_reservations: 25 → 29 (정상 누적, 보호 장치 모두 유지)
- audit_logs: 211 → 일 ~30 (5년 후 ~150MB, 파티셔닝 불필요)
- bbq_board_read 1h dedup 적용 (99% 감축 예상)
- 비활성 시설 잔존 예약: 1건 (RPC OR EXISTS 처리)
- 비활성 슬롯 잔존 예약: 0건
- members.status='deleted': 0건 (마스킹 트리거 영향 0)
- get_bbq_board grants: authenticated/postgres/service_role (anon ✗)

---

## ✅ QA prod E2E (Playwright)

```
6/8 passed / 2 skip (조건부 데이터)

✓ 공지 고정 토글 hotfix (outcome: success)
✓ BBQ 보드 KPI + 매트릭스 (평상 예약 현황)
⊘ 사이드 패널 (오늘 confirmed 0건)
✓ 이번 주 Tape Chart
✓ 신청관리 BBQ Sentry 2-line
✓ STATUS 예약완료/노쇼 탭
✓ 사이드바 평상 메뉴 3개
⊘ StatsCards BBQ 칩 (pendingBBQ 0건)
```

스크린샷 8장 `/tmp/qa-*.png`

---

## 🟡 별도 PR 권고 (작업량 큰 항목)

1. **U2 모바일 햄버거** — layout.tsx server/client 분리 + DashboardShell wrapper (0.5일)
2. **U8 native confirm → ConfirmDialog** — 신규 컴포넌트 + 9 callsite (0.5일)
3. **Phase D E2E spec 4건** — 회원/Realtime/모바일/KST 자정 (0.5일)
4. **G8 Playwright 1.59 → 1.60** (0.25일)
5. **G9 CI 야간 자동 E2E** (0.25일)
6. **A2 13 RPC `is_admin()` 일괄 통일** — assert_admin_with_audit 도입 완료, 함수 재정의 PR (1일)

---

## 🟢 닫힌 백로그 (검수 결과 무효)

| 항목 | 사유 |
|---|---|
| B1 auto_complete cron | 이미 `run_daily_auto_expiry()` 내부 호출 |
| B2 audit_logs 파티셔닝 | 5년 후 ~150MB, 불필요 |
| C1 비활성 시설 #5 정리 | RPC OR EXISTS 가 정상 처리 |
| G7 Next.js async params | 전제 오류 (`URL.searchParams.get` 패턴, dynamic params 와 무관) |

---

## 🧠 검수 활용

- **5축 병렬 검수** (보안+RLS / QA·데이터 / UIUX·접근성 / 성능 / 통합·회귀) — 25건 발견
- **4축 백로그 리서치** (보안+아키 / 데이터+성능 / UIUX+PM / 풀스택+QA)
- Supabase MCP 직접 검증 + 코드 grep + 파일 read 로 추측 회피

---

## 🎨 UX 결정 적용

- Q1: 070 디스크 → 071 리네임 ✓
- Q2: bbq_board_read 1h dedup ✓
- Q3: 스토어 색 amber 복구 ✓
- Q4: 평상 워딩 유지 ✓
- Q5: 탈퇴 마스킹 DB 트리거 ✓
- Q6: 비활성 시설 anon 차단 ✓

---

## 📋 운영 잔존 (다음 세션 후보)

- Realtime 401 prod 콘솔 효과 재측정 (076 적용 후)
- Sentry breadcrumb 모니터링 (1주 burn-in)
- Phase D E2E + CI 야간 자동
- audit_logs 1h dedup 효과 측정 (일 30 → 5 예상)
- 모바일 햄버거 (P0 모바일 운영자 차단 해소)

---

## 핵심 상수

- admin 계정: `admin@pocolush.co.kr` / `123456`
- Supabase project: `lhuaxmzsvrmjavanunnv`
- 활성 BBQ: 4 시설 + 비활성 1 / 활성 슬롯 3
- 마이그 누적: 072~081 (10건)
- 라이브 사용자: 회원 60+ approved, admin 1+
- 다음 마이그 번호: **082**
