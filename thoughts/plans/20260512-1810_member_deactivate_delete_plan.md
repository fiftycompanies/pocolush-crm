# 회원 비활성화 + 삭제 기능 구현 플랜

> 2026-05-12 18:10 작성 (Phase 1 MVP)
> 8스킬 리서치 (우리 데이터 + SaaS UI/UX) 기반

---

## 1. 비즈니스 요건

어드민이 회원 관리 **리스트** + **상세 페이지**에서 회원을 **비활성화(reversible)** + **삭제(soft + 30일 유예)** 처리 가능해야 함. PIPA + 전자상거래법(거래기록 5년 보관) 정합 필수.

---

## 2. 현재 시스템 (조사 결과)

### 2.1 `members.status` enum
```sql
CHECK (status IN ('pending', 'approved', 'suspended', 'withdrawn'))
```
- `pending` 가입 대기 / `approved` 정상 / `suspended` 정지 / `withdrawn` 탈퇴(미사용)

### 2.2 기존 RPC
- `change_member_status(p_member_id, p_new_status, p_reason, p_changed_by)` — 016/010
- `suspended → approved` 시 멤버십/예약 자동 복구 (027)

### 2.3 FK CASCADE (⚠️ hard delete 시 위험)
```
members 삭제 →
  memberships (CASCADE) — 활성 멤버십도 함께 삭제
  bbq_reservations (CASCADE)
  service_orders (CASCADE)
  coupon_issues (CASCADE)
  member_notifications (CASCADE)
  member_status_logs (CASCADE)
  farm_rentals (CASCADE)
  auth.users (CASCADE)   ← 로그인 계정까지 삭제
```
**결론**: hard delete 는 5년 보관 의무 위반 + 정산 불가. **soft delete + PII 마스킹 + 5년 후 hard delete** 모델 필수.

### 2.4 누락된 기능
- 회원 리스트 (`app/dashboard/members/page.tsx`) 에 비활성화/삭제 액션 없음
- 회원 상세 (`app/dashboard/members/[id]/page.tsx`) 에 Danger Zone 섹션 없음
- `withdrawn` 상태가 enum 에는 있으나 사용처 0건

---

## 3. 권고 설계 (Two-tier: 비활성화 + 소프트 삭제)

### 3.1 status enum 확장 (063 마이그레이션)

| 상태 | 의미 | 복구 | 로그인 | 마스킹 |
|---|---|---|---|---|
| `pending` | 가입 대기 | - | ✗ | ✗ |
| `approved` | 정상 활성 | - | ✓ | ✗ |
| `suspended` | 비활성화 (어드민 잠금) | ✓ 즉시 | ✗ | ✗ |
| `pending_deletion` | 삭제 신청, 30일 grace | ✓ 30일 내 가능 | ✗ | ✗ |
| `deleted` | PII 마스킹 완료, 거래기록 5년 보관 | ✗ 불가 | ✗ | ✓ |

**기존 `withdrawn`** → 미사용이므로 enum 에서 제거 또는 `deleted` 로 alias 유지

### 3.2 신규 컬럼

```sql
ALTER TABLE public.members
  ADD COLUMN suspended_at        TIMESTAMPTZ,
  ADD COLUMN suspended_reason    TEXT,
  ADD COLUMN suspended_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  ADD COLUMN deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN deletion_reason     TEXT,
  ADD COLUMN deletion_requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  ADD COLUMN deleted_at          TIMESTAMPTZ,     -- 30일 후 PII 마스킹 시점
  ADD COLUMN pii_purged          BOOLEAN DEFAULT FALSE;
```

### 3.3 신규 RPC

#### `suspend_member(p_member_id, p_reason)`
- admin 권한 검증
- `members.status = 'suspended'`, `suspended_at = NOW()`, `suspended_reason`, `suspended_by`
- 활성 멤버십/예약은 016/027 패턴 따라 처리 (기존 `change_member_status` 호출)
- audit_logs 기록

#### `unsuspend_member(p_member_id)`
- admin 권한 검증
- `members.status = 'approved'`, `suspended_*` clear
- 027 패턴 따라 멤버십/예약 복구
- audit_logs

#### `request_member_deletion(p_member_id, p_reason)`
- admin 권한 검증
- `members.status = 'pending_deletion'`, `deletion_requested_at = NOW()`
- 활성 멤버십/예약/주문 즉시 처리:
  - 미래 예약 → cancelled
  - 활성 멤버십 → suspended (보존, 환불 정산 별도)
- 회원에게 알림 (선택, kk 결정 사항)
- audit_logs

#### `restore_member_deletion(p_member_id)`
- admin 권한 검증
- `pending_deletion → approved`, `deletion_*` clear
- 30일 grace 내에만 호출 가능 (서버 측 가드)

#### `purge_member_pii(p_member_id)` — cron 호출용
- `pending_deletion` + `deletion_requested_at < NOW() - INTERVAL '30 days'` 대상
- PII 마스킹: `name='탈퇴회원'`, `phone='***'`, `address='***'`, `car_number=NULL`, `email='deleted_<id>@deleted.local'`
- `members.status = 'deleted'`, `deleted_at = NOW()`, `pii_purged = TRUE`
- `auth.users` 는 보존 (로그인 차단만)
- audit_logs (PIPA 5년 보관용)

### 3.4 Cron — 30일 grace 자동 처리

```sql
SELECT cron.schedule(
  'purge_pending_deletion_members',
  '0 18 * * *',  -- 매일 KST 03:00
  $cron$
    DO $$ DECLARE r RECORD; BEGIN
      FOR r IN
        SELECT id FROM public.members
        WHERE status = 'pending_deletion'
          AND deletion_requested_at < NOW() - INTERVAL '30 days'
      LOOP
        PERFORM public.purge_member_pii(r.id);
      END LOOP;
    END $$;
  $cron$
);
```

### 3.5 RLS 조정

```sql
-- 회원 본인이 자기 데이터 조회 시 deleted 는 제외
DROP POLICY IF EXISTS "members_select_own" ON public.members;
CREATE POLICY "members_select_own" ON public.members
  FOR SELECT USING (
    (user_id = auth.uid() AND status != 'deleted')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## 4. UI/UX (UI/UX Pro 권고 반영)

### 4.1 회원 리스트 (`app/dashboard/members/page.tsx`)

#### 행별 액션 메뉴 (⋮ 점 3개)
```
┌────────────────────────────────────────────────────┐
│ 이름      상태       가입일     마지막 로그인   ⋮  │
├────────────────────────────────────────────────────┤
│ 김민수    ● 활성     25-03-01   25-05-10 14:22  ⋮  │
│                                          ┌────────┐│
│                                          │상세보기 ││
│                                          │ ─────── ││
│                                          │⚠ 비활성 ││
│                                          │⛔ 삭제   ││
│                                          └────────┘│
│ 박지훈    ✕ 삭제됨    25-01-08   --             ⋮  │
└────────────────────────────────────────────────────┘
필터: [전체] [활성] [비활성] [삭제 대기] [삭제됨]
```

#### 상태 칩 색상
- `active`/`approved` → green
- `pending` → amber
- `suspended` → gray
- `pending_deletion` → orange (D-{남은일수} 표시)
- `deleted` → red, 클릭 불가능

### 4.2 회원 상세 (`app/dashboard/members/[id]/page.tsx`)

#### Danger Zone (페이지 하단)
```
╔════════ ⚠ 위험 구역 (Danger Zone) ════════════════╗
║                                                    ║
║ 계정 비활성화                                       ║
║ 로그인 차단 + 활성 멤버십/예약 일시정지.           ║
║ 언제든 [재활성화]로 복원 가능.        [비활성화]  ║
║ ──────────────────────────────────────────────   ║
║ 계정 삭제 신청                                      ║
║ 30일 후 개인정보 자동 파기 (PIPA).                 ║
║ 거래·정산 기록은 5년간 별도 보관됩니다.            ║
║ 30일 내 복원 가능.                  [삭제 신청]  ║
╚════════════════════════════════════════════════════╝
```

### 4.3 모달

#### Modal A: 비활성화 (간단)
```
┌─ ⚠ 비활성화 ─────────────────────[X]─┐
│ '김민수' 계정을 비활성화하시겠습니까? │
│                                       │
│ • 로그인 차단                          │
│ • 활성 예약 일시 취소                  │
│ • 언제든 재활성화 가능                 │
│                                       │
│ 사유 [▼ 선택 *]                       │
│ ▼ 회원 요청 / 부정사용 / 운영 / 기타  │
│ 메모(선택): [_________________]       │
│                                       │
│           [취소] [비활성화 (회색)]   │
└───────────────────────────────────────┘
```
- 실행 후 5초 undo toast: `"비활성화됨. [실행 취소]"`

#### Modal B: 삭제 (3단계 confirm)
```
┌─ ⛔ 계정 삭제 신청 ──────────────[X]─┐
│ '김민수' 계정을 삭제 신청합니다.       │
│                                        │
│ • 30일 후 개인정보 자동 파기            │
│ • 거래·정산 기록은 5년 분리 보관       │
│ • 30일 내 [복원] 가능                  │
│                                        │
│ 사유 [▼ 선택 *]                       │
│ ▼ 본인 요청 / 부정사용 / 1년 휴면 / 기타│
│                                        │
│ 확인을 위해 회원명을 입력하세요 *      │
│ [김민수_______________________]        │
│                                        │
│       [취소]  [삭제 신청 (빨강)]      │
└────────────────────────────────────────┘
↑ 이름 정확 일치 + 사유 선택 시에만 빨강 버튼 활성
↑ 기본 포커스는 이름 입력 필드 (취소 키 X)
```

### 4.4 신규 라우트 — 30일 grace 상태 표시
- 회원 상세 페이지 상단 배너:
  ```
  ⚠️ 이 회원은 삭제 대기 중 (D-25, 06/06 자동 파기)
  [복원] 클릭
  ```

---

## 5. 파일 변경 목록

### 신규 파일
| 파일 | 내용 |
|---|---|
| `supabase/migrations/063_member_lifecycle.sql` | enum 확장 + 컬럼 + RPC 5개 + cron + RLS |
| `components/admin-members/DangerZone.tsx` | 상세 페이지 위험 영역 섹션 |
| `components/admin-members/SuspendMemberModal.tsx` | 비활성화 모달 (사유 드롭다운) |
| `components/admin-members/DeleteMemberModal.tsx` | 삭제 3단계 confirm 모달 |
| `components/admin-members/MemberActionsMenu.tsx` | 리스트 행 ⋮ 액션 메뉴 |
| `components/admin-members/PendingDeletionBanner.tsx` | D-N 표시 + 복원 버튼 |
| `lib/use-member-actions.ts` | RPC 호출 + 알림 + audit 통합 훅 |

### 수정 파일
| 파일 | 변경 |
|---|---|
| `app/dashboard/members/page.tsx` | 상태 필터 탭 추가 + 행별 액션 메뉴 + 상태 칩 |
| `app/dashboard/members/[id]/page.tsx` | DangerZone 마운트 + pending_deletion 배너 |
| `types/index.ts` | MemberStatus enum 확장 |
| `lib/use-admin-member-data.ts` | useAdminMembers 가 status 필터 받도록 |

---

## 6. QA 사전 검수 항목

### A. 데이터명
- enum 값 (`pending_deletion`, `deleted`) — 다른 곳에서 사용되는지 grep
- 컬럼명 일관: `suspended_at` / `deletion_requested_at` / `deleted_at` / `pii_purged`

### B. 데이터 연결
- 016 cron `auto_complete_reservations` 가 deleted/suspended 회원의 예약을 어떻게 처리하는지
- 027 reactivate_member 가 `pending_deletion` 에서도 작동하는지 (No, 그건 별도 RPC)
- BBQ 가용성 RPC (061) 가 deleted 회원의 예약을 카운팅에 포함 (현재 status IN ('confirmed','completed') → 회원 deletion 과 무관)

### C. 사이드 이펙트
- 회원 비활성화 시 활성 BBQ 예약 → cancelled 자동 처리 (027 패턴)
- 삭제 신청 시 활성 멤버십 → suspended (보존, 환불 정산 별도)
- 회원이 본인 마이페이지에서 보던 데이터 (deleted 상태) → 로그인 차단됐으므로 접근 불가

### D. 안전 가드
- 비활성화: 이름 입력 없이 모달 confirm
- 삭제: 이름 정확 일치 + 사유 필수 + 30일 grace + audit 5년
- Hard delete 는 **금지** (수동 SQL 만 가능, UI 노출 X)
- Race: 비활성화/삭제 진행 중 다른 어드민이 같은 회원 변경 시도 → `members.updated_at` Optimistic Locking 또는 RPC `FOR UPDATE`

### E. RLS
- 회원 본인 SELECT 시 `status != 'deleted'` 필터 → 마스킹 후에도 본인 조회 차단
- admin 은 모든 상태 조회 가능 (감사)

### F. PIPA / 전자상거래법
- 30일 grace = "사용자 의사 변경 권리" 보장
- PII 마스킹 후에도 `bbq_reservations`/`service_orders` 등 거래기록은 5년 보존 (CASCADE 절대 적용 안 함)
- `audit_logs` 의 `metadata` 에는 PII 직접 저장 금지

### G. 7점 점검
1. 인증/권한: admin role 검증 RPC 내부 ✅
2. 비정상 경로: 30일 grace 자동 복원 가드, race 처리
3. 동시성: `FOR UPDATE` lock
4. DB 정합성: 트랜잭션 + audit_logs atomic
5. 비밀정보: PII 마스킹 + audit 에는 PII 미저장
6. 런타임: tsc + lint clean 필요
7. 배포 대응: Runbook (오삭제 복원 SQL)

---

## 7. Phase 분리

| Phase | 범위 | 기간 |
|---|---|---|
| **Phase 1 MVP (이번)** | 063 마이그레이션 + Suspend RPC + Delete (soft, 30d) + UI 리스트 ⋮ + Danger Zone + 모달 | **3-4일** |
| Phase 2 | 자동 휴면 (1년 미사용 → dormant), 복원 화면, 일괄 처리, 회원 자기 탈퇴 self-service | 백로그 |
| Phase 3 | hard delete (5년 후 거래기록 포함 전체 파기) + Runbook | 5년 후 운영 시점 |

---

## 8. 결정 필요 (kk 승인 사항)

1. **30일 grace 기간** — 적절? (다른 SaaS 는 14일/30일/90일 다양)
2. **사유 드롭다운 항목** — 위 예시 (회원요청/부정사용/운영/1년휴면/기타) OK? 다른 항목 추가?
3. **알림 발송** — 비활성화/삭제 시 회원에게 카톡 알림 발송? 또는 SMS?
4. **`withdrawn` enum 처리** — 제거? 또는 `deleted` 로 alias 유지?
5. **deleted 회원의 audit_logs metadata** — PII 빼고 어디까지 기록? (보통 member_id + 사유 + 어드민 ID)

승인 주시면 063 마이그레이션 작성 → prod 적용 → UI 구현 → 8스킬 검수 → PR 순으로 진행하겠습니다.
