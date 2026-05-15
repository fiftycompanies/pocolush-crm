# 백로그 안전 적용 플랜 v1 (라이브 무영향 설계)

> 작성일: 2026-05-15
> 검수: 4 에이전트 병렬 (보안+아키텍처 / 데이터+성능 / UIUX+PM / 풀스택+QA) + Supabase MCP 실측
> 제약: **라이브 서비스 절대 무영향**, downtime 0, 데이터 손실 0, 즉시 롤백 가능
> 상태: **사용자 결정 대기**

---

## 0. 실측 사실 (검수 전제)

| 항목 | 사실 | 출처 |
|---|---|---|
| audit_logs 규모 | 211 row, 176KB, 일 ~30건 | Supabase MCP |
| bbq_board_read 추세 | 23건/24h (admin 1명, 시간당 ~1건) | MCP |
| bbq_board_unauthorized | **0건 (7일)** | MCP |
| 5년 후 audit_logs 예상 | ~150MB → **파티셔닝 불필요** | 계산 |
| 비활성 시설 잔존 예약 | 1건 (completed, 데이터 정리 불필요) | MCP |
| 비활성 슬롯 잔존 예약 | 0건 | MCP |
| `members.status='deleted'` | 0건 (마스킹 미발현) | MCP |
| `is_admin()` 헬퍼 | **이미 존재** (063 마이그) | MCP |
| `auto_complete_reservations` cron | **이미 `run_daily_auto_expiry()` 내부 호출 중** (15:00 UTC) | pg_cron |
| Realtime publication | bbq_reservations + member_notifications + notices 등록 | MCP (076) |
| `get_bbq_board` 권한 | PUBLIC + anon + authenticated 모두 EXECUTE | MCP |
| `members.pii_purged` 플래그 | 존재 (063 추가) | MCP |
| `bbq_facilities_public_read` | `USING (true)` — 회원이 비활성 시설명 조회 가능 | MCP |

→ 검수에서 **백로그 4건이 사실상 이미 완료/불필요** 판명:
- B1 auto_complete cron: **닫음** (이미 등록 동작 중)
- B2 audit_logs 파티셔닝: **불필요** (5년 후도 150MB 수준)
- C1 비활성 시설 #5 데이터 정리: **불필요** (RPC OR EXISTS 가 정상 처리)
- G7 Next.js 16 async params: **전제 재확인 필요** (`export/route.ts:18` 라인은 `URL.searchParams.get()` 패턴, dynamic params 와 무관)

---

## 1. 🟢 즉시 안전 묶음 (P0/P1, 라이브 영향 0)

**한 PR 로 묶어서 즉시 배포 가능**. 모든 항목 1-line 또는 작은 변경, runtime 영향 0, vercel rollback 1-click.

| # | 항목 | 변경 위치 | 변경 |
|---|---|---|---|
| **U1** | StatsCards 카드 본체 Link 정리 | `components/dashboard/StatsCards.tsx:40` | `?status=pending` → `/dashboard/requests` (상태 제거) |
| **U5** | Toast duration 일관성 | `app/dashboard/notices/page.tsx:105` | `duration: 10000` 제거 (기본 4초) |
| **U10** | disabled opacity 가독성 | 3 파일 (NoticeImageDropzone, DeleteMemberModal) | `opacity-30` → `opacity-50` |
| **U6** | STATUS 8탭 모바일 snap | `app/dashboard/requests/page.tsx:235` | `overflow-x-auto` → `overflow-x-auto snap-x snap-mandatory` + button `snap-start` |
| **G2** | UnifiedStatus exhaustive | `lib/use-requests.ts` + `app/dashboard/requests/page.tsx` | `satisfies Record<UnifiedStatus, ...>` 추가 |
| **G3** | use-requests setError UI | `lib/use-requests.ts` (반환 타입) + `app/dashboard/requests/page.tsx` (배너) | bbq-board 패턴 답습 |
| **D2** | unused 인덱스 DROP | DB | `DROP INDEX CONCURRENTLY idx_bbq_reservations_date_slot_facility` (idx_scan=0, 16KB 회수) |
| **D5** | visibilitychange 핸들러 | `lib/use-bbq-board.ts` | sleep/wake 후 채널 재구독 + Sentry breadcrumb |
| **idx** | audit_logs `created_at` 인덱스 | DB | `CREATE INDEX CONCURRENTLY idx_audit_logs_created_at ON audit_logs(created_at DESC)` |

**예상 변경량**: 코드 ~15 line + 마이그레이션 1 (077)
**라이브 영향**: 0 (모두 reversible)
**소요**: 30분

---

## 2. 🟡 점진적 적용 (feature flag + 1주 burn-in)

별도 PR. canary 적용 후 burn-in.

### 2.1 U2 모바일 햄버거 (P0)
- 현재 `app/dashboard/layout.tsx` 의 Sidebar 고정 → 768px 이하 본문 가림
- 변경:
  - `Sidebar.tsx` className: `fixed -translate-x-full md:translate-x-0 transition-transform`
  - `layout.tsx` `marginLeft` → `md:ml-64 ml-0`
  - `TopBar.tsx` 햄버거 버튼 (md:hidden) + backdrop overlay
- feature flag: `NEXT_PUBLIC_SIDEBAR_MOBILE_V2=1` (default off) → 1주 후 default on
- 영향: 데스크탑 0, 모바일 운영자 해소
- 롤백: env flag off

### 2.2 U8 native confirm → ConfirmDialog (P1)
- 9 파일 native `confirm()` → `<ConfirmDialog>` 컴포넌트
- feature flag: `NEXT_PUBLIC_USE_CONFIRM_DIALOG=1`
- 신규 컴포넌트 1 (~80 LOC) + 9 callsite 교체
- 영향: 운영자 동작 패턴 5분 학습 비용. 모바일 UX ↑↑.
- 롤백: env flag off

### 2.3 A2 모든 RPC `is_admin()` 통일 (P1)
- 13 함수 인라인 admin 체크 → `public.is_admin()` 호출
- **그러나 `get_bbq_board` 의 audit 로깅 보존 필수** → 새 헬퍼 권고:
  ```sql
  CREATE FUNCTION assert_admin_with_audit(p_action text, p_resource text, p_metadata jsonb) ...
  ```
- 변경: 13 함수의 `CREATE OR REPLACE FUNCTION` 일괄 PR
- 영향: 함수 객체 ms 단위 lock, 진행 호출은 기존 plan 으로 끝까지 실행 → 사용자 체감 0
- 롤백: `pg_dump --schema-only --section=post-data` 백업 후 재정의
- **사용자 결정**: assert_admin_with_audit 헬퍼 도입 여부

### 2.4 A8 `get_bbq_board` anon EXECUTE REVOKE (P1)
- 현재 `PUBLIC + anon + authenticated` 모두 EXECUTE
- 변경: `REVOKE EXECUTE ON FUNCTION get_bbq_board FROM anon, PUBLIC;`
- 영향: anon 호출 경로 grep 선행 필수 (현재 코드는 admin 로그인 후만 호출, 영향 0 예상)
- 롤백: `GRANT EXECUTE TO anon;`

---

## 3. 🔴 사용자 결정 필요 (별도 PR)

### 3.1 G6: 070 마이그레이션 디스크 정리 (P1, **결정 필요**)
- 디스크 `070_farm_rentals_add_pending_status.sql` vs prod `070_self_service_withdrawal` 충돌
- **현재 prod `farm_rentals_status_check`** 는 `pending` 포함 → 별도 작업으로 적용된 것으로 보임
- 결정 옵션:
  - **(A)** 디스크 070 파일 → 071 또는 077로 리네임 (적용 흔적 보존)
  - **(B)** 디스크 070 파일 삭제 (이미 prod 반영됨)
- 권고: (A) 077 로 리네임 + 헤더에 "prod 반영 완료" 주석

### 3.2 B5: `bbq_board_read` audit 정책 (P1, **결정 필요**)
- 현재 RPC 호출마다 audit INSERT → 5년 후 admin 5명 × 5분 폴링 시 ~2GB
- 옵션:
  - **(1)** RPC 에서 audit INSERT 제거 — PIPA 감사 정책 검토 필요
  - **(2)** 1시간/세션 단위 dedup (99% 감축 + 감사 추적 유지) ⭐ 권고
  - **(3)** 클릭 액션만 `bbq_cell_click` 으로 별도 추적, board_read 제거
- 권고: **옵션 2** (1시간 dedup)

### 3.3 U3: 스토어 색상 통일 (P2, **결정 필요**)
- 현재: 신청관리(sky) vs 대시보드 KPI(amber) vs 회원(amber) — 3 vs 1
- 옵션:
  - **(A)** amber 복구 (`requests/page.tsx:16,34` sky → amber) ⭐ 권고 — 회원 영향 0, 어드민 1페이지만 변경
  - **(B)** sky 통일 (4곳 amber → sky) — 회원 시각 변경
- 권고: **(A) amber 복구**

### 3.4 F4: 회원측 "평상" vs "바베큐" 결정 (P1, **사용자 검증 필요**)
- 현재 회원측 페이지 워딩은 모두 "평상" 으로 변경 완료 (이번 세션)
- 회원 친숙도 검증 필요 — 소수 회원 인터뷰 권고
- 옵션:
  - **(A)** "평상" 유지 (어드민/회원 일관) ⭐
  - **(B)** "바베큐" 복구 (회원 친숙)
  - **(C)** A/B 1주 모니터링 후 결정

### 3.5 C5: 회원 탈퇴 마스킹 DB 트리거 (P2, **결정 필요**)
- 현재 앱 레이어 마스킹 의존, members.status='deleted' 0건 (미발현)
- 변경: BEFORE UPDATE 트리거 (`pii_purged` 플래그 활용)
- 영향: 모든 UPDATE members 에 µs 단위 오버헤드 (현 트래픽 무영향)
- 위험: 앱 레이어 마스킹과 충돌 가능성 검토 필요
- 권고: **canary 검증 후 도입**

### 3.6 C7: 비활성 시설 anon 노출 정책 (P2, **결정 필요**)
- 현재 `bbq_facilities_public_read USING (true)` — 비회원도 비활성 시설명 조회 가능
- 비즈니스 결정:
  - **(A)** 유지 (캠핑장 안내 일부) — 권고 없음
  - **(B)** `USING (is_active=true OR is_admin())` 로 변경 ⭐ 권고 — 비활성 시설 1개라 영향 미미
- pocolush-site (공개 웹사이트) 의 시설 표시 코드 영향 점검 필요

### 3.7 A3: `bbq_board_unauthorized` Slack 알림 (P2, 결정 가능)
- 현재 0건 → 트래픽 0
- Vercel cron 5분 폴링 패턴 vs pg_net (extension 활성화 검토 필요)
- 권고: Vercel cron 패턴 (간단, 외부 extension 의존 X)

### 3.8 F1: 사이드바 그룹화 (P2, 결정 가능)
- 평상 메뉴 3개 들여쓰기 + 라벨 단축
- 영향: 운영자 학습 비용 (-) vs 정보 밀도 (+)
- 권고: 다음 PR

---

## 4. ⚪ E2E spec 추가 (P2/P3, 즉시 안전)

| # | spec | 검증 | 라이브 영향 |
|---|---|---|---|
| H1 | `member-reservation-flow.spec.ts` | 회원측 페이지 read-only 가시성 | 0 |
| H4 | `realtime-board-sync.spec.ts` | 2 context Realtime 갱신 | staging only (write) |
| H6 | `mobile-viewport.spec.ts` | 375x812 bottom-sheet + STATUS 탭 | 0 |
| H7 | `kst-midnight-boundary.spec.ts` | Date stub deterministic | 0 |
| **G9** | CI 야간 자동 (read-only) | `.github/workflows/e2e-nightly.yml` | 0 (ALLOW_PROD_WRITE=no) |
| **G8** | Playwright 1.59 → 1.60 업그레이드 | package.json | 0 (changelog 검토 후) |

---

## 5. 적용 순서 (의존성 그래프)

```
Week 1 ── 🟢 즉시 안전 묶음 (Phase A) ────────────────────────────┐
  Day 0    U1, U5, U10, U6, G2, G3, D2, D5, audit idx 인덱스 │
  Day 1    burn-in 모니터링 (Sentry/Axiom 1일)                │
           │                                                  │
           ├─→ 🟡 점진적 적용 (Phase B canary)                │
           │     Day 2: U2 햄버거 flag 5% canary               │
           │     Day 5: U8 ConfirmDialog flag on              │
           │     Day 7: A2 is_admin 통일 (assert_admin_with_audit) │
           │     Day 7: A8 anon REVOKE (코드 grep 후)         │
           │                                                  │
           └─→ 🔴 사용자 결정 의존 (Phase C)                  │
                 Q1 결정 후: G6 070 정리                       │
                 Q2 결정 후: B5 옵션 적용                      │
                 Q3 결정 후: U3 색 통일                        │
                 Q4 결정 후: F4 워딩 정책                      │
                 Q5 결정 후: C5 마스킹 트리거                  │
                 Q6 결정 후: C7 RLS 조정                       │

Week 2 ── E2E spec 추가 + CI 야간 자동
```

---

## 6. 사용자 결정 필요 (Q1~Q6)

곧바로 **Phase A (즉시 안전)** 적용 가능. Phase B 진입 전 Q1~Q6 결정 부탁드립니다:

| Q | 항목 | 옵션 | 권고 |
|---|---|---|---|
| **Q1** | 070 마이그레이션 디스크 파일 | (A) 077로 리네임 / (B) 삭제 | A ⭐ |
| **Q2** | `bbq_board_read` audit 정책 | (1) 제거 / (2) 1h dedup / (3) 클릭만 | 2 ⭐ |
| **Q3** | 스토어 색 통일 | (A) amber 복구 / (B) sky 통일 | A ⭐ |
| **Q4** | "평상" vs "바베큐" | (A) 평상 유지 / (B) 바베큐 복구 / (C) A/B 모니터 | A ⭐ |
| **Q5** | 탈퇴 마스킹 트리거 | 도입 여부 (canary 검증 후) | 도입 ⭐ |
| **Q6** | 비활성 시설 anon 노출 | (A) 유지 / (B) admin/회원만 | B ⭐ |

---

## 7. 롤백 시나리오 (각 Phase 별)

| Phase | 롤백 방법 | 소요 |
|---|---|---|
| A (즉시 안전) | `vercel rollback` 1-click | 1분 |
| B canary | env flag off | 즉시 |
| C DB | `DROP FUNCTION/INDEX` + `pg_dump` 복원 | 5분 |
| 077 마이그레이션 디스크 | `git revert` | 즉시 |

---

## 8. 1주 burn-in 모니터링

| 메트릭 | 임계 | 대응 |
|---|---|---|
| Sentry `lib/use-requests` 에러 | 베이스 +20% | G3 롤백 |
| `/dashboard/requests` 5xx | >1% | 즉시 조사 |
| Realtime 401 콘솔 (076 적용 후) | >0건 | 클라이언트 추가 조사 |
| `bbq_board_unauthorized` audit | >0건 | Slack 알림 + 보안 점검 |
| TTI p95 `/dashboard/bbq-board` | +30% | D5/D1 검토 |
| `audit_logs` 일 증가 | >100 | B5 dedup 재검토 |

---

## 9. 닫는 백로그 (검수 결과)

| 항목 | 사유 |
|---|---|
| B1 auto_complete cron | 이미 `run_daily_auto_expiry()` 내부 호출 (15:00 UTC) |
| B2 audit_logs 파티셔닝 | 5년 후도 150MB 수준 — 불필요 |
| C1 비활성 시설 #5 데이터 정리 | RPC OR EXISTS 가 정상 처리 (UI 노란 마커) |
| G7 Next.js 16 params async | 백로그 G7 의 18 라인은 `URL.searchParams` 패턴, dynamic params 와 무관 |

---

## 결정 요청

위 **Q1~Q6** 답변 + Phase A 진입 승인 부탁드립니다.

Phase A 는 라이브 영향 0 (모두 1-line 또는 reversible TS/CSS) 이므로 승인 즉시 ~30분 내 배포 가능합니다.
