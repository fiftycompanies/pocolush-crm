# 회원권 자동 발급 + 정지 플로우 재정비 플랜

**작성일**: 2026-04-16
**영향 범위**: farm_rentals, memberships, member_status_logs, RentalForm, rentals/[id], member detail
**kk 승인**: (대기 중)

---

## 1. 결정 사항 (사용자 확정)

- **기간**: 플랜의 `duration_months` + 관리자 입력 조합(B+C 하이브리드). **발급 전/후 모두 수정 가능**.
- **발급 방식**: 자동 발급 유지 (현 트리거 방식). 대신 잘못된/취소 케이스는 **"회원권 정지" 버튼**으로 관리자가 롤백.
- **검수**: 8스킬 + 7점 + 데이터 연결 + 사이드이펙트 검수 완료.

## 2. 목표

1. `farm_rentals` 생성 시 `member_id` 자동 연결 (폴백 유지)
2. 자동 발급 트리거를 **rental 기간·플랜 기준**으로 수정
3. 관리자가 발급 전/후 회원권 기간 수정 가능
4. **"회원권 정지"** 버튼 신설 (rental 상세 + member 상세 양쪽)
5. 발급 상태 가시성 UI 추가
6. 운영 안전장치: 중복 발급 방지 강화, 롤백 경로 확보

## 3. DB 마이그레이션 (017_membership_issue_v2.sql)

### 3.1 auto_issue_membership 함수 재작성
- start_date: `rental.start_date` 사용 (과거 CURRENT_DATE → 수정)
- end_date: `rental.end_date` 사용 (과거 +1년 고정 → 수정)
- plots: `plans` 테이블 조회 후 `plans.plots` 사용, 매칭 실패 시 기존 CASE 폴백
- 중복 방지: `WHERE member_id = v_member_id AND farm_id = NEW.farm_id AND status IN ('active')` — 동일 농장 active 1개만 차단 (다른 농장 중복 허용)
- 발급 성공/실패 `member_status_logs` 또는 새 로그 테이블에 기록

### 3.2 issue_membership RPC (수동 재발급용)
```sql
issue_membership(p_rental_id UUID) RETURNS UUID
```
- admin role 검증
- rental 로드, 이미 해당 rental 기반 membership 존재 시 에러
- auto_issue_membership과 동일 규칙으로 INSERT

### 3.3 suspend_membership RPC
```sql
suspend_membership(p_membership_id UUID, p_reason TEXT) RETURNS VOID
```
- admin role 검증
- memberships.status = 'cancelled'
- membership_logs INSERT (새 테이블)

### 3.4 resume_membership RPC
```sql
resume_membership(p_membership_id UUID) RETURNS VOID
```
- status = 'active'
- end_date >= CURRENT_DATE 조건 검증 (만료 건은 복원 불가)
- log 기록

### 3.5 update_membership_period RPC
```sql
update_membership_period(p_membership_id UUID, p_start_date DATE, p_end_date DATE) RETURNS VOID
```
- admin role 검증 + end_date > start_date 검증
- log 기록

### 3.6 membership_logs 테이블 신설
```sql
CREATE TABLE membership_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID REFERENCES memberships(id) ON DELETE CASCADE,
  action TEXT CHECK (action IN ('issued', 'suspended', 'resumed', 'period_updated', 'expired')),
  from_status TEXT,
  to_status TEXT,
  from_start DATE, to_start DATE,
  from_end DATE, to_end DATE,
  reason TEXT,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.7 RLS 강화
- `memberships_admin_all` → `profiles.role = 'admin'` 체크 추가
- 새 RPC 4종은 `SECURITY DEFINER` + 내부에서 admin 검증

## 4. 프론트엔드 변경

### 4.1 RentalForm.tsx
- 고객 검색 시 `members` 테이블과 phone 매칭 → member_id 자동 설정
- 화면에 "회원 연결됨 ✓" / "회원 미연결(폴백)" 뱃지 표시
- INSERT 시 `member_id` 포함
- Input 변경 없음, 내부 로직만 보강

### 4.2 rentals/[id]/page.tsx — "회원권" 카드 신설
우측 그리드에 3번째 카드로 추가:

```
┌─ 회원권 ─────────────────┐
│ 상태: 🟢 활성            │
│ 코드: poco-382910         │
│ 기간: 2026-04-16 ~ 12-31  │
│ 플랜: 씨앗 (1구좌)         │
│                          │
│ [ 기간 수정 ] [ 정지 ]    │
└─────────────────────────┘
```

미발급 상태:
```
┌─ 회원권 ─────────────────┐
│ ⏳ 미발급                  │
│ 조건: 납부완료 후 자동발급 │
│                          │
│ [ 수동 발급 ] (disabled   │
│  until rental.payment_   │
│  status='납부완료')        │
└─────────────────────────┘
```

### 4.3 MemberOverviewTab.tsx / MemberSidebar
- metric 카드에 "회원권" 추가 (현재 3개 → 4개)
- "회원권 발행" 활동 아이템은 이미 있음 — 정지/재개 이벤트도 추가

### 4.4 신규 컴포넌트
- `components/memberships/MembershipCard.tsx` — rental 상세 + member 상세에서 공용
- `components/memberships/SuspendDialog.tsx` — 정지 사유 입력 모달
- `components/memberships/PeriodEditDialog.tsx` — 기간 수정 모달 (DatePicker × 2)

## 5. 구현 단계 및 순서

1. **DB 마이그레이션** (`017_membership_issue_v2.sql`) 작성
2. **RentalForm.tsx** member_id 연결 로직 추가
3. **MembershipCard + dialogs** 신규 컴포넌트 구현
4. **rentals/[id]/page.tsx** 회원권 카드 연결
5. **MemberOverviewTab.tsx** metric 카드에 회원권 추가
6. **types/index.ts** 타입 업데이트 (membership_logs 등)
7. **E2E 테스트**: rental 생성 → 납부완료 → 회원권 자동 발급 → 정지 → 재개
8. **기존 데이터 확인 쿼리** 작성 (member_id 미연결 rental 리스트)

## 6. 마이그레이션 안전장치

- **Idempotent 트리거**: 같은 rental 같은 farm에 이미 active 회원권 있으면 skip (기존 유지, 조건 강화)
- **백필 쿼리 재실행**: 015에서 이미 백필했지만 다시 한 번 실행 (phone 매칭 실패한 케이스는 수동 UI로 보정 유도)
- **정지 → 재개 안전성**: resume 시 end_date 경과 건은 'active' 복원 거부 → 새 회원권 발급 권장

## 7. 리스크

| 리스크 | 완화 |
|--------|------|
| 기존 fixed 1년 회원권과 신규 가변 기간 회원권 혼재 | 관리자 UI로 일괄 조회 + 기간 편집 가능하므로 수동 정리 가능 |
| 트리거 v2 배포 후 기존 payment_status='납부완료' 건 재트리거 (OLD != NEW 체크 때문에 안 걸림) | 정상. 재배포 시 일회성 보정 쿼리 필요시만 실행 |
| RLS 강화로 기존 권한자 접근 거부 | profiles.role 현황 먼저 확인 후 배포 |
| suspend 동시에 change_member_status(suspended)가 돌아가 이중 UPDATE | suspend_membership RPC는 해당 1건만, change_member_status는 member의 모든 active만. 같은 행을 두 번 UPDATE해도 결과 동일. 충돌 없음 |

## 8. 완료 기준

- [ ] rental 신규 생성 시 member_id 자동 연결 확인
- [ ] rental 기간대로 회원권 발급 확인 (3/6/12개월)
- [ ] 회원권 카드에서 기간 수정 성공
- [ ] "정지" 버튼으로 회원권 status='cancelled' 전환
- [ ] "재개" 버튼으로 status='active' 복원
- [ ] membership_logs에 모든 이벤트 기록
- [ ] TypeScript 컴파일 에러 0
- [ ] 7점 체크리스트 통과

## 9. kk 피드백

(kk가 여기에 메모)

---

## 변경될 파일 목록

**신규**:
- `supabase/migrations/017_membership_issue_v2.sql`
- `components/memberships/MembershipCard.tsx`
- `components/memberships/SuspendDialog.tsx`
- `components/memberships/PeriodEditDialog.tsx`

**수정**:
- `components/rentals/RentalForm.tsx`
- `app/dashboard/rentals/[id]/page.tsx`
- `components/admin-members/MemberOverviewTab.tsx`
- `types/index.ts`
