-- ═══════════════════════════════════════════════════════════════════
-- 060: BBQ 보안 hotfix — RLS role 검증 + 비활성 시설 예약 차단
-- ═══════════════════════════════════════════════════════════════════
-- 배경 (8스킬 검수):
--   P0-1: bbq_reservations RLS 4개 정책이 role='admin' 검증 누락
--     → profiles 행만 있는 사용자가 타인 예약 전체 조회/수정 가능 (보안 결함)
--   P0-3: create_bbq_reservation RPC 가 bbq_facilities.is_active 미검증
--     → 비활성 시설(예: '테스트(예약금지!)')에도 예약 생성됨
--     실제 사례: 예약 986e1012 (2026-05-09, bbq_number=5 비활성 시설)
--
-- 영향 (배포 전):
--   004 RLS 정책: profiles 행 있는 모든 사용자 = 어드민 권한 동등 취급
--   059 RPC: 활성 슬롯은 검증, 활성 시설은 미검증
--
-- 영향 (배포 후):
--   RLS 정책 role='admin' 명시 → 일반 임직원 계정의 예약 조회 차단
--   RPC 시설 활성 검증 → 비활성 시설 예약 시도 시 INACTIVE_FACILITY 에러
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- Part 1: bbq_reservations RLS 재정의 (P0-1)
-- ─────────────────────────────────────────────────────────────────

-- 1-1. member_select: 본인 예약만 + admin 만 전체
DROP POLICY IF EXISTS "bbq_reservations_member_select" ON public.bbq_reservations;
CREATE POLICY "bbq_reservations_member_select" ON public.bbq_reservations
  FOR SELECT USING (
    member_id IN (
      SELECT id FROM public.members
      WHERE user_id = (SELECT auth.uid()) AND status = 'approved'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- 1-2. member_update: 본인 예약만 + admin 만 전체
DROP POLICY IF EXISTS "bbq_reservations_member_update" ON public.bbq_reservations;
CREATE POLICY "bbq_reservations_member_update" ON public.bbq_reservations
  FOR UPDATE USING (
    member_id IN (
      SELECT id FROM public.members
      WHERE user_id = (SELECT auth.uid()) AND status = 'approved'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- 1-3. admin_all: role='admin' 명시 (DELETE 권한 + 모든 작업)
DROP POLICY IF EXISTS "bbq_reservations_admin_all" ON public.bbq_reservations;
CREATE POLICY "bbq_reservations_admin_all" ON public.bbq_reservations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- 1-4. member_insert 는 본인 한정 (변경 없음 — 검증 차원으로 재선언)
DROP POLICY IF EXISTS "bbq_reservations_member_insert" ON public.bbq_reservations;
CREATE POLICY "bbq_reservations_member_insert" ON public.bbq_reservations
  FOR INSERT WITH CHECK (
    member_id IN (
      SELECT id FROM public.members
      WHERE user_id = (SELECT auth.uid()) AND status = 'approved'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

COMMENT ON POLICY "bbq_reservations_admin_all" ON public.bbq_reservations IS
  '060 hotfix: role=admin 명시 — 004 결함 해결 (profiles 행만 있는 사용자 권한 누출)';

-- ─────────────────────────────────────────────────────────────────
-- Part 2: create_bbq_reservation RPC 에 시설 활성 검증 추가 (P0-3)
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_bbq_reservation(
  p_member_id UUID,
  p_date DATE,
  p_slot INTEGER,
  p_bbq_number INTEGER,
  p_party_size INTEGER DEFAULT 1,
  p_product_id UUID DEFAULT NULL
)
RETURNS public.bbq_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn_060_create_bbq$
DECLARE
  v_result public.bbq_reservations;
  v_price INTEGER;
  v_product_id UUID;
  v_slot_exists BOOLEAN;
  v_facility_active BOOLEAN;
BEGIN
  -- 060 추가: 시설 활성 검증 (비활성 시설 예약 차단)
  SELECT is_active INTO v_facility_active
  FROM public.bbq_facilities WHERE number = p_bbq_number;

  IF v_facility_active IS NULL THEN
    RAISE EXCEPTION 'FACILITY_NOT_FOUND';
  END IF;
  IF NOT v_facility_active THEN
    RAISE EXCEPTION 'INACTIVE_FACILITY';
  END IF;

  -- 슬롯 유효성 검증 (활성 슬롯만 허용) — 059 동일
  SELECT EXISTS(
    SELECT 1 FROM public.bbq_time_slots
    WHERE slot_number = p_slot AND is_active = TRUE
  ) INTO v_slot_exists;

  IF NOT v_slot_exists THEN
    RAISE EXCEPTION 'INVALID_TIME_SLOT';
  END IF;

  -- 상품 조회 (059 동일)
  v_product_id := p_product_id;
  IF v_product_id IS NULL THEN
    SELECT id INTO v_product_id FROM public.bbq_products
    WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1;
  END IF;

  -- 가격 조회 (059 동일)
  IF v_product_id IS NOT NULL THEN
    SELECT public.get_bbq_reservation_price(v_product_id, p_date) INTO v_price;
  END IF;

  -- 예약 생성 (059 동일)
  INSERT INTO public.bbq_reservations
    (member_id, reservation_date, time_slot, bbq_number, party_size, product_id, snapshotted_price, price)
  VALUES
    (p_member_id, p_date, p_slot, p_bbq_number, p_party_size, v_product_id, v_price, COALESCE(v_price, 30000))
  RETURNING * INTO v_result;

  RETURN v_result;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'SLOT_ALREADY_BOOKED';
END
$fn_060_create_bbq$;

GRANT EXECUTE ON FUNCTION public.create_bbq_reservation(UUID, DATE, INTEGER, INTEGER, INTEGER, UUID) TO authenticated;

COMMENT ON FUNCTION public.create_bbq_reservation IS
  '060 hotfix: 시설 활성 검증 추가 (FACILITY_NOT_FOUND / INACTIVE_FACILITY)';

-- ═══════════════════════════════════════════════════════════════════
-- 검증 SQL (적용 후):
--   -- RLS 정책 확인
--   SELECT polname, pg_get_expr(polqual, polrelid) AS qual
--   FROM pg_policy
--   WHERE polrelid = 'public.bbq_reservations'::regclass
--   ORDER BY polname;
--   -- 기대: 4개 정책 모두 "role = 'admin'" 포함
--
--   -- RPC 검증 (관리자 세션으로)
--   SELECT public.create_bbq_reservation(
--     '<member_id>'::uuid, '2026-12-31', 1, 5,  -- bbq_number=5 비활성 시설
--     1, NULL
--   );
--   -- 기대: ERROR INACTIVE_FACILITY
--
--   -- 기존 비활성 시설 예약 식별 (수동 정리 필요)
--   SELECT r.id, r.member_id, r.reservation_date, r.bbq_number, f.is_active
--   FROM public.bbq_reservations r
--   JOIN public.bbq_facilities f ON f.number = r.bbq_number
--   WHERE f.is_active = false
--     AND r.status IN ('confirmed', 'pending');
-- ═══════════════════════════════════════════════════════════════════
