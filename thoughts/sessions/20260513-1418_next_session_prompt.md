# 다음 세션 시작 프롬프트 (복사 → Claude 에게 붙여넣기)

---

## 안내 (복사 영역)

```
pocolush-crm 에서 이전 세션 마무리 후 이어서 작업할 거야.

먼저 이 2개 파일 읽어서 컨텍스트 복구해:
1. thoughts/sessions/20260513-1418_session_record.md  (이번 세션 핵심)
2. thoughts/sessions/20260424-1656_phase0.5_완료_session_record.md  (Phase 0.5 컨텍스트)

읽고 나면 현재 prod 상태 한 줄로 확인하고, 운영 체크 3건 먼저 실행해서 결과 보고해.

## 운영 체크 1 — 데이터 정합성 유지 확인 (Supabase MCP)

```sql
SELECT
  (SELECT COUNT(*) FROM (SELECT farm_id FROM public.memberships
    WHERE status='active' AND farm_id IS NOT NULL GROUP BY farm_id HAVING COUNT(*)>1) sub) AS duplicate_active,
  (SELECT COUNT(*) FROM public.farm_rentals fr WHERE fr.status='active' AND fr.farm_id IS NOT NULL AND fr.end_date>=CURRENT_DATE
    AND NOT EXISTS (SELECT 1 FROM public.memberships m WHERE m.member_id=fr.member_id AND m.farm_id=fr.farm_id AND m.status='active')) AS rental_without_ms,
  (SELECT COUNT(*) FROM public.memberships m WHERE m.status='active' AND m.farm_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.farm_rentals fr WHERE fr.member_id=m.member_id AND fr.farm_id=m.farm_id AND fr.status='active')) AS ms_without_rental,
  (SELECT COUNT(*) FROM public.farms f WHERE f.deleted_at IS NULL AND f.status != (
    CASE WHEN EXISTS (SELECT 1 FROM public.memberships WHERE farm_id=f.id AND status='active')
              OR EXISTS (SELECT 1 FROM public.farm_rentals WHERE farm_id=f.id AND status='active' AND end_date>=CURRENT_DATE)
         THEN 'rented' ELSE 'available' END)) AS farm_status_mismatch;
```

기대: 모두 **0**. 0 아니면 062~068 트리거 우회한 직접 SQL 변경 흔적 → 추적 필요.

## 운영 체크 2 — 공지 발행 정상 확인

prod `/dashboard/notices/new` 에서 테스트 공지 1건 작성 → 발행 → 리스트 표시 확인.
또는 SQL:
```sql
SELECT COUNT(*) FROM public.notices WHERE created_at > NOW() - INTERVAL '24 hours';
```

PR #19 hotfix 후 새 공지가 사라지지 않아야 함.

## 운영 체크 3 — pending_deletion 회원 확인

```sql
SELECT id, name, deletion_requested_at,
  EXTRACT(DAY FROM (deletion_requested_at + INTERVAL '30 days' - NOW())) AS days_left
FROM public.members WHERE status='pending_deletion';
```

D-30 임박자 (days_left ≤ 7) 가 있으면 알림톡 자동 발송 필요 — Phase 2 백로그.

체크 3건 결과 보고 후 다음 중 원하는 걸로 진행:

(A) **백로그 정리**
   - Zone 보드 B 화면 (`/dashboard/zones`) — get_zone_dashboard RPC 활용
   - 알림톡 D-30 cron
   - 회원 마이페이지 이전 이력 타임라인
   - ESLint warn → error 복구 (FIXME-LINT-0.5)

(B) **5년 hard delete runbook** (Phase 3) 작성

(C) **새 요구사항** (그때 전달)

체크 3건 결과만 먼저 보고하고 시작해.
```

---

## 부가 참고 (복사 불필요)

### 이번 세션 누적 prod 배포 (10 PR + 12 마이그레이션)
- PR #11~#16: BBQ + 멤버십 + 라이프사이클 + Zone 이전
- PR #17: 데이터 완전 동기화 (062~068)
- PR #18: self-service 탈퇴 + PIPA + 알림톡 (070)
- PR #19: 공지 발행 closure 버그 hotfix (P0)
- PR #20: E2E spec 보정 — 6/6 PASS

### 보호 장치
- UNIQUE INDEX 1 + CHECK 2 + 트리거 5

### 테스트 계정
- admin: admin@pocolush.co.kr / 123456
- Supabase project_id: lhuaxmzsvrmjavanunnv

### 운영 zone
- A존 (40 farm) / B존 (20 farm) — C존, 'ㅇㅇ' 미운영 (is_operational=false)

### 사유 분류
- 063 (라이프사이클): member_request / long_inactive / abuse / duplicate / other
- 064 (Zone 이전): member_request / facility_issue / operational / maintenance / other

### 미사용 — 잃어버린 공지 (P0 버그 피해, 복구 불가)
- 자람터 OT 영상 공지
- 유튜브 영상공지
- 사용자가 재작성해야 함
