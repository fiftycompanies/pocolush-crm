-- 085: 농장 보드 전용 RPC (search_bbq_reservations 패턴 답습)
--
-- 배경:
--   /dashboard/farms-board 의 useFarms() 가 4 Promise.all (round trip 4 + 무거움)
--   → 보드 전용 단일 호출 RPC 로 분리하여 round trip 1 + admin 인가 + PIPA audit 1h dedup
--
-- 영향:
--   - /dashboard/farms (기존 관리 페이지) 0 (useFarms 그대로)
--   - /dashboard/farms-board 만 useFarmsBoard() 신규 훅 사용
--   - audit_logs 에 'farms_board_view' action 추가 (1h dedup, 079 패턴)
--
-- 변경:
--   - get_farms_board() RPC 신설 (admin only + assert_admin_with_audit)
--   - LEFT JOIN: farms + farm_zones + farm_rentals(status='active') + customers
--   - ORDER BY z.sort_order NULLS LAST, f.number

CREATE OR REPLACE FUNCTION public.get_farms_board()
RETURNS TABLE (
  farm_id             UUID,
  farm_number         INT,
  farm_name           TEXT,
  area_pyeong         NUMERIC,
  zone_id             UUID,
  zone_name           TEXT,
  zone_sort_order     INT,
  zone_is_operational BOOLEAN,
  rental_id           UUID,
  customer_id         UUID,
  customer_name       TEXT,
  customer_phone      TEXT,
  rental_plan         TEXT,
  rental_start_date   DATE,
  rental_end_date     DATE,
  monthly_fee         INT,
  payment_status      TEXT,
  rental_status       TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $fn_085_farms_board$
DECLARE
  v_caller       UUID := (SELECT auth.uid());
  v_recent_audit BOOLEAN;
BEGIN
  -- admin only (assert_admin_with_audit 078 헬퍼 — admin 외 호출 시 audit + raise)
  PERFORM public.assert_admin_with_audit('farms_board_read', 'farms_board', '{}'::jsonb);

  -- PIPA 1h dedup (079 bbq_board_audit_dedup 패턴)
  SELECT EXISTS (
    SELECT 1 FROM public.audit_logs al
    WHERE al.actor_id = v_caller
      AND al.action = 'farms_board_view'
      AND al.created_at > NOW() - INTERVAL '1 hour'
  ) INTO v_recent_audit;

  IF NOT v_recent_audit THEN
    INSERT INTO public.audit_logs (actor_id, action, resource_type, created_at)
    VALUES (v_caller, 'farms_board_view', 'farms_board', NOW());
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.number,
    f.name,
    f.area_pyeong,
    f.zone_id,
    z.name,
    z.sort_order,
    z.is_operational,
    r.id,
    r.customer_id,
    c.name,
    c.phone,
    r.plan::TEXT,
    r.start_date,
    r.end_date,
    r.monthly_fee,
    r.payment_status,
    r.status
  FROM public.farms f
  LEFT JOIN public.farm_zones z ON z.id = f.zone_id
  LEFT JOIN public.farm_rentals r ON r.farm_id = f.id AND r.status = 'active'
  LEFT JOIN public.customers c ON c.id = r.customer_id
  WHERE f.deleted_at IS NULL
  ORDER BY z.sort_order NULLS LAST, f.number;
END
$fn_085_farms_board$;

GRANT EXECUTE ON FUNCTION public.get_farms_board() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_farms_board() FROM anon, PUBLIC;

COMMENT ON FUNCTION public.get_farms_board() IS
  '085: 농장 보드 전용 RPC. admin only + PIPA 1h dedup. /dashboard/farms-board 의 4 round trip → 1.';
