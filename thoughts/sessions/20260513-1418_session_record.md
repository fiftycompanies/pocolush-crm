# 세션 기록 — 2026-05-13 (BBQ + 멤버십/Zone + 라이프사이클 + 공지 hotfix + E2E)

## 🎯 세션 핵심 작업

### 1. BBQ 시스템 보안/무결성 (PR #11~#12)
- 060 RLS role='admin' 검증 + 비활성 시설 예약 차단 RPC
- 061 가용성 SECURITY DEFINER RPC (`get_bbq_availability`, `get_booked_facilities`)
- status IN (confirmed, completed) 정확 카운팅

### 2. 멤버십 데이터 무결성 (PR #13)
- 062-a 클린업 17건 + UNIQUE INDEX (`uniq_active_farm_membership`)
- 062-b CHECK + 트리거 3개 (`fn_sync_farm_status`, `fn_prevent_inactive_zone_membership`)
- 백업 테이블 3개 (memberships/farm_zones/farms `_backup_062b_20260512`)

### 3. 회원 라이프사이클 (PR #14, #15)
- 063 enum 확장 (suspended/pending_deletion/deleted) + 8 신규 컬럼
- RPC 7개: suspend/unsuspend/request_deletion/restore/purge + cron + is_admin 헬퍼
- 30일 grace + PIPA SHA256 hash + 5년 보관
- Phase 1.5: 리스트 필터 8 탭 + ⋮ 액션 메뉴

### 4. Zone 이전 기능 (PR #16)
- 064 `membership_zone_history` (SCD-2) + RPC 4개
- 2-step 검증 (validate → change) + override 모드
- A 모달 — 회원 상세 회원권 이력 카드 헤더에 "Zone 이전" 버튼

### 5. 데이터 완전 동기화 (PR #17)
- 065 search_path hotfix + restore 멤버십 자동 복원
- 066 양방향 동기화 트리거 (rental ↔ membership)
- 067~068 잔존 8건 정리 + 배치도 일치
- 069 farm_rentals CHECK

### 6. self-service 탈퇴 + PIPA (PR #18)
- 070 self_request_member_deletion / self_restore_member_deletion
- PIPA 동의 IP/UA 컬럼 + Server Action 수집
- /privacy 처리방침 10 섹션 + /m/signup 4대 고지 details
- 알림톡 자동 발송 (탈퇴 시 D-30 안내)

### 7. 공지 발행 closure 버그 (PR #19, P0)
- `useEffect` cleanup 의 `savedOrPublished` closure 버그
- `setSavedOrPublished(true)` 시 이전 cleanup 호출 (closure: false) → 발행된 row 즉시 DELETE
- useRef 패턴으로 closure 회피 + dependency 비움

### 8. Playwright E2E 6/6 PASS (PR #20)
- 1: 회원 리스트 8 탭 + ⋮ 메뉴
- 2: Danger Zone 노출
- 3: 비활성화 모달 (사유 5종)
- 4: Zone 이전 모달
- 5: signup PIPA 4대 고지
- 6: /privacy 페이지

스크린샷 6장 `/tmp/e2e-N-*.png` (총 1.3MB)

---

## 📊 데이터 변화

- active memberships: **69 → 27** (잘못된 데이터 42건 정리, row 삭제 X)
- duplicate 0 / orphan 0 / farm.status 불일치 0
- 모든 active **(회원 ↔ 자리 ↔ 계약 ↔ 회원권) 1:1:1:1 매칭**

---

## 🛡 보호 장치 (재발 방지)

- UNIQUE INDEX 1: `uniq_active_farm_membership`
- CHECK 2: `memberships_active_requires_farm_check` + `farm_rentals_active_requires_farm_check`
- 트리거 5:
  - `fn_sync_farm_status` × 2 (memberships + farm_rentals)
  - `fn_prevent_inactive_zone_membership`
  - `fn_sync_membership_with_rental`
  - `fn_sync_rental_with_membership`

---

## 🗄 마이그레이션 — 12건 prod 적용

```
060 BBQ RLS + 비활성 시설 RPC
061 BBQ 가용성 RPC 2개
062a 멤버십 클린업 + UNIQUE
062b 스키마 보호 + 트리거 3개
063 회원 라이프사이클 + cron
064 Zone 이전 + SCD-2
065 063 search_path hotfix
066 양방향 동기화 트리거
067 잔존 5건 클린업
068 이중 ms + rental 자리 복원
069 farm_rentals CHECK
070 self-service 탈퇴 + PIPA 컬럼
```

---

## 🟡 운영 잔존 사항

1. **잃어버린 공지** (closure 버그 피해): 자람터 OT 영상 공지, 유튜브 영상공지 등 — **재작성 필요** (DELETE 이미 발생, 복구 불가)
2. **Vercel CLI outdated** (50.42.0 → 53.4.0) — `npm i -g vercel@latest` 권장

---

## 🔜 백로그 (다음 세션)

- 5년 후 hard delete runbook (Phase 3)
- Zone 보드 B 화면 (`/dashboard/zones`) — get_zone_dashboard RPC 활용
- 알림톡 D-30 cron (pending_deletion 자동 발송)
- 추가 E2E (실제 탈퇴/복원/zone 이전 flow)
- 회원 마이페이지 이전 이력 타임라인
- ESLint warn → error 복구 (FIXME-LINT-0.5)

---

## 핵심 데이터/상수 참조

- admin 계정: `admin@pocolush.co.kr` / `123456`
- 프로젝트: Supabase `lhuaxmzsvrmjavanunnv`
- 운영 zone: A존 (40 farm) / B존 (20 farm) — C존, 'ㅇㅇ' 미운영
- 사유 분류 (063): member_request / long_inactive / abuse / duplicate / other
- 사유 분류 (064): member_request / facility_issue / operational / maintenance / other
- 가격 정책 (064): C — 어드민 수동 입력 (-99M ~ 99M, |M|>1M confirm)
- 30일 grace (063, 070)
