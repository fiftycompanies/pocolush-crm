-- ═══════════════════════════════════════════════════════════════════
-- 064: 회원 zone 변경 기능 (membership_zone_history + RPC)
-- ═══════════════════════════════════════════════════════════════════
-- 풀스택 권고 §3 반영:
--   - validate_zone_change 에 is_operational=TRUE 명시 검증
--   - 062-b 신규 트리거 (fn_sync_farm_status, fn_prevent_inactive_zone_membership) 호환
--   - farm_rentals 동기화 (계약과 일치 유지)
--   - 가격 정책 C (어드민 수동 입력)
--   - 점유 충돌 시 override 모드 (기존 만료 + 새 등록)
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- Part 1: membership_zone_history (이력 SCD-2)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.membership_zone_history (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id         UUID NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  member_id             UUID NOT NULL REFERENCES public.members(id),
  -- 이전 위치 (비정규화: 후속 farm 삭제에도 보존)
  from_farm_id          UUID,
  from_zone_id          UUID,
  from_farm_number      INT,
  -- 새 위치
  to_farm_id            UUID NOT NULL REFERENCES public.farms(id),
  to_zone_id            UUID NOT NULL REFERENCES public.farm_zones(id),
  to_farm_number        INT NOT NULL,
  -- 사유
  reason_category       TEXT NOT NULL CHECK (reason_category IN (
    'member_request', 'facility_issue', 'operational', 'maintenance', 'other'
  )),
  reason_memo           TEXT,
  -- 가격 정산 (정책 C: 어드민 수동)
  price_diff_krw        INT NOT NULL DEFAULT 0 CHECK (price_diff_krw BETWEEN -99999999 AND 99999999),
  settlement_note       TEXT,
  -- override 여부 (기존 회원 만료 후 진행)
  overrode_existing     BOOLEAN NOT NULL DEFAULT FALSE,
  overridden_membership_id UUID REFERENCES public.memberships(id),
  -- 메타
  effective_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by            UUID NOT NULL REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mzh_membership ON public.membership_zone_history (membership_id);
CREATE INDEX IF NOT EXISTS idx_mzh_member ON public.membership_zone_history (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mzh_changed_by ON public.membership_zone_history (changed_by);

-- RLS
ALTER TABLE public.membership_zone_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mzh_select" ON public.membership_zone_history;
CREATE POLICY "mzh_select" ON public.membership_zone_history
  FOR SELECT USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = (SELECT auth.uid()))
    OR public.is_admin()
  );

-- INSERT 는 RPC 만 (SECURITY DEFINER 우회)
-- 직접 INSERT 차단 정책은 추가하지 않음 (DEFINER 가 정책 우회 가능)

COMMENT ON TABLE public.membership_zone_history IS
  '064: 회원 zone 이전 이력 (SCD-2). 가격차 어드민 수동 + 점유 override 추적.';

-- ─────────────────────────────────────────────────────────────────
-- Part 2: validate_zone_change RPC (Step 1 — 검증)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_zone_change(
  p_membership_id UUID,
  p_new_farm_id   UUID
)
RETURNS TABLE (
  ok                      BOOLEAN,
  error_code              TEXT,
  error_message           TEXT,
  current_zone_name       TEXT,
  current_farm_number     INT,
  new_zone_name           TEXT,
  new_farm_number         INT,
  membership_end_date     DATE,
  conflict_member_id      UUID,
  conflict_member_name    TEXT,
  pending_service_orders  INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn_064_validate$
DECLARE
  v_m       public.memberships;
  v_old_f   public.farms;
  v_old_z   public.farm_zones;
  v_new_f   public.farms;
  v_new_z   public.farm_zones;
  v_conflict public.memberships;
  v_conflict_member public.members;
  v_pending_so INT;
BEGIN
  IF NOT public.is_admin() THEN
    ok := FALSE; error_code := 'NOT_ADMIN'; error_message := '관리자 권한이 필요합니다';
    RETURN NEXT; RETURN;
  END IF;

  SELECT * INTO v_m FROM public.memberships WHERE id = p_membership_id;
  IF v_m.id IS NULL THEN
    ok := FALSE; error_code := 'MEMBERSHIP_NOT_FOUND'; error_message := '멤버십을 찾을 수 없습니다';
    RETURN NEXT; RETURN;
  END IF;
  IF v_m.status != 'active' THEN
    ok := FALSE; error_code := 'MEMBERSHIP_NOT_ACTIVE'; error_message := '활성 멤버십만 이전 가능합니다';
    RETURN NEXT; RETURN;
  END IF;
  IF v_m.farm_id = p_new_farm_id THEN
    ok := FALSE; error_code := 'SAME_FARM'; error_message := '같은 자리로는 이전 불가';
    RETURN NEXT; RETURN;
  END IF;

  SELECT * INTO v_new_f FROM public.farms WHERE id = p_new_farm_id;
  IF v_new_f.id IS NULL THEN
    ok := FALSE; error_code := 'FARM_NOT_FOUND'; error_message := '대상 자리를 찾을 수 없습니다';
    RETURN NEXT; RETURN;
  END IF;

  SELECT * INTO v_new_z FROM public.farm_zones WHERE id = v_new_f.zone_id;
  IF v_new_z.is_operational IS NOT TRUE THEN
    ok := FALSE; error_code := 'ZONE_NOT_OPERATIONAL'; error_message := '미운영 zone 으로 이전 불가';
    RETURN NEXT; RETURN;
  END IF;

  -- 기존 위치
  IF v_m.farm_id IS NOT NULL THEN
    SELECT * INTO v_old_f FROM public.farms WHERE id = v_m.farm_id;
    SELECT * INTO v_old_z FROM public.farm_zones WHERE id = v_old_f.zone_id;
  END IF;

  -- 점유 충돌 (다른 active 멤버십)
  SELECT * INTO v_conflict
  FROM public.memberships
  WHERE farm_id = p_new_farm_id AND status = 'active' AND id != p_membership_id
  LIMIT 1;

  IF v_conflict.id IS NOT NULL THEN
    SELECT * INTO v_conflict_member FROM public.members WHERE id = v_conflict.member_id;
    ok := FALSE;
    error_code := 'FARM_ALREADY_TAKEN';
    error_message := '대상 자리에 이미 ' || v_conflict_member.name || ' 회원이 활성 중. 만료 후 진행하려면 override 모드 사용';
    current_zone_name := COALESCE(v_old_z.name, NULL);
    current_farm_number := COALESCE(v_old_f.number, NULL);
    new_zone_name := v_new_z.name;
    new_farm_number := v_new_f.number;
    membership_end_date := v_m.end_date;
    conflict_member_id := v_conflict_member.id;
    conflict_member_name := v_conflict_member.name;
    pending_service_orders := 0;
    RETURN NEXT; RETURN;
  END IF;

  -- 진행 중 서비스 주문 (경고용)
  SELECT COUNT(*) INTO v_pending_so
  FROM public.service_orders
  WHERE member_id = v_m.member_id AND status IN ('pending','processing');

  ok := TRUE;
  error_code := NULL;
  error_message := NULL;
  current_zone_name := COALESCE(v_old_z.name, NULL);
  current_farm_number := COALESCE(v_old_f.number, NULL);
  new_zone_name := v_new_z.name;
  new_farm_number := v_new_f.number;
  membership_end_date := v_m.end_date;
  conflict_member_id := NULL;
  conflict_member_name := NULL;
  pending_service_orders := v_pending_so;
  RETURN NEXT;
END
$fn_064_validate$;

GRANT EXECUTE ON FUNCTION public.validate_zone_change(UUID, UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────
-- Part 3: change_membership_zone RPC (Step 2 — 확정)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.change_membership_zone(
  p_membership_id     UUID,
  p_new_farm_id       UUID,
  p_reason_category   TEXT,
  p_reason_memo       TEXT DEFAULT NULL,
  p_price_diff_krw    INT DEFAULT 0,
  p_settlement_note   TEXT DEFAULT NULL,
  p_override          BOOLEAN DEFAULT FALSE
)
RETURNS public.membership_zone_history
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn_064_change$
DECLARE
  v_admin_id   UUID;
  v_m          public.memberships;
  v_new_farm   public.farms;
  v_new_zone   public.farm_zones;
  v_old_farm   public.farms;
  v_conflict   public.memberships;
  v_history    public.membership_zone_history;
BEGIN
  v_admin_id := auth.uid();
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN' USING ERRCODE = '42501';
  END IF;

  IF p_reason_category NOT IN ('member_request','facility_issue','operational','maintenance','other') THEN
    RAISE EXCEPTION 'INVALID_REASON';
  END IF;

  -- 멤버십 락
  SELECT * INTO v_m FROM public.memberships WHERE id = p_membership_id FOR UPDATE;
  IF v_m.id IS NULL THEN RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND'; END IF;
  IF v_m.status != 'active' THEN RAISE EXCEPTION 'MEMBERSHIP_NOT_ACTIVE'; END IF;
  IF v_m.farm_id = p_new_farm_id THEN RAISE EXCEPTION 'SAME_FARM'; END IF;

  -- 새 farm + zone 검증
  SELECT * INTO v_new_farm FROM public.farms WHERE id = p_new_farm_id;
  IF v_new_farm.id IS NULL THEN RAISE EXCEPTION 'FARM_NOT_FOUND'; END IF;
  SELECT * INTO v_new_zone FROM public.farm_zones WHERE id = v_new_farm.zone_id;
  IF v_new_zone.is_operational IS NOT TRUE THEN RAISE EXCEPTION 'ZONE_NOT_OPERATIONAL'; END IF;

  -- 기존 farm
  IF v_m.farm_id IS NOT NULL THEN
    SELECT * INTO v_old_farm FROM public.farms WHERE id = v_m.farm_id;
  END IF;

  -- 충돌 검증
  SELECT * INTO v_conflict
  FROM public.memberships
  WHERE farm_id = p_new_farm_id AND status = 'active' AND id != p_membership_id
  FOR UPDATE
  LIMIT 1;

  IF v_conflict.id IS NOT NULL THEN
    IF NOT p_override THEN
      RAISE EXCEPTION 'FARM_ALREADY_TAKEN: % (override=true 로 만료 후 진행 가능)', v_conflict.id;
    END IF;
    -- override 모드: 기존 active 를 expired 처리
    UPDATE public.memberships
    SET status = 'expired', updated_at = NOW()
    WHERE id = v_conflict.id;

    INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
    VALUES (v_admin_id, 'zone_change_override_expired', 'membership', v_conflict.id,
      jsonb_build_object('caused_by_membership_id', p_membership_id, 'farm_id', p_new_farm_id));
  END IF;

  -- 이력 INSERT (memberships UPDATE 전에 OLD 값 캡쳐)
  INSERT INTO public.membership_zone_history (
    membership_id, member_id,
    from_farm_id, from_zone_id, from_farm_number,
    to_farm_id, to_zone_id, to_farm_number,
    reason_category, reason_memo,
    price_diff_krw, settlement_note,
    overrode_existing, overridden_membership_id,
    changed_by
  ) VALUES (
    v_m.id, v_m.member_id,
    v_m.farm_id, COALESCE(v_old_farm.zone_id, NULL), COALESCE(v_old_farm.number, NULL),
    v_new_farm.id, v_new_farm.zone_id, v_new_farm.number,
    p_reason_category, p_reason_memo,
    p_price_diff_krw, p_settlement_note,
    (v_conflict.id IS NOT NULL), v_conflict.id,
    v_admin_id
  ) RETURNING * INTO v_history;

  -- memberships.farm_id UPDATE
  -- (fn_sync_farm_status 트리거가 farms.status 자동 동기화)
  UPDATE public.memberships
  SET farm_id = p_new_farm_id, updated_at = NOW()
  WHERE id = p_membership_id;

  -- farm_rentals 동기화 (062-b 권고)
  UPDATE public.farm_rentals
  SET farm_id = p_new_farm_id, updated_at = NOW()
  WHERE member_id = v_m.member_id AND status = 'active';

  -- audit
  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  VALUES (v_admin_id, 'change_membership_zone', 'membership', p_membership_id,
    jsonb_build_object(
      'history_id', v_history.id,
      'from_farm_number', v_history.from_farm_number,
      'to_farm_number', v_history.to_farm_number,
      'reason_category', p_reason_category,
      'price_diff_krw', p_price_diff_krw,
      'overrode_existing', v_history.overrode_existing
    ));

  RETURN v_history;
END
$fn_064_change$;

GRANT EXECUTE ON FUNCTION public.change_membership_zone(UUID, UUID, TEXT, TEXT, INT, TEXT, BOOLEAN) TO authenticated;

-- ─────────────────────────────────────────────────────────────────
-- Part 4: get_zone_dashboard RPC (보드 데이터, 향후 B 보드 용)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_zone_dashboard()
RETURNS TABLE (
  zone_id      UUID,
  zone_name    TEXT,
  total_farms  INT,
  occupied     INT,
  available    INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn_064_dash$
  SELECT
    z.id, z.name,
    COUNT(f.id)::INT,
    COUNT(m.id) FILTER (WHERE m.status = 'active')::INT,
    (COUNT(f.id) - COUNT(m.id) FILTER (WHERE m.status = 'active'))::INT
  FROM public.farm_zones z
  LEFT JOIN public.farms f ON f.zone_id = z.id AND f.deleted_at IS NULL
  LEFT JOIN public.memberships m ON m.farm_id = f.id
  WHERE z.is_active = TRUE AND z.is_operational = TRUE
  GROUP BY z.id, z.name
  ORDER BY z.name;
$fn_064_dash$;

GRANT EXECUTE ON FUNCTION public.get_zone_dashboard() TO authenticated;

-- ─────────────────────────────────────────────────────────────────
-- Part 5: get_available_farms_for_transfer RPC (모달 A 자리 선택)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_available_farms_for_transfer(
  p_exclude_farm_id UUID DEFAULT NULL
)
RETURNS TABLE (
  farm_id       UUID,
  farm_number   INT,
  zone_id       UUID,
  zone_name     TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn_064_avail$
  SELECT f.id, f.number, z.id, z.name
  FROM public.farms f
  JOIN public.farm_zones z ON z.id = f.zone_id
  WHERE f.deleted_at IS NULL
    AND z.is_operational = TRUE
    AND (p_exclude_farm_id IS NULL OR f.id != p_exclude_farm_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.memberships
      WHERE farm_id = f.id AND status = 'active'
    )
  ORDER BY z.name, f.number;
$fn_064_avail$;

GRANT EXECUTE ON FUNCTION public.get_available_farms_for_transfer(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────
-- Part 6: 검증
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE v_rpc_count INT; v_table_exists BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO v_rpc_count FROM pg_proc
  WHERE proname IN ('validate_zone_change','change_membership_zone','get_zone_dashboard','get_available_farms_for_transfer');
  IF v_rpc_count != 4 THEN RAISE EXCEPTION '064 RPC % 개 (4개 기대)', v_rpc_count; END IF;

  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='membership_zone_history')
  INTO v_table_exists;
  IF NOT v_table_exists THEN RAISE EXCEPTION 'membership_zone_history 테이블 미생성'; END IF;

  RAISE NOTICE '064 검증 통과 — 테이블 + RPC 4개';
END $$;
