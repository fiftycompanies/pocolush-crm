# BBQ 보드 플랜 — 8스킬/7점/QA 통합 검수 리포트

> 작성일: 2026-05-15
> 검수 대상: `thoughts/plans/20260515-1130_bbq_reservation_dashboard_plan.md`
> 검수자: 5개 병렬 에이전트 (보안/QA·데이터/UX·접근성/성능/통합·회귀)
> Supabase 직접 사실 검증 완료

---

## ⛔ 최종 판정

**⚠️ 일부 수정 후 배포 가능** — 보안 패턴은 안전하나, **플랜 자체에 사실 오류 4건 + 데이터 정책 결정 필요 7건 + UX/성능 보강 필요 16건**. 그대로 구현 시 운영 사고 가능.

→ **플랜 v2 작성 + kk 추가 결정 후 진입 권고**.

---

## 🔥 치명 결함 (플랜 사실 오류 — 반드시 수정)

| # | 결함 | 사실 (검증됨) | 영향 |
|---|---|---|---|
| **E1** | `bbq_products` 에 `event` 컬럼 **없음** | DB 컬럼 조회: id/name/base_price/duration_minutes/is_active/created_at 만 존재. `bbq_events` 는 별도 테이블 | 플랜의 `b.product?.event` 항상 undefined → 이벤트 배지 작동 안 함 |
| **E2** | UNIQUE (date, slot, bbq_number) **이미 존재** | `004_bbq.sql:39` 명시 + prod 인덱스 검증 통과 | 플랜의 "UNIQUE 없음 ⚠️" 주장은 오류. 7점 #3 동시성 분석 근거 정정 필요 |
| **E3** | `mapBBQStatus` 의 `no_show → cancelled` 매핑 (기존 버그) | `lib/use-requests.ts:24-28` else→cancelled. 그러나 `member-constants.ts:16`에 no_show 별도 정의 + UI 라벨 "노쇼" 존재 | 통합 리스트에서 노쇼가 "취소" 로 표시됨. 플랜이 이 버그를 다루지 않음 |
| **E4** | WCAG 콘트라스트 표 수치 부정확 | orange (#FED7AA + #9A3412) = **실 5.13:1** (AA만 통과). 플랜은 "6.8:1 AAA" 라고 잘못 표기 | 야외 햇빛 환경 borderline. 톤 조정 필요 |

---

## 🟠 데이터 정합성 (운영 사고 가능성)

| # | 항목 | 검증 결과 | 결정 필요 |
|---|---|---|---|
| **D1** | 비활성 시설에 confirmed 예약 잔존 | prod 1건 실재 (060 hotfix 사례) | RPC 가 LEFT JOIN 하면 "비운영" 으로 표시되어 운영자가 잊을 위험. **별도 마커 vs 비운영에 흡수** 결정 필요 |
| **D2** | 071 RPC `facility_slot_grid` 의 `f.is_active` 필터 누락 | plan §4.5 SQL 에 `WHERE s.is_active=TRUE` 만 있음, 시설 필터 없음 | 비활성 시설 전부 grid 행에 포함. **포함 vs 제외** 결정 필요 |
| **D3** | KST 자정 경계 — 클라이언트 today 계산 | reservation_date 는 timezone 없는 DATE | UTC 기준 today 계산 시 자정 직전 정시 미스. **`Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' })` 강제** 필요 |
| **D4** | 016 auto_complete_reservations cron 연결 여부 | `/api/cron/expire-memberships` 가 호출하는지 미확인 | 어제 confirmed 가 completed 자동 전환 안 되면 KPI 카드 카운트 왜곡 |

---

## 🟡 UX/접근성 보강 필요

| # | 항목 | 현 플랜 | 권고 |
|---|---|---|---|
| **U1** | 행 디자인이 사실상 3-line인데 64px 명시 | 와이어와 토큰 수 충돌 | 80px로 조정 또는 예약일·신청일 inline |
| **U2** | 모바일 주간 Tape 분기 누락 | Phase 1에 주간 포함하나 모바일 와이어 없음 | 가로 스크롤 + 시설 좌측 sticky 명시 |
| **U3** | `role="grid"` + 키보드 네비 + a11y 일체 명시 없음 | 헤더만 sticky 언급 | grid/row/gridcell + 화살표 키 + ESC + focus trap + 트리거 복귀 |
| **U4** | 빈 슬롯 클릭 동작 모호 | 사이드 패널 띄우고 "Phase 2" 문구만 | Phase 1: cursor:default + 클릭 무반응 + 호버 툴팁 "Phase 2 예정" |
| **U5** | 회원명 검색 부재 | 그리드 84셀에 검색 없음 | 헤더에 검색 input (회원명/연락처 뒷4자) |
| **U6** | 30s 폴링이 사이드 패널 작업 방해 | 폴링+Realtime 양립 | **사이드 패널 오픈 중 폴링 일시정지** + visibility API |
| **U7** | KPI 카드 모바일 4개 carousel 비추 | 명시 없음 | 가로 1줄 압축 `완8 대0 가6 비4` |
| **U8** | 사이드 패널 1024px 미만 분기 누락 | 패널 폭 고정 가정 | 1024px 미만 모달/bottom-sheet |
| **U9** | 비활성 시설 토글 (숨기기 옵션) | 항상 표시 | "비운영 숨기기" 체크박스 옵션 |
| **U10** | 사용자 첨부 화면과 라벨 불일치 | "비운영" | 첨부: "예약불가" — 운영자 익숙 용어 따르거나 통일 결정 |
| **U11** | 신청관리 색 변경 (orange→sky) 영향 범위 모호 | TYPE 색만? STATUS pending 까지? | **TYPE 만** (BBQ 대기 배지 색 보존). 1주 transition 토스트 디테일 정의 |
| **U12** | 스토어/쿠폰 2-line 컨텐츠 정의 누락 | BBQ 만 와이어 | 통합 일관성 위해 타입별 컨텐츠 명시 (또는 BBQ 만 2-line, 나머지 1-line) |

---

## 🟢 성능 보강

| # | 항목 | 권고 |
|---|---|---|
| **P1** | 복합 인덱스 추가 | 071 마이그레이션에 `CREATE INDEX idx_bbq_reservations_date_slot_facility ON bbq_reservations (reservation_date, time_slot, bbq_number) WHERE status IN ('confirmed','completed')` 동봉 |
| **P2** | Realtime + 폴링 이중 실행 차단 | `channel.subscribe(status => status==='SUBSCRIBED' && clearInterval(pollTimer))` 명시 |
| **P3** | Realtime 채널 server-side filter | `filter: 'reservation_date=gte.{from},lte.{to}'` |
| **P4** | Cell 단위 React.memo + useMemo | 매트릭스 84셀 매 이벤트 re-render 방지 |
| **P5** | RPC retry 정책 | exponential backoff (1s/2s/4s, max 3회) |
| **P6** | Route segment config | `export const dynamic = 'force-dynamic'` |
| **P7** | 사이드 패널은 fixed overlay (CLS 방지) | 그리드 압축 X |

---

## 🔒 보안/PIPA 보강

| # | 항목 | 권고 |
|---|---|---|
| **S1** | 071 RPC audit_logs 기록 | audit_logs 테이블 **존재 확인됨**. RPC 내부 `INSERT INTO public.audit_logs ('bbq_board_read', ...)` 추가 |
| **S2** | RAISE EXCEPTION 메시지 표준화 | `'admin only'` → `'PERMISSION_DENIED'` (운영 grep 용이) |
| **S3** | unauthorized 시도 audit log | admin check 실패 시에도 기록 |
| **S4** | 마이그레이션 번호 충돌 회피 | prod 070 = self_service_withdrawal. 디스크 070_farm_rentals 미적용. **신규 RPC = 072 권장** (안전 마진) |
| **S5** | requests/page.tsx 인라인 액션 4건 error swallow | `if (error) toast.error(...)` 추가 — 본 플랜 PR 동반 수정 |
| **S6** | 더블클릭 가드 | select onChange + 사이드 패널 액션 버튼 모두 in-flight 가드 |
| **S7** | Sidebar `startsWith` active 매칭 버그 | `/dashboard/bbq` 가 `/bbq-board`, `/bbq-products` 모두 매칭. 정확 매치 또는 prefix 우선순위 수정 |

---

## 📋 kk 추가 결정 필요 항목 (Q1~Q5 외)

이전 Q1~Q5 답변 (전부 ⭐) 유효. 신규 결정:

### Q6. 비활성 시설 잔존 예약 (D1)
- (A) 정책: 비활성 시설은 RPC 결과에서 **제외** + 별도 경고 알림 (`/dashboard/bbq` 에 빨강 배지)
- (B) RPC 결과에 포함하되 그리드 셀에 **노란 경고 마커**로 별도 표시 ⭐
- (C) 현재 prod 1건을 즉시 정리 (취소 처리) 후 정책 무관화

### Q7. 071 RPC `facility_slot_grid` 비활성 시설 표시 (D2)
- (A) `is_active=true` 만 grid 에 포함 (운영 시설만) ⭐
- (B) 모두 포함 + UI 에서 비활성 표시
- (C) admin 토글 (기본=A, "비운영 보기" 체크박스)

### Q8. BBQ 상태 라벨 분리
- (A) `confirmed → "예약완료"` BBQ 만 별도 라벨 ⭐ (운영자 혼선 해결)
- (B) 기존 `confirmed → "대기"` 통합 라벨 유지

### Q9. 스토어/쿠폰 행 디자인
- (A) BBQ 만 2-line, 스토어/쿠폰은 1-line 유지 ⭐ (최소 변경)
- (B) 전부 2-line 통일 (스토어/쿠폰 디자인 새로 정의)

### Q10. 컬럼 헤더 명칭
- (A) "예약일" / "신청일" 분리 컬럼 ⭐ (BBQ 중심)
- (B) 타입별 동적 라벨 "이용일/주문일/발급일" + "신청일"
- (C) "사용일" / "신청일" 일반화

### Q11. 마이그레이션 번호
- (A) **072_bbq_board_rpc.sql** ⭐ (070 미적용 충돌 회피 + 안전 마진)
- (B) 071 사용 (디스크 ls 결과 안전하다고 보고)

### Q12. orange→sky 색 변경 범위
- (A) TYPE_META.order 만 변경 (스토어 신청 chip) ⭐
- (B) STATUS_META.pending 색까지 변경 (BBQ "대기" 라벨도 영향)
- (C) 변경 보류 (현재 색 유지)

---

## 🛡 7점 보안/품질 체크 종합

| # | 항목 | 결과 | 비고 |
|---|------|------|------|
| 1 | 인증/권한 | ✅ | 071 RPC admin check + SECURITY DEFINER + search_path 패턴 (060/065 hotfix 답습) |
| 2 | 비정상 경로 | ⚠️ | requests/page.tsx 인라인 액션 4건 error swallow — 동반 수정 |
| 3 | 중복 요청/동시성 | ✅ | UNIQUE 제약 + 060 RPC `EXCEPTION WHEN unique_violation` 존재. 단 인라인 select 더블클릭 가드 추가 |
| 4 | DB 정합성 | ✅ | 071 READ-ONLY. FK ON DELETE 모두 안전 |
| 5 | 비밀정보 노출 | ⚠️ | audit_logs 추가 권고 (PIPA 5년) |
| 6 | 런타임 이슈 | ⚠️ | Next 16 + React 19 + useSearchParams Suspense 경계 검증, tsc/audit 실측 필수 |
| 7 | 배포 후 대응 | ⚠️ | RPC 에러 toast.error / Realtime 끊김 메트릭 명시 |

**최종 판정**: ⚠️ **일부 수정 후 배포** — 본 플랜 자체는 보안 측면 안전, 그러나 구현 단계에서 위 7개 보강 항목 동반 처리 필수.

---

## 다음 단계 권고

1. **kk 가 Q6~Q12 7개 항목 결정** (Q1~Q5 는 전부 ⭐ 채택 유효)
2. 플랜 **v2** 작성 (검수 반영 + 7점 조치 명세)
3. `/implement` 진입 — 다음 순서:
   - (a) 072 마이그레이션 (RPC + 인덱스 + audit_log)
   - (b) lib/use-requests.ts (E1 이벤트 배지 `bbq_events` JOIN, E3 no_show 매핑 수정, error 처리)
   - (c) /dashboard/requests 행 디자인 + 색 변경
   - (d) lib/use-bbq-board.ts (RPC + Realtime + 폴링 fallback + retry)
   - (e) /dashboard/bbq-board 페이지 + 4개 컴포넌트
   - (f) Sidebar active 매칭 버그 fix + 메뉴 추가
   - (g) E2E 3 spec (+ 추가 권고 3 spec)
   - (h) 7점 회귀 검증 (tsc/audit/lighthouse)
4. PR 작성 시 — 검수 리포트 참조 링크 + Phase 1 완료 기준 명시

---

## 🟢 검수 통과 (변경 불필요)

- 071 RPC SECURITY DEFINER + search_path 패턴
- 회원측 가용성 (061) 과의 분리
- E2E 회귀 (기존 9 spec 영향 없음)
- CSP wss://supabase 이미 허용
- Bundle Size (신규 라이브러리 0건)
- 클라이언트 메모리 < 1MB
- 회원 상세 BBQ 이력 (use-member-detail.ts) 영향 없음
