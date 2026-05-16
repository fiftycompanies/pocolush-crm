# 다음 세션 시작 프롬프트

---

## 안내

```
pocolush-crm 이전 세션 (2026-05-16 12:30) 이어서 진행할 거야.

먼저 이 4개 파일 읽어서 컨텍스트 복구:
1. thoughts/sessions/20260516-1230_handover.md       (인계인수서, 가장 먼저)
2. thoughts/sessions/20260516-1230_session_record.md (세션 기록)
3. thoughts/plans/20260516-0930_bbq_board_refresh_plan.md (대기 Plan A — 자동갱신 UX)
4. thoughts/plans/20260516-1030_three_residuals_plan.md   (참조 — 이슈 2만 재plan 필요)

읽고 운영 정합성 SQL 1건 실행해서 결과 보고:

## 운영 체크
```sql
SELECT
  (SELECT COUNT(*) FROM bbq_reservations) AS total,
  (SELECT COUNT(*) FROM bbq_reservations WHERE status='confirmed' AND reservation_date >= CURRENT_DATE) AS future_confirmed,
  (SELECT COUNT(*) FROM audit_logs WHERE action='bbq_board_read' AND created_at > NOW() - INTERVAL '24 hours') AS dedup_check,
  (SELECT COUNT(*) FROM audit_logs WHERE action='bbq_board_unauthorized') AS unauthorized,
  (SELECT COUNT(*) FROM members WHERE status='deleted' AND pii_purged=false) AS mask_pending,
  (SELECT COUNT(*) FROM bbq_facilities WHERE name ILIKE 'QATEST_%') AS test_residue;
```

기대: dedup_check < 30 / unauthorized 0 / mask_pending 0 / test_residue 0

체크 통과 후 다음 4안 중 선택:

---

## (A) 🔴 P0: Realtime 401 재진단 (1~2h)

이전 세션에서 singleton + accessToken 옵션 적용 (커밋 9de7b51) 했으나
prod 검증 시 여전히 16건 socketerror 발생.

원인 의심: createBrowserClient 동기 내부에서 첫 connection 시도 시
_client 변수가 아직 할당 전 → accessTokenFn 이 null 반환 → anon fallback

해결 옵션 4가지 (handover §우선 후속 참조):
1. 명시적 setAuth 즉시 호출 (가장 빠름)
2. localStorage 동기 읽기로 initial token 보장
3. supabase-js createClient 직접 (ssr wrapper 우회)
4. supabase-js debug 모드로 connection 흐름 trace

권고: 옵션 1 먼저 시도 (15분), 안 되면 옵션 2 (30분)

---

## (B) 🔴 P0: 자동갱신 UX 강화 (Plan A, 45m)

배경: "평상 예약 현황 자동갱신 버튼 작동 안 함"
진단: 코드 정상, 시각 피드백 0가 문제

권고 (Plan A §3):
- isRefreshing state + handleRefresh (중복 차단)
- RefreshCw animate-spin
- formatAgo("방금 갱신" / "N초 전 갱신")

kk 결정:
- Q1 Phase 1 적용 (A=적용) — 권고 A
- Q2 카운트다운 추가 (1/2/3) — 권고 2

---

## (C) P1: A2 13 RPC is_admin() 통일 (1일)

assert_admin_with_audit 헬퍼 도입 완료 (078).
13 함수 재정의 — audit 패턴 3개 + 단순 패턴 10개.

---

## (D) P1: U2 모바일 햄버거 활성화 (5m)

burn-in 완료 시:
printf "1" | vercel env add NEXT_PUBLIC_SIDEBAR_MOBILE_V2 production
vercel deploy --prod --yes

---

권고 순서: (A) Realtime 401 재진단 → (B) 자동갱신 UX
또는 "권고대로" 답변하면 (A) → (B) 순차 진행.
```

---

## 부가 참고 (복사 불필요)

### 이번 세션 3 커밋 (Plan B)
- b0701b9 fix(stats-cards): nested Link 풀기 — ✅ 0건 해결
- 38630f0 fix(dashboard): React #418 useState/useEffect — ✅ 0건 해결
- 9de7b51 fix(supabase): client singleton + accessToken — ⚠ 16건 잔존

### prod 검증 (12:30)
- /dashboard pageerror 0
- /dashboard nestedLink/hydration 0
- /dashboard ws 401: 6건
- /dashboard/bbq-board 5s ws 401: 10건 추가 (총 16건)
- /m/login 회원 회귀: 200 OK

### 핵심 상수
- admin: admin@pocolush.co.kr / 123456
- Supabase project: lhuaxmzsvrmjavanunnv
- prod URL: https://app.pocolush.com / https://www.pocolush.com
- 다음 마이그 번호: 082
- Vercel CLI: 50.42.0 → 54.1.0 권고
- Vercel env: NEXT_PUBLIC_SIDEBAR_IA_V2=1 활성

### 운영 데이터 (12:30)
- 시설 5 (활성 4 + 비활성 1 #5)
- 타임슬롯 3 (모두 활성)
- 상품 1 / 이벤트 1
- BBQ 예약 30 (confirmed 1 / completed 24+ / etc)
- audit_logs dedup_check 27 < 30

### 사이드바 V2 그룹 (활성 중)
[일별 운영] 대시보드 / 신청 관리 / 평상 예약 현황 / 문의 관리
[회원] 회원 관리 / 회원권 관리 / 공지 관리
[자원·시설] 농장 관리 / 임대 계약 / 평상 설정
[상거래] 스토어 설정 / 플랜 관리 / 쿠폰 설정
[콘텐츠] 블로그 관리
[시스템] 경고(admin) / 감사 로그 / 알림 설정 / 설정

### 평상 설정 페이지 (/dashboard/bbq) 구조
헤더 (KPI 5종)
§1 FacilitiesSection
§2 TimeSlotsSection
§3 ProductsSection (id="products")
§4 FacilitiesTable (collapsible)

### 닫힌 백로그 (이번 세션)
- 이슈 1 (#418): ✅ 해결
- 이슈 3 (nested Link): ✅ 해결
- singleton 패턴 도입: ✅ 적용

### 미완료 (다음 세션)
- 이슈 2 (Realtime 401): ⚠ 재진단 필요 (NEW-1)
- 자동갱신 UX (Plan A): 대기
- A2 13 RPC / U8 / Phase D / G8/G9 / F2/F3 / 알림톡 / 회원 타임라인
