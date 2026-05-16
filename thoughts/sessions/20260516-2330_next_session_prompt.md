# 다음 세션 시작 프롬프트

---

## 안내

```
pocolush-crm 이전 세션 (2026-05-16 23:30) 이어서 진행할 거야.

먼저 이 4개 파일 읽어서 컨텍스트 복구:
1. thoughts/sessions/20260516-2330_handover.md         (인계인수서, 가장 먼저)
2. thoughts/sessions/20260516-2200_handover.md         (22:00 세션 인계)
3. thoughts/plans/20260516-2000_realtime_401_and_farms_rpc_plan.md
4. thoughts/research/20260516-1930_realtime_401_deep_and_farms_rpc_research.md

읽고 운영 정합성 SQL 실행 후 결과 보고:

## 운영 체크
```sql
SELECT
  (SELECT COUNT(*) FROM bbq_reservations) AS bbq_total,
  (SELECT COUNT(*) FROM farms WHERE deleted_at IS NULL) AS farms_total,
  (SELECT COUNT(*) FROM farm_rentals) AS rentals_total,
  (SELECT COUNT(*) FROM farm_rentals WHERE status='active') AS rentals_active,
  (SELECT COUNT(*) FROM memberships WHERE status='active') AS memberships_active,
  (SELECT COUNT(*) FROM audit_logs WHERE action='farm_history_search' AND created_at > NOW() - INTERVAL '24 hours') AS farm_hist_dedup,
  (SELECT COUNT(*) FROM audit_logs WHERE action='farms_board_view' AND created_at > NOW() - INTERVAL '24 hours') AS farms_board_dedup,
  (SELECT COUNT(*) FROM audit_logs WHERE action LIKE '%_unauthorized') AS unauthorized_total,
  (SELECT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='notifications')) AS notif_pub_ok,
  (SELECT proname FROM pg_proc WHERE proname='search_farm_rentals_history' LIMIT 1) AS rpc_087_exists;
```

기대: farms_total 60 / rentals_total 80 / rentals_active 34 / notif_pub_ok true / rpc_087_exists 'search_farm_rentals_history'

체크 통과 후 다음 4안 중 선택:

---

## (A) 🔴 즉시: 4ab76a6 Playwright 검증 (15m) — 권고 #1

이전 세션에서 prod 배포 (마이그 086+087) 완료했으나 검증 미완료.

검증 항목:
- §이력 섹션 렌더링 (h3 "임대 이력 검색")
- 매트릭스 60셀 회귀 0 (FarmsBoardMatrix)
- search_farm_rentals_history RPC 호출 + 결과 표시
- 검색어/상태/플랜 필터 토글 → RPC 재호출
- TopBar 알림 실시간 toast (notifications INSERT 시 — 테스트 INSERT 필요)

준비된 검증 스크립트는 이전 세션에서 삭제됨. 필요 시 BBQ 검증 스크립트 패턴 참조.

---

## (B) 🟡 P1: U2 모바일 햄버거 활성화 (5m, 5/22 burn-in 후)

5/22 이후이면:
printf "1" | vercel env add NEXT_PUBLIC_SIDEBAR_MOBILE_V2 production
vercel deploy --prod --yes

검증: 모바일 375 viewport 햄버거 토글 + 사이드바 translate-x-0

---

## (C) 🔵 P2: Realtime 401 (D) Supabase support / GitHub issue (30m)

6차 시도 (옵션 7) 후에도 5건 잔존. WebSocket upgrade 자체 401 (sent/received frames 0).
client-side 한계 도달. server-side 점검 필요.

진단 결과 패키지 + Supabase support 문의:
- 6차 시도 코드 + 결과 매트릭스
- console.log + WebSocket frame 캡처
- Publication / RLS 정책 SQL 결과
- prod URL + project ID

risk: 0 (외부 문의만)

---

## (D) 🟢 P3: Cloudflare wildcard cert 정리 (5m)

Cloudflare Dashboard → SSL/TLS → Edge Certificates 에서 미사용 *.pocolush.com wildcard cert 삭제.
효과: "Validate the domain pocolush.com" 알림 중단.
운영 영향 0 (이미 Vercel Let's Encrypt 직접 SSL).

---

권고 순서: (A) 검증 우선 → (B) U2 활성화 → (C) Realtime support → (D) Cloudflare 정리
또는 "권고대로" 답변하면 (A) → (B) → (C) 순차 진행.
```

---

## 부가 참고

### 이번 세션 prod 배포 (7 커밋 + 3 마이그)
- 97d4a72 옵션 5 (3건)
- ea11c10 마이그 085 + useFarmsBoard ✅ (4→1 round)
- 5cde1b3 옵션 6 (6건, apikey 충돌)
- 01c7f03 옵션 7 (5건, 채택) ✅
- a6af5eb TruffleHog 이벤트별 분기 ✅
- ecf418a 22:00 인계
- 4ab76a6 마이그 086+087 (TopBar realtime + 농장 §이력) ✅ 검증 미완

### 핵심 상수
- admin: admin@pocolush.co.kr / 123456
- Supabase project: lhuaxmzsvrmjavanunnv
- prod URL: https://app.pocolush.com / https://www.pocolush.com
- 다음 마이그 번호: **088**

### 운영 데이터 (23:30)
- 농장 60 / rentals 80 (active 34 / expired 33 / cancelled 11)
- customers 144 / BBQ 30+ / 평상 1상품 / 이벤트 1
- 인덱스 trgm: customers + members 모두 활성
- realtime publication: notifications, member_notifications, bbq_reservations, notices

### Cloudflare 이메일 (운영 영향 0)
- 사용자 수신: "Validate pocolush.com SSL" 알림 (2026-06-16 만료)
- 진단: Cloudflare DNS만 호스팅, A 레코드 Vercel IP, Vercel Let's Encrypt 자동 갱신 중
- 권고: 이메일 무시 OK, 선택적으로 Cloudflare Dashboard 에서 wildcard cert 삭제

### Realtime 401 결과 매트릭스 (참조)
```
1차 8 → 2차 16 → 3차 28 → 4차 3 → 5차 6 → 6차 5 (옵션 7 채택)
28건 → 5건 (82% 감소)
WebSocket upgrade 자체 401 (sent/received frames: 0)
→ client-side 한계 도달, server-side 점검 필요
```

### 닫힌 백로그 (이번 세션)
- 농장 보드 RPC 분리 (마이그 085) ✓
- Realtime 401 옵션 5/6/7 (3차 추가 시도, 82% 감소) ✓
- TruffleHog 이벤트별 base/head 분기 ✓
- TopBar realtime publication fix (마이그 086) ✓
- 농장 §이력 검색 (마이그 087 + 3 컴포넌트) ✓ 검증 미완

### 미해결 (다음 세션)
- 🔴 4ab76a6 Playwright 검증 (§이력 + TopBar realtime toast)
- ⚠ Realtime 401 server-side 진단 (옵션 C/D)
- U2 모바일 햄버거 활성화 (5/22 후)
- 만료 임박 7일/30일 단계 분리 (Phase 2)
