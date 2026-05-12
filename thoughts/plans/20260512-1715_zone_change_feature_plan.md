# Zone 변경 기능 구현 플랜 (Phase 1 MVP)

> 2026-05-12 17:15 작성
> 사용자 결정: SCD-2 + 트리거 + 가격차 정산 통합, 가격 정책 **C (어드민 수동 결정)**, UI 듀얼 진입점 (B 보드 우선 + A 모달)

---

## 1. 비즈니스 요건

회원이 텃밭 계약 기간 중 어떤 사유로 **존(zone) 변경 필요**. 어드민이 처리. 계약기간/회원권 유지하고 **존(=farm)만 변경**.

### 핵심 요구
- 어드민이 빈자리를 한 눈에 보면서 회원을 옮길 수 있어야 함 ← 사용자 핵심 우려
- 변경 이력 보존 (감사 + 분쟁 대응)
- 가격 차이는 어드민이 수동으로 결정 (입력)
- 회원에게 자동 알림 (변경 사실 통지)

---

## 2. 데이터 모델 (마이그레이션 062)

### 신규 테이블: `membership_zone_history`

```sql
CREATE TABLE public.membership_zone_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id   UUID NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES public.members(id),

  -- 이전 위치
  from_farm_id    UUID REFERENCES public.farms(id),
  from_zone_id    UUID REFERENCES public.farm_zones(id),
  from_farm_number INT,  -- 사람이 읽기 좋은 비정규화 (farms 삭제 후에도 보존)

  -- 새 위치
  to_farm_id      UUID NOT NULL REFERENCES public.farms(id),
  to_zone_id      UUID NOT NULL REFERENCES public.farm_zones(id),
  to_farm_number  INT NOT NULL,

  -- 변경 사유
  reason_category TEXT NOT NULL CHECK (reason_category IN (
    'member_request',      -- 회원 요청
    'facility_issue',      -- 시설 문제 (그늘/배수 등)
    'operational',         -- 운영 조정
    'maintenance',         -- 정비/공사
    'other'
  )),
  reason_memo     TEXT,

  -- 가격 정산 (정책 C: 어드민 수동 입력)
  price_diff_krw  INT NOT NULL DEFAULT 0,  -- 양수=추가 청구, 음수=환불, 0=면제
  settlement_note TEXT,                     -- 정산 처리 메모 (현금/이체/면제 등)

  -- 메타
  effective_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by      UUID NOT NULL REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mzh_membership ON public.membership_zone_history (membership_id);
CREATE INDEX idx_mzh_member ON public.membership_zone_history (member_id, created_at DESC);
CREATE INDEX idx_mzh_changed_by ON public.membership_zone_history (changed_by);
```

### RPC: `change_membership_zone`

```sql
CREATE FUNCTION public.change_membership_zone(
  p_membership_id   UUID,
  p_new_farm_id     UUID,
  p_reason_category TEXT,
  p_reason_memo     TEXT DEFAULT NULL,
  p_price_diff_krw  INT DEFAULT 0,
  p_settlement_note TEXT DEFAULT NULL
) RETURNS public.membership_zone_history
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_admin_id  UUID;
  v_old_membership public.memberships;
  v_new_farm  public.farms;
  v_conflict  UUID;
  v_history   public.membership_zone_history;
BEGIN
  -- 1. admin 권한 검증
  v_admin_id := auth.uid();
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'NOT_ADMIN' USING ERRCODE = '42501';
  END IF;

  -- 2. 기존 멤버십 + 활성 확인
  SELECT * INTO v_old_membership
  FROM public.memberships
  WHERE id = p_membership_id
  FOR UPDATE;
  IF v_old_membership.id IS NULL THEN
    RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND';
  END IF;
  IF v_old_membership.status != 'active' THEN
    RAISE EXCEPTION 'MEMBERSHIP_NOT_ACTIVE';
  END IF;
  IF v_old_membership.farm_id = p_new_farm_id THEN
    RAISE EXCEPTION 'SAME_FARM';
  END IF;

  -- 3. 새 farm 활성 + 비점유 검증
  SELECT * INTO v_new_farm FROM public.farms WHERE id = p_new_farm_id;
  IF v_new_farm.id IS NULL THEN
    RAISE EXCEPTION 'FARM_NOT_FOUND';
  END IF;

  SELECT id INTO v_conflict
  FROM public.memberships
  WHERE farm_id = p_new_farm_id AND status = 'active'
    AND id != p_membership_id
  LIMIT 1;
  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION 'FARM_ALREADY_TAKEN';
  END IF;

  -- 4. 이력 INSERT (BEFORE 트리거가 자동으로 from_* 채우면 더 깔끔, 여기선 명시 INSERT)
  INSERT INTO public.membership_zone_history (
    membership_id, member_id,
    from_farm_id, from_zone_id, from_farm_number,
    to_farm_id, to_zone_id, to_farm_number,
    reason_category, reason_memo,
    price_diff_krw, settlement_note,
    changed_by
  )
  SELECT
    v_old_membership.id, v_old_membership.member_id,
    v_old_membership.farm_id, of.zone_id, of.number,
    v_new_farm.id, v_new_farm.zone_id, v_new_farm.number,
    p_reason_category, p_reason_memo,
    p_price_diff_krw, p_settlement_note,
    v_admin_id
  FROM public.farms of WHERE of.id = v_old_membership.farm_id
  RETURNING * INTO v_history;

  -- 5. memberships.farm_id 업데이트
  UPDATE public.memberships
  SET farm_id = p_new_farm_id, updated_at = NOW()
  WHERE id = p_membership_id;

  -- 6. audit_logs (조직 표준 로깅)
  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  VALUES (
    v_admin_id, 'change_membership_zone', 'membership', p_membership_id,
    jsonb_build_object(
      'history_id', v_history.id,
      'from_farm', v_history.from_farm_number,
      'to_farm', v_history.to_farm_number,
      'price_diff_krw', p_price_diff_krw,
      'reason', p_reason_category
    )
  );

  RETURN v_history;
END $$;

GRANT EXECUTE ON FUNCTION public.change_membership_zone TO authenticated;
```

### RPC: `get_zone_dashboard` (빈자리 보드 데이터)

```sql
CREATE FUNCTION public.get_zone_dashboard()
RETURNS TABLE (
  zone_id UUID,
  zone_name TEXT,
  total_farms INT,
  occupied INT,
  available INT
) LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT
    z.id, z.name,
    COUNT(f.id)::INT,
    COUNT(m.id) FILTER (WHERE m.status = 'active')::INT,
    (COUNT(f.id) - COUNT(m.id) FILTER (WHERE m.status = 'active'))::INT
  FROM public.farm_zones z
  LEFT JOIN public.farms f ON f.zone_id = z.id AND f.is_active = TRUE
  LEFT JOIN public.memberships m ON m.farm_id = f.id
  WHERE z.is_active = TRUE
  GROUP BY z.id, z.name
  ORDER BY z.name;
$$;
```

### RLS

```sql
ALTER TABLE public.membership_zone_history ENABLE ROW LEVEL SECURITY;

-- 회원 본인 + admin
CREATE POLICY "mzh_select" ON public.membership_zone_history
FOR SELECT USING (
  member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- admin 만 INSERT (RPC 경유, 직접 INSERT 차단)
CREATE POLICY "mzh_insert_admin" ON public.membership_zone_history
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
```

---

## 3. UI/UX 구현 (UX 에이전트 권고 = 듀얼 진입점, MVP 는 B 우선)

### 3.1 Phase 1 MVP — B (Zone 보드) 먼저

#### 화면 1: Zone 보드 메인
- 경로: `/dashboard/zones`
- 표시: zone 별 카드 (총 farms / 점유 / 빈자리 ●)
- 헤더: 전체 빈자리 카운트 + 회원 검색바
- 카드 클릭 → 화면 2

```
[Zone 관리] /dashboard/zones
┌─────────────────────────────────────────────────────┐
│ 전체 빈자리: 7  |  회원 검색: [이름/연락처]  필터▾  │
├─────────────┬─────────────┬───────────────────────┤
│ A존  12/15  │ B존  8/10   │ C존  5/8              │
│ 빈자리 3 ●  │ 빈자리 2 ●  │ 빈자리 3 ●            │
└─────────────┴─────────────┴───────────────────────┘
```

#### 화면 2: Zone 상세 그리드
- 경로: `/dashboard/zones/[zoneId]`
- 표시: 해당 zone 의 farms 그리드 (번호 + 점유 회원명 또는 빈자리)
- 빈자리 클릭 → "이 자리로 옮길 회원 선택" 모달 (검색)
- 점유 자리 클릭 → "이 회원을 다른 곳으로 이전" 모달 (zone 별 빈자리 라디오)

```
[A존 상세] /dashboard/zones/{A_id}
┌──────────────────────────────────────┐
│ A존 자리 현황                          │
│ ┌──┬──┬──┬──┬──┐                       │
│ │A1│A2│A3│A4│A5│  ● 점유 (김OO)      │
│ │김 │이│○ │박 │○ │  ○ 빈자리 (클릭)   │
│ └──┴──┴──┴──┴──┘                       │
└──────────────────────────────────────┘
```

### 3.2 Phase 1 MVP — A (회원 상세 모달) 동시 구현

#### 회원 상세 → "Zone 이전" 버튼
- 위치: `app/dashboard/members/[id]/page.tsx` 멤버십 섹션
- 클릭 → 모달

#### 모달 컴포넌트: `ZoneTransferModal`

##### 2-단계 플로우 (kk 결정)
**Step 1: 가격 차이 선입력 + 자동 검증**
- 어드민이 새 자리 + 가격 차이 + 사유 + 메모 입력
- "검증" 버튼 → 서버 검증 RPC (`validate_zone_change`) 호출
- 검증 통과 시 → Step 2 활성화
- 검증 실패 시 → 인라인 에러 표시 + 수정 후 재검증

**Step 2: 최종 확인 + 이전 진행**
- 검증 완료된 정보를 요약 카드로 표시
- "이전 확정" 버튼 → `change_membership_zone` RPC 실행 + 알림 발송

```
┌────────────────────────────────────────┐
│ 김OO 회원 — Zone 이전                   │
│ ─────────────────────────────────────  │
│ 현재: A존 A2  (계약 2026-12-31까지)     │
│                                         │
│ [Step 1] 정보 입력                       │
│   이동할 자리: [A존 ▾] [○A3 ○A5 ○A8]    │
│   사유 *:   [회원 요청 ▾]                │
│   메모:     [____________________]      │
│   가격 차이: [_____] 원                  │
│              (양수=청구/음수=환불/0=면제)│
│   정산 메모: [____________________]     │
│                                         │
│   [검증하기]                             │
│                                         │
│ ── 검증 결과 (RPC 응답 후 표시) ──       │
│ ✅ 새 자리 비어 있음                     │
│ ✅ 멤버십 active 확인                    │
│ ✅ 가격 차이 +30,000원 청구 예정          │
│ ─ 또는 ─                                 │
│ ❌ 선택한 자리 이미 점유됨 → 다른 자리 선택│
│ ❌ 멤버십 만료 → 변경 불가                │
│                                         │
│ [Step 2] 이전 확정                       │
│ ─────────────────────────────────────  │
│ A존 A2 → B존 B4                          │
│ 청구액: 30,000원                          │
│ 사유: 시설 문제 / "그늘 심함"             │
│ [취소]  [이전 확정 ✓]                    │
└────────────────────────────────────────┘
```

##### 검증 RPC: `validate_zone_change` (062)
```sql
CREATE FUNCTION public.validate_zone_change(
  p_membership_id UUID,
  p_new_farm_id UUID
)
RETURNS TABLE (
  ok BOOLEAN,
  error_code TEXT,
  error_message TEXT,
  current_zone_name TEXT,
  current_farm_number INT,
  new_zone_name TEXT,
  new_farm_number INT,
  membership_end_date DATE
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_m public.memberships; v_new public.farms; BEGIN
  -- admin 검증, 멤버십 active, 새 farm 비어있음, 같은 farm 아님 등
  -- 가격 차이는 어드민이 수동 입력하므로 별도 검증 불필요
  -- 에러 발견 시 ok=false + error_code 반환
  -- 정상 시 ok=true + 표시 정보 반환 (zone 이름, farm 번호, 계약 만료일)
END $$;
```

##### UX 효과
- 어드민 실수 사전 차단 (검증 통과 후에만 "이전 확정" 활성)
- 검증 결과를 명확히 표시 → 어드민 자신감 증가
- 이상 있을 시 모달 안에서 즉시 수정 (페이지 이탈 없음)

### 3.3 회원 측 영향

- 회원 마이페이지 (`/member/mypage`) 의 회원권 카드에 새 farm 번호 자동 반영
- 알림 발송 (Server Action `sendNotification`):
  ```
  📍 농장 자리 변경 안내
  A존 A2 → B존 B4 로 변경되었습니다.
  사유: 시설 문제 (그늘로 인한 작물 생장 부진)
  ```
- 마이페이지에 "이전 이력" 보기 링크 (Phase 2)

---

## 4. 파일 변경 목록

### 신규
| 파일 | 내용 |
|---|---|
| `supabase/migrations/062_membership_zone_change.sql` | 테이블 + RPC 3개 + RLS |
| `app/dashboard/zones/page.tsx` | Zone 보드 메인 |
| `app/dashboard/zones/[zoneId]/page.tsx` | Zone 상세 그리드 |
| `components/admin-zones/ZoneCard.tsx` | 보드 카드 |
| `components/admin-zones/FarmGrid.tsx` | 자리 그리드 |
| `components/admin-zones/ZoneTransferModal.tsx` | 이전 모달 (재사용) |
| `components/admin-zones/MemberSearchPicker.tsx` | 빈자리 → 회원 선택 |
| `lib/use-zone-dashboard.ts` | 보드 데이터 훅 |
| `lib/zone-transfer.ts` | RPC 호출 + 알림 발송 |

### 수정
| 파일 | 변경 |
|---|---|
| `app/dashboard/members/[id]/page.tsx` | "Zone 이전" 버튼 + 모달 마운트 |
| `app/dashboard/layout.tsx` (or nav) | "Zone 관리" 메뉴 추가 |
| `types/index.ts` | `MembershipZoneHistory` 타입 |
| `lib/notifications.ts` | "zone_transfer" 알림 타입 (필요 시 추가) |

---

## 5. 검증 시나리오 (E2E)

### 단위
1. RPC `change_membership_zone` — admin 권한 없으면 NOT_ADMIN
2. 같은 farm_id 로 변경 → SAME_FARM
3. 이미 점유된 farm 으로 변경 → FARM_ALREADY_TAKEN
4. 비활성 멤버십 변경 시도 → MEMBERSHIP_NOT_ACTIVE
5. 정상 케이스 → history 1건 INSERT + memberships.farm_id 변경 + audit_logs

### 시나리오
1. 어드민이 Zone 보드 진입 → A존 빈자리 클릭 → 회원 검색 → 김OO 선택 → 사유 + 가격차 입력 → 확정 → 보드에 즉시 반영
2. 어드민이 회원 상세 → "Zone 이전" 버튼 → 모달 → A2→B4 → 확정 → 회원 마이페이지 새 위치 반영
3. (반복 이전 가드 제거됨 — kk 결정) 같은 회원 여러 번 이전 가능, 제한 없음

### 동시성
- 같은 빈자리에 두 어드민이 동시 배정 시도 → 한 명만 성공 (RPC 의 `FOR UPDATE` + UNIQUE 가드)
- 회원의 활성 멤버십 1:1 보장 (memberships.farm_id 가 active + UNIQUE)

---

## 6. Phase 분리 + 작업량 추정

| Phase | 내용 | 기간 |
|---|---|---|
| **Phase 1 MVP** | 062 마이그레이션 + A 모달 + B 보드 + 알림 | **3-4일** |
| Phase 2 | 글로벌 단축 메뉴 + 이전 이력 타임라인 + 회원 self-service | 2-3일 |
| Phase 3 | 예약된 이전 (미래 일자) + 일괄 이전 + 대시보드 위젯 | 백로그 |

---

## 6.5 QA 검수 반영 사항 (2026-05-12 17:30)

### BLOCKER (구현 전 결정 필수)

#### B-1. `farm_rentals.farm_id` 동기화 여부
- `015_farm_rentals_member_id.sql` 의 `farm_rentals` 가 active 상태로 운영 중이면 zone 변경 시 함께 UPDATE 필요.
- **결정 필요**: `farm_rentals` 가 현재 사용 중인가? 사용 중이라면 RPC 내에서 함께 UPDATE.
- 해결 SQL (062 RPC 안에 추가):
  ```sql
  UPDATE public.farm_rentals
  SET farm_id = p_new_farm_id, updated_at = NOW()
  WHERE member_id = v_old_membership.member_id AND status = 'active';
  ```

#### B-2. `memberships` UNIQUE 제약 (race 방지)
- 현재 같은 farm 에 두 active 멤버십 동시 가능 (race 시 둘 다 성공)
- 해결: 062 마이그레이션에 추가
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_farm_membership
    ON public.memberships(farm_id) WHERE status = 'active';
  ```
- ⚠️ 적용 전 기존 데이터 검증 필요: 이미 중복된 active 멤버십 없는지 확인

### HIGH (구현 중 반영)

#### H-1. `service_orders.farm_id` 참조 검증
- 진행 중 서비스 주문 (`pending`, `processing`) 있을 때 zone 변경 시 모달에 경고:
  ```
  ⚠️ 진행 중인 서비스 주문 N건. 이전 후에도 자동 인계되나 확인 필요.
  ```
- `validate_zone_change` RPC 반환에 `pending_service_orders INT` 추가

#### H-2. validate → change 사이 race 자동 복구
- Step 2 확정 단계에서 `change_membership_zone` RPC 가 다시 검증 (`FOR UPDATE` 락 이미 포함)
- `FARM_ALREADY_TAKEN` 발생 시 모달 토스트 + Step 1 으로 복귀

#### H-3. 가격 경계값 가드
- DB CHECK: `price_diff_krw BETWEEN -99999999 AND 99999999`
- UI 가드:
  - 음수 입력 시 `settlement_note` 필수
  - `|price_diff_krw| > 1,000,000` 시 confirm 다이얼로그

#### H-4. 알림 발송 실패 처리
- `sendNotification` 실패해도 zone 변경 자체는 성공 → toast 로 어드민에 안내
- Phase 2 백로그: 재시도 큐 또는 어드민 대시보드 alert

#### H-5. RLS changed_by 노출 (정당화)
- 회원 본인이 `membership_zone_history` 조회 시 `changed_by` admin user_id 노출
- 감사 정당성 + 회원이 누가 처리했는지 알 권리 → 허용
- 회원 마이페이지에서는 admin 이름은 가리고 "관리자" 로만 표시

### OK (수정 불필요)
- 데이터명 일관성 ✅
- 트랜잭션 atomic ✅
- RPC SECURITY DEFINER 권한 검증 ✅
- 이력 보존 SCD-2 ✅
- 비밀정보 노출 없음 ✅

### 권고 (선택)
- `validate_zone_change` STABLE + 빈자리 0개 시 UI 가드 ("빈자리 없음" 표시)
- 알림 재시도 큐 — Phase 2 백로그

---

## 7. 알려진 제약 / 미해결

1. **`farm_rentals` 동기화** — `015_farm_rentals_member_id.sql` 에 `farm_id` 가 있다면 함께 UPDATE 필요. 마이그레이션 062 작성 시 015 구조 재확인.
2. **`service_orders` farm_id 참조** — 진행 중인 서비스 주문이 있을 때 zone 변경 시 사진 등 이력 유지 방식 결정 (현재 컬럼 nullable 인지 확인).
3. **반복 이전 정책** — 제거됨 (kk 결정, 횟수 제한 없음). 이력은 `membership_zone_history` 에 모두 보존되므로 사후 분석 가능.
4. **회원 본인 이력 노출** — 회원 마이페이지에 "이전 이력" 탭 추가는 Phase 2.

---

## 8. 다음 단계 (kk 승인 대기)

이 플랜대로 진행해도 될까요? 승인 시:
1. `/research` 단계 스킵 (이미 8스킬 리서치 완료, 본 플랜에 통합)
2. `/implement` 로 062 마이그레이션 + UI 컴포넌트 + RPC 호출 구현
3. 구현 후 8스킬 검수 + E2E 시나리오 5건 검증
4. prod 적용 + Vercel 배포

추가 검토 / 변경 사항 있으면 알려주세요.
