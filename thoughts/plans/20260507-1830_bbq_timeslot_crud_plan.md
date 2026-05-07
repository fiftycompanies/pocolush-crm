# 바베큐 타임슬롯 CRUD 구현 계획

## 목표
하드코딩된 바베큐 타임 슬롯(1~3타임)을 `bbq_time_slots` DB 테이블로 전환하여 관리자가 추가/수정/삭제/활성화 관리할 수 있게 만든다.

## 구현 접근 방식
**옵션 A: 독립 테이블 (`bbq_time_slots`)** 채택

이유:
- 현재 모든 바베큐 시설이 동일 타임 슬롯을 공유하므로 상품 종속 불필요
- 기존 `bbq_reservations.time_slot` 정수 값(1,2,3)과 호환 가능
- 시설/상품 CRUD와 동일한 패턴으로 구현 가능
- 엑셀 export의 시간 불일치 문제도 동시 해결

핵심 결정:
- `time_slot` 컬럼은 기존처럼 `slot_number` 정수로 유지 (FK 참조 추가)
- 타임슬롯 삭제는 soft-delete(is_active=false)로 처리 → 과거 예약 참조 보존
- 예약 테이블에 시간 스냅샷 컬럼은 추가하지 않음 (soft-delete로 충분)

## 변경 파일 목록

### DB 마이그레이션
- [x] `supabase/migrations/059_bbq_time_slots.sql` — 새 테이블 + 시드 + CHECK 제약 변경 + RPC 수정

### 타입
- [x] `types/index.ts` — `BBQTimeSlot` 인터페이스 추가, `BBQReservation.time_slot` 타입 완화

### 상수 파일
- [x] `lib/member-constants.ts` — `TIME_SLOTS` 하드코딩 제거 (폴백용 주석으로 보존)

### 관리자 (BBQ 설정 페이지)
- [x] `app/dashboard/bbq/page.tsx` — 타임슬롯 섹션을 CRUD UI로 교체 (인라인 폼 방식, 시설과 동일 패턴)

### 회원 예약 플로우
- [x] `components/member/TimeSlotSelector.tsx` — DB에서 슬롯 목록 받아서 동적 렌더링
- [x] `app/member/reservation/page.tsx` — 타임슬롯 fetch + 가용성 체크 동적화
- [x] `app/member/reservation/[id]/page.tsx` — 타임슬롯 조회로 전환
- [x] `app/member/reservation/history/page.tsx` — 타임슬롯 조회로 전환
- [x] `app/member/page.tsx` — 다음 예약 타임 표시 동적화

### 관리자 (기타)
- [x] `components/admin-members/MemberBBQTab.tsx` — 타임슬롯 조회로 전환

### API
- [x] `app/api/export/route.ts` — `BBQ_TIME_SLOTS` 하드코딩 제거 → DB 조회

---

## 단계별 구현 순서

### Step 1: DB 마이그레이션 (`059_bbq_time_slots.sql`)
- [x] `bbq_time_slots` 테이블 생성
- [x] 기존 3개 슬롯 시드 데이터 삽입
- [x] `bbq_reservations`의 CHECK 제약 제거 → FK 제약 추가
- [x] `create_bbq_reservation` RPC 재정의 (슬롯 유효성을 새 테이블 기준으로)
- [x] RLS 정책 (전체 읽기 + 어드민 쓰기)
- [x] `updated_at` 트리거

### Step 2: 타입 + 상수 업데이트
- [x] `types/index.ts`에 `BBQTimeSlot` 인터페이스 추가
- [x] `BBQReservation.time_slot` 타입을 `number`로 완화
- [x] `lib/member-constants.ts`에서 `TIME_SLOTS` 제거

### Step 3: 유틸리티 훅 생성
- [x] `lib/use-time-slots.ts` — 타임슬롯 fetch 커스텀 훅 (재사용)
- [x] 슬롯 목록을 `Record<number, {label, time}>` 형태로 변환하는 헬퍼 포함

### Step 4: 관리자 BBQ 설정 페이지 CRUD
- [x] `app/dashboard/bbq/page.tsx`의 타임슬롯 섹션 교체
- [x] 인라인 폼(시설 CRUD와 동일 패턴): 추가/수정/삭제/활성화 토글
- [x] 감사 로깅 (create/update/delete_bbq_time_slot)

### Step 5: 회원 예약 플로우 동적화
- [x] `TimeSlotSelector.tsx` — props로 슬롯 배열 받기, 동적 그리드
- [x] `reservation/page.tsx` — 슬롯 목록 fetch + 가용성 체크 동적화
- [x] `reservation/[id]/page.tsx` — 타임슬롯 조회
- [x] `reservation/history/page.tsx` — 타임슬롯 조회
- [x] `member/page.tsx` — 다음 예약 타임 표시

### Step 6: 관리자 기타 + API
- [x] `MemberBBQTab.tsx` — 타임슬롯 조회
- [x] `export/route.ts` — DB 조회로 대체

### Step 7: 검증
- [x] Supabase 마이그레이션 적용 확인
- [x] 관리자 CRUD 동작 확인 (추가/수정/삭제/토글)
- [x] 회원 예약 플로우 E2E 확인
- [x] 엑셀 export 확인
- [x] 기존 예약 데이터 정상 표시 확인

---

## 코드 스니펫

### 1. DB 마이그레이션 (핵심)
```sql
-- 059_bbq_time_slots.sql

-- (1) 타임슬롯 테이블
CREATE TABLE IF NOT EXISTS public.bbq_time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_number INTEGER UNIQUE NOT NULL,
  label TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- (2) 기존 슬롯 시드
INSERT INTO public.bbq_time_slots (slot_number, label, start_time, end_time, sort_order) VALUES
  (1, '1타임', '11:00', '13:50', 1),
  (2, '2타임', '14:00', '16:50', 2),
  (3, '3타임', '17:00', '19:50', 3)
ON CONFLICT (slot_number) DO NOTHING;

-- (3) CHECK 제약 제거 + FK 추가
ALTER TABLE public.bbq_reservations DROP CONSTRAINT IF EXISTS bbq_reservations_time_slot_check;
ALTER TABLE public.bbq_reservations
  ADD CONSTRAINT bbq_reservations_time_slot_fk
  FOREIGN KEY (time_slot) REFERENCES public.bbq_time_slots(slot_number);

-- (4) RLS
ALTER TABLE public.bbq_time_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY bbq_time_slots_read ON public.bbq_time_slots FOR SELECT USING (true);
CREATE POLICY bbq_time_slots_admin_write ON public.bbq_time_slots FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

-- (5) updated_at 트리거
CREATE TRIGGER bbq_time_slots_updated_at
  BEFORE UPDATE ON public.bbq_time_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- (6) RPC 재정의: 슬롯 유효성을 bbq_time_slots 테이블 기준으로
DROP FUNCTION IF EXISTS public.create_bbq_reservation(UUID, DATE, INTEGER, INTEGER, INTEGER, UUID);

CREATE FUNCTION public.create_bbq_reservation(
  p_member_id UUID, p_date DATE, p_slot INTEGER,
  p_bbq_number INTEGER, p_party_size INTEGER DEFAULT 1,
  p_product_id UUID DEFAULT NULL
) RETURNS public.bbq_reservations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result public.bbq_reservations;
  v_price INTEGER;
  v_product_id UUID;
  v_slot_exists BOOLEAN;
BEGIN
  -- 슬롯 유효성 검증
  SELECT EXISTS(
    SELECT 1 FROM public.bbq_time_slots
    WHERE slot_number = p_slot AND is_active = TRUE
  ) INTO v_slot_exists;
  IF NOT v_slot_exists THEN
    RAISE EXCEPTION 'INVALID_TIME_SLOT';
  END IF;

  v_product_id := p_product_id;
  IF v_product_id IS NULL THEN
    SELECT id INTO v_product_id FROM public.bbq_products
    WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF v_product_id IS NOT NULL THEN
    SELECT public.get_bbq_reservation_price(v_product_id, p_date) INTO v_price;
  END IF;

  INSERT INTO public.bbq_reservations
    (member_id, reservation_date, time_slot, bbq_number, party_size, product_id, snapshotted_price, price)
  VALUES
    (p_member_id, p_date, p_slot, p_bbq_number, p_party_size, v_product_id, v_price, COALESCE(v_price, 30000))
  RETURNING * INTO v_result;
  RETURN v_result;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'SLOT_ALREADY_BOOKED';
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_bbq_reservation(UUID, DATE, INTEGER, INTEGER, INTEGER, UUID) TO authenticated;
```

### 2. 타입 정의
```ts
// types/index.ts 추가
export interface BBQTimeSlot {
  id: string;
  slot_number: number;
  label: string;
  start_time: string;  // 'HH:MM'
  end_time: string;     // 'HH:MM'
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
```

### 3. 커스텀 훅
```ts
// lib/use-time-slots.ts
'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { BBQTimeSlot } from '@/types';

export function useTimeSlots(activeOnly = false) {
  const supabase = createClient();
  const [timeSlots, setTimeSlots] = useState<BBQTimeSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    let q = supabase.from('bbq_time_slots').select('*').order('sort_order');
    if (activeOnly) q = q.eq('is_active', true);
    const { data } = await q;
    setTimeSlots(data || []);
    setLoading(false);
  }, [supabase, activeOnly]);

  useEffect(() => { fetch(); }, [fetch]);

  // TIME_SLOTS 호환 맵 (기존 코드 점진적 전환용)
  const slotMap: Record<number, { label: string; time: string }> = {};
  timeSlots.forEach(s => {
    slotMap[s.slot_number] = {
      label: s.label,
      time: `${s.start_time.slice(0, 5)} ~ ${s.end_time.slice(0, 5)}`,
    };
  });

  return { timeSlots, slotMap, loading, refetch: fetch };
}
```

### 4. 관리자 타임슬롯 CRUD (BBQ 설정 페이지 내 섹션 교체)
```tsx
// app/dashboard/bbq/page.tsx — 타임 슬롯 섹션 교체 (기존 패턴 유지)
{/* 타임 슬롯 CRUD */}
<div className="bg-card border rounded-xl p-6">
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-sm font-semibold">타임 슬롯</h3>
    <button onClick={openNewSlot} className="flex items-center gap-1 text-xs text-primary hover:underline">
      <Plus className="size-3.5" /> 타임 추가
    </button>
  </div>

  {/* 인라인 추가/수정 폼 (showSlotForm일 때) */}
  {showSlotForm && (
    <div className="bg-muted/30 rounded-lg p-4 mb-3 space-y-2">
      <div className="grid grid-cols-4 gap-2">
        <input placeholder="라벨 (예: 4타임)" ... />
        <input type="time" placeholder="시작 시간" ... />
        <input type="time" placeholder="종료 시간" ... />
        <input type="number" placeholder="정렬순서" ... />
      </div>
      <div className="flex gap-2">
        <button onClick={handleSaveSlot}>저장</button>
        <button onClick={() => setShowSlotForm(false)}>취소</button>
      </div>
    </div>
  )}

  {/* 슬롯 리스트 (기존 읽기 전용 → CRUD 액션 추가) */}
  {timeSlots.map(slot => (
    <div key={slot.id} className="flex items-center justify-between py-2 px-3 ...">
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-primary">{slot.label}</span>
        <span className="text-xs text-text-secondary">
          {slot.start_time.slice(0,5)} ~ {slot.end_time.slice(0,5)}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => toggleSlotActive(slot)}>
          {slot.is_active ? <ToggleRight /> : <ToggleLeft />}
        </button>
        <button onClick={() => openEditSlot(slot)}><Edit3 /></button>
        <button onClick={() => handleDeleteSlot(slot)}><Trash2 /></button>
      </div>
    </div>
  ))}
</div>
```

### 5. TimeSlotSelector 동적화
```tsx
// components/member/TimeSlotSelector.tsx
interface Props {
  selectedSlot: number | null;
  onSelect: (slot: number) => void;
  availability?: Record<number, number>;
  timeSlots: BBQTimeSlot[];  // ← DB에서 받은 active 슬롯 배열 추가
}

export default function TimeSlotSelector({ selectedSlot, onSelect, availability, timeSlots }: Props) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">시간 선택</h3>
      <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${timeSlots.length}, 1fr)` }}>
        {timeSlots.map((slot) => (
          <button key={slot.slot_number} onClick={() => onSelect(slot.slot_number)} ...>
            <Clock className="size-4" strokeWidth={1.8} />
            <span className="text-xs font-semibold">{slot.label}</span>
            <span className="text-[10px]">
              {slot.start_time.slice(0,5)} ~ {slot.end_time.slice(0,5)}
            </span>
            {/* availability 표시 */}
          </button>
        ))}
      </div>
    </div>
  );
}
```

### 6. 예약 페이지 가용성 체크 동적화
```tsx
// app/member/reservation/page.tsx — 기존 for (const slot of [1, 2, 3]) 교체
useEffect(() => {
  if (!selectedDate || activeTimeSlots.length === 0) return;
  async function loadAvailability() {
    const activeCount = facilities.filter(f => f.is_active).length;
    const availability: Record<number, number> = {};
    for (const slot of activeTimeSlots) {
      const { count } = await supabase
        .from('bbq_reservations')
        .select('*', { count: 'exact', head: true })
        .eq('reservation_date', selectedDate)
        .eq('time_slot', slot.slot_number)
        .eq('status', 'confirmed');
      availability[slot.slot_number] = activeCount - (count || 0);
    }
    setSlotAvailability(availability);
  }
  loadAvailability();
}, [supabase, selectedDate, facilities, activeTimeSlots]);
```

### 7. Export 동적화
```ts
// app/api/export/route.ts — BBQ_TIME_SLOTS 하드코딩 제거
// 기존:
// const BBQ_TIME_SLOTS: Record<number, string> = { 1: '10:00-13:00', ... };

// 변경: export 함수 내에서 DB 조회
const { data: slots } = await supabase.from('bbq_time_slots').select('slot_number, label, start_time, end_time');
const BBQ_TIME_SLOTS: Record<number, string> = {};
(slots || []).forEach((s: any) => {
  BBQ_TIME_SLOTS[s.slot_number] = `${s.label} ${s.start_time.slice(0,5)}-${s.end_time.slice(0,5)}`;
});
```

---

## 주의사항

### 건드리면 안 되는 것
- `bbq_facilities` 테이블 및 CRUD — 완전히 독립, 변경 불필요
- `bbq_products` / `bbq_events` 테이블 및 CRUD — 가격 관리 용도, 타임과 무관
- `get_bbq_reservation_price` 함수 — product_id 기반, 타임슬롯과 무관
- `UNIQUE (reservation_date, time_slot, bbq_number)` 제약 — 유지 (FK 전환해도 호환)

### 사이드 이펙트
- 타임슬롯 삭제 시 해당 slot_number로 예약이 존재하면 FK 제약으로 삭제 차단됨 → soft-delete(is_active=false) 유도
- 새 슬롯 추가 시 `slot_number`가 기존과 겹치면 UNIQUE 위반 → UI에서 자동 번호 부여
- `member-constants.ts`에서 `TIME_SLOTS` 제거 시 import 에러 발생 → 모든 참조 파일 동시 수정 필수

### _contracts 파일
- `_contracts/` 디렉토리가 존재하지 않음 (이 프로젝트에서는 미사용)

---

## 8스킬 검수 결과 반영 (FAIL → 플랜 수정)

### F1: CHECK 제약 동적 DROP (이름 불확실 대응)
```sql
-- 059_bbq_time_slots.sql — CHECK 제약 안전 삭제
DO $$ DECLARE _con TEXT; BEGIN
  SELECT conname INTO _con FROM pg_constraint
  WHERE conrelid = 'public.bbq_reservations'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%time_slot%';
  IF _con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.bbq_reservations DROP CONSTRAINT %I', _con);
  END IF;
END $$;
```

### F2: RPC search_path 통일
```sql
-- SET search_path = '' (기존 004 패턴과 일치)
CREATE FUNCTION public.create_bbq_reservation(...)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
```

### F3: TIME 타입 주석 + slotMap 1회 가공
```ts
export interface BBQTimeSlot {
  start_time: string;  // 'HH:MM:SS' (DB TIME type)
  end_time: string;    // 'HH:MM:SS'
}

// useTimeSlots 내 slotMap (useMemo 적용)
const slotMap = useMemo(() => {
  const map: Record<number, { label: string; time: string }> = {};
  timeSlots.forEach(s => {
    map[s.slot_number] = {
      label: s.label,
      time: `${s.start_time.slice(0, 5)} ~ ${s.end_time.slice(0, 5)}`,
    };
  });
  return map;
}, [timeSlots]);
```

### F4: FK ON UPDATE CASCADE 명시
```sql
ALTER TABLE public.bbq_reservations
  ADD CONSTRAINT bbq_reservations_time_slot_fk
  FOREIGN KEY (time_slot) REFERENCES public.bbq_time_slots(slot_number)
  ON DELETE RESTRICT ON UPDATE CASCADE;
```

### F5: 가용성 체크 1쿼리 최적화
```ts
// 기존: N개 순차 쿼리
// 변경: 1개 쿼리 + JS 집계
const { data: booked } = await supabase
  .from('bbq_reservations')
  .select('time_slot')
  .eq('reservation_date', selectedDate)
  .eq('status', 'confirmed');
const counts: Record<number, number> = {};
(booked || []).forEach(r => { counts[r.time_slot] = (counts[r.time_slot] || 0) + 1; });
const availability: Record<number, number> = {};
activeTimeSlots.forEach(s => {
  availability[s.slot_number] = activeCount - (counts[s.slot_number] || 0);
});
```

### F6: 빈 상태 처리
```tsx
// TimeSlotSelector — 빈 슬롯 상태
if (timeSlots.length === 0) {
  return <p className="text-sm text-text-tertiary py-4 text-center">현재 예약 가능한 시간이 없습니다.</p>;
}
// 관리자 — 마지막 활성 슬롯 비활성화 차단
const activeSlotCount = timeSlots.filter(s => s.is_active).length;
if (slot.is_active && activeSlotCount <= 1) {
  toast.error('최소 1개의 활성 타임 슬롯이 필요합니다.');
  return;
}
```

---

## WARN 항목 반영

### W1+W10: DB CHECK 제약 추가
```sql
CREATE TABLE IF NOT EXISTS public.bbq_time_slots (
  ...
  slot_number INTEGER UNIQUE NOT NULL CHECK (slot_number > 0),
  ...
  CHECK (start_time < end_time)
);
```

### W3: RLS WITH CHECK 명시
```sql
CREATE POLICY bbq_time_slots_admin_write ON public.bbq_time_slots FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
```

### W4: 마이그레이션 멱등성
```sql
-- FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bbq_reservations_time_slot_fk') THEN
    ALTER TABLE public.bbq_reservations ADD CONSTRAINT bbq_reservations_time_slot_fk
      FOREIGN KEY (time_slot) REFERENCES public.bbq_time_slots(slot_number)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Policy/Trigger
DROP POLICY IF EXISTS bbq_time_slots_read ON public.bbq_time_slots;
DROP POLICY IF EXISTS bbq_time_slots_admin_write ON public.bbq_time_slots;
DROP TRIGGER IF EXISTS bbq_time_slots_updated_at ON public.bbq_time_slots;
```

### W5: 롤백 파일 추가
```
변경 파일 목록에 추가:
- [x] supabase/migrations/059_rollback.sql — FK 제거 + CHECK 복원 + 테이블 삭제
```

### W6: 배포 순서
```
Step 7 수정:
1. DB 마이그레이션 적용 (059_bbq_time_slots.sql)
2. 프론트엔드 배포 (TIME_SLOTS 폴백 유지하다가 DB 안정 확인 후 제거)
```

### W7: useTimeSlots useMemo 적용 (F3에 포함됨)

### W8: 모바일 반응형 그리드
```tsx
// TimeSlotSelector 그리드
<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
  {timeSlots.map(...)}
</div>
// 3개 이하면 grid-cols-{count}, 4+ 이면 2열 래핑
```

### W9: INVALID_TIME_SLOT 에러 처리
```ts
// reservation/page.tsx handleReserve 에 추가
if (error.message.includes('INVALID_TIME_SLOT')) {
  toast.error('선택한 타임이 비활성화되었습니다. 다른 시간을 선택해주세요.');
  refetchTimeSlots();
  setSelectedSlot(null);
  return;
}
```

### W11: 감사 로그 toggle 액션 추가
```ts
await auditLog({
  action: slot.is_active ? 'deactivate_bbq_time_slot' : 'activate_bbq_time_slot',
  resource_type: 'bbq_time_slot',
  resource_id: slot.id,
  metadata: { slot_number: slot.slot_number, label: slot.label, is_active: !slot.is_active },
});
```

### W12: 로딩 중 폴백 텍스트
```ts
// useTimeSlots 훅 — 로딩 중 폴백
function getSlotLabel(slotNumber: number): string {
  return slotMap[slotNumber]?.label ?? `${slotNumber}타임`;
}
function getSlotTime(slotNumber: number): string {
  return slotMap[slotNumber]?.time ?? '';
}
```

### W13: member/page.tsx join 방식
```ts
// 예약 조회 시 타임슬롯 join (추가 훅 호출 방지)
const { data: nextRes } = await supabase
  .from('bbq_reservations')
  .select('*, bbq_time_slots!bbq_reservations_time_slot_fk(label, start_time, end_time)')
  .eq('member_id', m.id).eq('status', 'confirmed')
  .gte('reservation_date', today)
  .order('reservation_date').limit(1).maybeSingle();
```

---

## 7점 보안/품질 체크 결과

| # | 항목 | 결과 | 비고 |
|---|------|------|------|
| 1 | 인증/권한 | ✅ 통과 | RLS admin-only 쓰기 + RPC 내 is_active 검증 |
| 2 | 비정상 경로 | ⚠️ 주의 | INVALID_TIME_SLOT 에러 처리 추가 필요 (W9) |
| 3 | 중복 요청/동시성 | ✅ 통과 | UNIQUE 제약 + EXCEPTION 블록 유지 |
| 4 | DB 정합성 | ⚠️ 주의 | CHECK 제약 DROP 시 이름 확인 필수 (F1), 트랜잭션 보장 확인 |
| 5 | 비밀정보 노출 | ✅ 통과 | 신규 API 키/토큰 없음 |
| 6 | 런타임 이슈 | ⚠️ 주의 | TIME 타입 HH:MM:SS 형식 주의 (F3), 빈 슬롯 처리 (F6) |
| 7 | 배포 후 대응 | ⚠️ 주의 | 롤백 파일 필요 (W5), 배포 순서 주의 (W6) |

---

## kk 피드백
<!-- kk가 직접 이 섹션에 메모 추가 -->

