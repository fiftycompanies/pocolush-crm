# 세션 기록 — 2026-05-15 BBQ 운영 보드 + 신청관리 디테일 강화

## 🎯 세션 핵심

PM + UIUX Pro 스킬로 BBQ 존 예약 운영 기능을 2축 (신청관리 디테일 + 실시간 보드) 으로 구현.
사용자 첨부 객실현황 참고 화면 ([예약완료] [예약불가(대기)] [예약가능]) 패턴 차용.

**전체 플로우**: 유사 서비스 리서치 (4축) → 플랜 v1 → 8스킬·7점·qa 검수 → 플랜 v2 → 구현 → 빌드 → 배포

---

## 📐 작업 단계

### 1. 유사 서비스 4축 리서치 (병렬 4 에이전트)
- 캠핑·숙소·PMS (야놀자/Cloudbeds/Campspot/Airbnb)
- 식당·골프 시간슬롯 (캐치테이블/OpenTable/KGOLF/Booksy)
- 시각화 패턴 (CGV 좌석/Opera Tape Chart/FullCalendar/Heatmap)
- 리스트 행 디테일 (Linear/Sentry/Shopify/KDS)

→ **채택**: 캐치테이블 매니저 + Glofox 카드 그리드 + 캠핑톡 KPI + Sentry 2-line + Opera Tape

### 2. 플랜 v1 (`thoughts/plans/20260515-1130_*.md`)
- Q1~Q5 권고안 + 와이어프레임 + 일정

### 3. 8스킬·7점·qa 검수 (병렬 5 에이전트)
**치명 결함 4건 발견**:
- E1: `bbq_products.event` 컬럼 없음 → `bbq_events` JOIN 필요
- E2: UNIQUE (date, slot, bbq) 이미 존재 (플랜 오류 정정)
- E3: `mapBBQStatus` no_show→cancelled 기존 버그
- E4: WCAG orange 콘트라스트 표기 오류 (5.13 vs 6.8)

**데이터 검증 (Supabase MCP)**:
- 비활성 시설+예약 잔존: 1건 (060 hotfix 사례)
- audit_logs 테이블 존재
- bbq_products.event 컬럼 없음 확인

→ **검수 리포트** (`20260515-1230_bbq_review_consolidated.md`): 25건 보강 명세

### 4. kk 결정 Q6/Q7 — "라이브 데이터 보존"
- 비활성 시설이라도 예약 있으면 grid 표시 + 노란 경고 마커
- 071 RPC 의 `facility_active=true OR EXISTS(예약)` 조건

### 5. 플랜 v2 (`20260515-1300_*.md`)
- 검수 25건 반영 + Q1~Q12 12개 결정 확정

### 6. 구현
- 072 마이그레이션 prod 적용
- types/index.ts BBQBoardRow 추가
- lib/use-requests.ts 전면 개편 (bbqMeta + 이벤트 + error)
- app/dashboard/requests/page.tsx Sentry 2-line + STATUS 확장
- lib/use-bbq-board.ts (RPC + Realtime + 폴링 fallback + retry)
- lib/use-media-query.ts
- components/admin-bbq/{BoardKpiCard,BoardMatrix,BoardWeekTape,ReservationSidePanel}.tsx
- app/dashboard/bbq-board/page.tsx
- components/layout/Sidebar.tsx (active 버그 fix + 메뉴 3개)
- e2e/bbq-board.spec.ts (7 시나리오)

### 7. 검증 + 배포
- tsc --noEmit 통과
- npm run build 통과 (`/dashboard/bbq-board` 신규 라우트 등록)
- git commit + push (커밋: `eea1be6`)
- Vercel 자동 배포 시작 (Building)

---

## 🗄 마이그레이션 — 072 prod 적용 완료

```sql
-- 072_bbq_board_rpc.sql
-- (1) 복합 인덱스 (reservation_date, time_slot, bbq_number) WHERE confirmed/completed
-- (2) get_bbq_board(p_date_from, p_date_to) — SECURITY DEFINER + search_path='' + admin check
--     + PIPA audit_logs (성공/실패 양쪽)
--     + 활성 시설 OR (조회 범위 내 예약 보유 비활성 시설) 모두 포함
--     + bbq_events JOIN 으로 is_event 판정
```

---

## 🛡 7점 체크 결과

| # | 항목 | 결과 |
|---|---|---|
| 1 인증/권한 | ✅ admin check + SECURITY DEFINER + search_path='' |
| 2 비정상 경로 | ✅ requests/page.tsx 4 액션 error + busy 가드 추가 |
| 3 중복/동시성 | ✅ UNIQUE 제약 + busy state |
| 4 DB 정합성 | ✅ RPC READ-ONLY |
| 5 비밀정보 | ✅ audit_logs 추가 (PIPA 5년) |
| 6 런타임 | ✅ tsc + build 통과 |
| 7 배포 후 대응 | ✅ retry + Realtime fallback + stale 60s 경고 띠 |

---

## 📋 영향 파일 (18 changed, 3,212 insertions)

```
신규 (12)
├── supabase/migrations/072_bbq_board_rpc.sql
├── app/dashboard/bbq-board/page.tsx
├── components/admin-bbq/{BoardKpiCard,BoardMatrix,BoardWeekTape,ReservationSidePanel}.tsx
├── lib/use-bbq-board.ts
├── lib/use-media-query.ts
├── e2e/bbq-board.spec.ts
└── thoughts/plans/20260515-{1130,1230,1300}_*.md (플랜 v1 + 검수 + v2)

수정 (5)
├── lib/use-requests.ts             (bbqMeta + mapBBQStatus + 이벤트 + error)
├── app/dashboard/requests/page.tsx (Sentry 2-line + STATUS 확장 + 색 + 가드)
├── types/index.ts                  (BBQBoardRow)
├── components/layout/Sidebar.tsx   (active 매칭 fix + BBQ 메뉴 3개)
└── thoughts/sessions/20260513-1418_*.md
```

---

## 🎨 핵심 UX 패턴

### 신청관리 BBQ 행
```
[🔥 BBQ] 김철수            #3번 · 2타임(14:00) · 2인 · ₩30,000
         010-1234         프리미엄 BBQ 세트  [이벤트]
         5/23(금)    3일 전    [예약완료]   변경▾
```

### BBQ 보드 매트릭스
```
점유율 53% ████████████░░░░░░  [완료 8] [노쇼 0] [가용 4] [비운영 1]

         1타임(11:00)   2타임(14:00)   3타임(17:00)
BBQ #1   ■ 홍길동 4인   ■ 김철수 6인   ○ 가용
BBQ #2   ■ 박영희 2인   ■ 이지훈 3인   ▲ 노쇼
BBQ #3   ○ 가용         ○ 가용         ■ 최민준 4인
BBQ #4   ■ 강동원 2인   ○ 가용         ○ 가용
BBQ #5⚠ ■ 운영중단     ░ (예약 없음)  ░ (예약 없음)   ← 노란 ring
```

---

## 🟡 잔존 사항 (Phase 2 백로그)

- 빈 슬롯 클릭 → 어드민이 회원 예약 생성 (오프라인 워크인)
- 사이드 패널에서 시설/타임 이동 (예약 변경)
- 알림톡 발송 (확인/완료/취소 시점)
- 회원 검색 → 그리드에서 회원별 예약 하이라이트 (이미 search input 있음)
- BBQ #별 매출 리포트
- 노쇼 패턴 회원 자동 플래그
- 비활성 시설+예약 1건 (#5, 2026-05-09) 운영 처리 결정

---

## 📊 운영 진입

- **신청관리**: `/dashboard/requests` — BBQ 행 디테일 즉시 확인
- **BBQ 보드**: `/dashboard/bbq-board` — 오늘/내일/이번 주 실시간
- **사이드바**: 회원 서비스 그룹에 BBQ 메뉴 3개 (예약 현황 / 시설·타임 / 상품·이벤트)
- **admin only RPC**: `get_bbq_board(DATE, DATE)` + audit_logs 자동 기록
- **모바일**: 사이드 패널 → bottom-sheet 자동 분기 (<1024px)

---

## 핵심 데이터/상수 참조

- admin 계정: `admin@pocolush.co.kr` / `123456`
- 프로젝트: Supabase `lhuaxmzsvrmjavanunnv`
- 활성 BBQ: 4 시설 + 비활성 1 시설 (예약 보유)
- 타임슬롯 3: 1타임(11-13:50) / 2타임(14-16:50) / 3타임(17-19:50)
- 신규 RPC: `get_bbq_board(p_date_from DATE, p_date_to DATE DEFAULT NULL)`
- 마이그레이션 070 (디스크 only): `070_farm_rentals_add_pending_status.sql` — prod 미적용, 별도 PR 필요
- 다음 마이그레이션 번호: **073**
