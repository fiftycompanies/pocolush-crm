# 다음 세션 시작 프롬프트 (복사 → 새 Claude 세션에 붙여넣기)

---

## 안내

```
pocolush-crm 이전 세션 (2026-05-16 11:00) 이어서 진행할 거야.

먼저 이 4개 파일 읽어서 컨텍스트 복구해:
1. thoughts/sessions/20260516-1100_handover.md     (인계인수서, 가장 먼저)
2. thoughts/sessions/20260516-1100_session_record.md (세션 기록)
3. thoughts/plans/20260516-0930_bbq_board_refresh_plan.md (승인 대기 Plan A — 자동갱신 UX)
4. thoughts/plans/20260516-1030_three_residuals_plan.md   (승인 대기 Plan B — 3 잔존 이슈)

읽고 나면 운영 체크 1건 먼저 실행해서 결과 보고:

## 운영 체크 — 정합성 (Supabase MCP)
```sql
SELECT
  (SELECT COUNT(*) FROM bbq_reservations) AS total,
  (SELECT COUNT(*) FROM bbq_reservations WHERE status='confirmed' AND reservation_date >= CURRENT_DATE) AS future_confirmed,
  (SELECT COUNT(*) FROM audit_logs WHERE action='bbq_board_read' AND created_at > NOW() - INTERVAL '24 hours') AS dedup_check,
  (SELECT COUNT(*) FROM audit_logs WHERE action='bbq_board_unauthorized') AS unauthorized,
  (SELECT COUNT(*) FROM members WHERE status='deleted' AND pii_purged=false) AS mask_pending,
  (SELECT COUNT(*) FROM bbq_facilities WHERE name ILIKE 'QATEST_%') AS test_residue,
  (SELECT COUNT(*) FROM bbq_products WHERE name ILIKE 'QATEST_%') AS test_product_residue;
```

기대:
- dedup_check < 30 (079 1h dedup 효과)
- unauthorized = 0
- mask_pending = 0
- test_residue = 0 (이번 세션 E2E cleanup 완료)
- test_product_residue = 0

체크 통과 후 다음 두 Plan 중 어느 쪽부터 진행할지 결정:

---

## (A) 자동갱신 UX 강화 (P0, ~45분)

배경: 사용자 보고 "평상 예약 현황 자동갱신 버튼 작동 안 함"
진단: 코드 정상, 시각 피드백 0가 진짜 문제 (research §2)

권고 안 (Plan A §3):
- isRefreshing state + handleRefresh 핸들러 (중복 차단)
- RefreshCw animate-spin 회전 애니메이션
- formatAgo("방금 갱신" / "N초 전 갱신")
- 최소 600ms 시각 피드백

폴링 주기는 변경 X (업계 표준 부합 — Realtime 5분 / 30s fallback)

kk 결정:
- Q1 Phase 1 적용 (A=적용 / B=미적용) — 권고 A
- Q2 카운트다운 추가 (1=적용 / 2=미적용 / 3=텍스트만) — 권고 2

---

## (B) 3 잔존 이슈 일괄 hotfix (P0, ~2.5h)

이슈 1 (#418): /dashboard/page.tsx:7 const today=new Date() 자정 mismatch
이슈 2 (Realtime 401): lib/supabase/client.ts accessToken 옵션 누락 (8건/진입)
이슈 3 (nested Link): StatsCards.tsx:40-52 외부 Link 안에 Link 3개

권고 분리 3 커밋 (롤백 정밀):
1. 이슈 3 (StatsCards) — 가장 안전, 먼저 (10분)
2. 이슈 1 (/dashboard/page.tsx useState/useEffect) — 1 파일 (15분)
3. 이슈 2 (lib/supabase/client.ts singleton + accessToken) — 회원 측 회귀 검증 (1h)

kk 결정:
- Q1 #418 (A=useState / B=suppressHydrationWarning / C=미적용) — 권고 A
- Q2 Realtime 401 (A=accessToken / B=미적용 / C=업그레이드) — 권고 A
- Q3 nested Link (A=외부 분리 / B=button / C=미적용) — 권고 A
- Q4 커밋 전략 (1=단일 / 2=분리 3커밋) — 권고 2

---

## (C) U2 모바일 햄버거 활성화 (P1, 5분)

burn-in 1주 완료 시 Vercel env 활성화:
vercel env add NEXT_PUBLIC_SIDEBAR_MOBILE_V2 production
값 입력: printf "1" (no newline) — env stdin 줄바꿈 방어 패턴
이후 vercel deploy --prod --yes 트리거

kk 결정: burn-in 완료 여부 확인 후 진행

---

## (D) 다른 요구사항 (그때 전달)

위 운영 체크 결과 + Plan 선택 (또는 "권고대로") 답변 부탁드립니다.
권고 순서: A → B 분리 3커밋 (영향 작은 것부터, 회귀 검증 단계 점진).
```

---

## 부가 참고 (복사 불필요)

### 이번 세션 누적 prod 배포 (11 커밋 + DB UPDATE 1 + Vercel env 1)
- a44be66 U2 모바일 햄버거
- 9002a57 E2E 평상 워딩
- 5361889 Realtime hotfix TopBar setAuth
- 5c3d208 평상 설정 페이지 제목
- 9bf1f21 CRM 잔존 바베큐장 5건
- c4ade3b 사이드바 IA V2 6그룹
- 80974f5 sidebar trim()
- (site) 4bcfdd9 자람터 BBQ→평상
- 24f25b4 신청 관리 평상 + bbq_products DB UPDATE
- c94860a 평상 메뉴 → 평상 설정 §3 섹션 통합
- (thoughts/) research+plan 산출물 6건 — 이번 세션 마지막 thoughts 커밋 권고

### 핵심 상수
- admin: `admin@pocolush.co.kr` / `123456`
- Supabase project: `lhuaxmzsvrmjavanunnv`
- prod URL (어드민): https://app.pocolush.com
- prod URL (공개): https://www.pocolush.com
- 다음 마이그레이션 번호: **082**
- Vercel CLI: 50.42.0 → **54.0.0** 권고

### Vercel env 활성 상태
- `NEXT_PUBLIC_SIDEBAR_IA_V2=1` (production) — V2 6그룹 활성 중
- `NEXT_PUBLIC_SIDEBAR_MOBILE_V2` — 미설정 (U2 burn-in 후)

### 운영 zone
- A존 (40 farm) / B존 (20 farm) 운영
- C존 + 'ㅇㅇ' 미운영 (is_operational=false)
- BBQ 시설 활성 4 + 비활성 1 (#5 '테스트(예약금지!)')
- 타임슬롯 3 (1타임 12:00, 2타임 14:00, 3타임 16:00)
- 상품 1 (평상 예약 기본 30,000원 120분)
- 이벤트 1 (오픈기념 무료 2026-04-18~08-31)

### 사이드바 V2 그룹 (현재 활성)
[일별 운영] 대시보드 / 신청 관리 / 평상 예약 현황 / 문의 관리
[회원] 회원 관리 / 회원권 관리 / 공지 관리
[자원·시설] 농장 관리 / 임대 계약 / 평상 설정
[상거래] 스토어 설정 / 플랜 관리 / 쿠폰 설정
[콘텐츠] 블로그 관리
[시스템] 경고(admin) / 감사 로그 / 알림 설정 / 설정

### 평상 설정 페이지 (/dashboard/bbq) 구조
헤더 (KPI 5종)
§1 평상 배치도 (FacilitiesSection)
§2 타임 슬롯 (TimeSlotsSection)
§3 상품·이벤트 (ProductsSection, id="products" 해시)
§4 시설 목록 (FacilitiesTable, <details> collapsible)

### 닫힌 백로그 (이번 세션)
- F1 사이드바 그룹화 + 라벨 단축 (V2 6그룹 적용 완료)
- 평상 메뉴 페이지 별도 운영 (§3 섹션 통합 완료)
- 신청 관리 BBQ 워딩 (평상 통일 + DB UPDATE)
- 자람터 BBQ 워딩 (평상 통일)
- Realtime 401 1차 hotfix TopBar (보완 — supabase client 측은 Plan B)

### 운영 잔존 (다음 세션 후보)
- A2 13 RPC is_admin() 일괄 통일 (헬퍼 도입 완료, 함수 재정의)
- pocolush-site 객실 BBQ 워딩 (별도지시 참고)
- 알림톡 D-30 cron
- Phase D E2E 4건 (H1 회원 / H4 Realtime / H6 모바일 / H7 KST)
- G8 Playwright 1.59→1.60 / G9 CI 야간 자동
- 회원 마이페이지 이전 이력 타임라인
