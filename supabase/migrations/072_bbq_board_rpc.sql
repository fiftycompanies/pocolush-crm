-- ═══════════════════════════════════════════════════════════════════
-- 072: BBQ 운영 보드 RPC + 성능 인덱스 + audit log
-- ═══════════════════════════════════════════════════════════════════
-- 핵심: 비활성 시설이라도 미래/현재 예약 있으면 grid 행 포함
--       (kk: 라이브 서비스 + 실예약 데이터 보존이 최우선)
-- 패턴: 060/065 hotfix 답습 (SECURITY DEFINER + search_path='' + admin check + audit)
-- ═══════════════════════════════════════════════════════════════════

-- (1) 성능 인덱스 — 미래 누적 대비 (현재 22 active row 라 비용 무시)
CREATE INDEX IF NOT EXISTS idx_bbq_reservations_date_slot_facility
  ON public.bbq_reservations (reservation_date, time_slot, bbq_number)
  WHERE status IN ('confirmed', 'completed');

CREATE INDEX IF NOT EXISTS idx_bbq_reservations_member_status
  ON public.bbq_reservations (member_id, status);

-- (2) BBQ 운영 보드 RPC
DROP FUNCTION IF EXISTS public.get_bbq_board(DATE, DATE);

CREATE FUNCTION public.get_bbq_board(
  p_date_from DATE,
  p_date_to   DATE DEFAULT NULL
)
RETURNS TABLE (
  reservation_date  DATE,
  slot_number       INT,
  slot_label        TEXT,
  slot_start        TIME,
  bbq_number        INT,
  bbq_name          TEXT,
  facility_active   BOOLEAN,
  status            TEXT,
  member_name       TEXT,
  member_phone      TEXT,
  party_size        INT,
  snapshotted_price INT,
  product_name      TEXT,
  is_event          BOOLEAN,
  reservation_id    UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn_072_board$
DECLARE
  v_to       DATE := COALESCE(p_date_to, p_date_from);
  v_caller   UUID := (SELECT auth.uid());
  v_is_admin BOOLEAN;
BEGIN
  -- admin only check
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_caller AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    -- unauthorized 시도 audit log (PIPA 강화 — 권한 우회 추적)
    INSERT INTO public.audit_logs (actor_id, action, resource_type, metadata, created_at)
    VALUES (v_caller, 'bbq_board_unauthorized', 'bbq_board',
            jsonb_build_object('from', p_date_from, 'to', v_to), NOW());
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  -- 성공 시 PIPA audit log (5년 보관)
  INSERT INTO public.audit_logs (actor_id, action, resource_type, metadata, created_at)
  VALUES (v_caller, 'bbq_board_read', 'bbq_board',
          jsonb_build_object('from', p_date_from, 'to', v_to), NOW());

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(p_date_from, v_to, INTERVAL '1 day')::DATE AS d
  ),
  -- ⭐ 활성 시설 OR (조회 범위 내 예약 보유한 비활성 시설) 모두 포함
  --    라이브 서비스의 실예약 데이터 보존이 최우선
  facilities_to_show AS (
    SELECT f.id, f.number, f.name, f.is_active
    FROM public.bbq_facilities f
    WHERE f.is_active = TRUE
       OR EXISTS (
         SELECT 1 FROM public.bbq_reservations r
         WHERE r.bbq_number = f.number
           AND r.reservation_date BETWEEN p_date_from AND v_to
           AND r.status IN ('confirmed', 'completed')
       )
  ),
  facility_slot_grid AS (
    SELECT ds.d AS reservation_date,
           s.slot_number, s.label AS slot_label, s.start_time AS slot_start,
           f.number AS bbq_number, f.name AS bbq_name, f.is_active AS facility_active
    FROM date_series ds
    CROSS JOIN public.bbq_time_slots s
    CROSS JOIN facilities_to_show f
    WHERE s.is_active = TRUE
  )
  SELECT
    g.reservation_date,
    g.slot_number,
    g.slot_label,
    g.slot_start,
    g.bbq_number,
    g.bbq_name,
    g.facility_active,
    r.status,
    m.name AS member_name,
    m.phone AS member_phone,
    r.party_size,
    r.snapshotted_price,
    p.name AS product_name,
    -- 이벤트 판정: bbq_events 와 product_id+date 매칭
    (r.product_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.bbq_events e
      WHERE e.product_id = r.product_id
        AND e.start_date <= g.reservation_date
        AND e.end_date >= g.reservation_date
    )) AS is_event,
    r.id AS reservation_id
  FROM facility_slot_grid g
  LEFT JOIN public.bbq_reservations r
    ON r.reservation_date = g.reservation_date
   AND r.time_slot = g.slot_number
   AND r.bbq_number = g.bbq_number
   AND r.status IN ('confirmed', 'completed')
  LEFT JOIN public.members m ON m.id = r.member_id
  LEFT JOIN public.bbq_products p ON p.id = r.product_id
  ORDER BY g.reservation_date, g.bbq_number, g.slot_number;
END
$fn_072_board$;

COMMENT ON FUNCTION public.get_bbq_board(DATE, DATE) IS
  '072: BBQ 운영 보드 — admin only, 비활성+예약있는 시설 포함, PIPA audit log';

GRANT EXECUTE ON FUNCTION public.get_bbq_board(DATE, DATE) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 검증 SQL (apply 후 실행):
--   SELECT * FROM public.get_bbq_board(CURRENT_DATE, CURRENT_DATE + 7)
--   ORDER BY reservation_date, bbq_number, slot_number;
--
-- 기대:
--   - 활성 시설 4개 + 비활성 시설 #5 (예약 1건 보유) = 5개 시설 row
--   - 8일 × 3타임 × 5시설 = 120 행
--   - status='confirmed' 인 셀: 미래 예약 수만큼
--   - facility_active=false 인 행: bbq_number=5 (예약 보유 한정)
-- ═══════════════════════════════════════════════════════════════════
