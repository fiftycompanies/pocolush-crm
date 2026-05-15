-- 075: get_bbq_board RPC — 비활성 슬롯에 예약 보유 시 grid 포함
-- 배경: 072 의 facility_slot_grid 가 `WHERE s.is_active=TRUE` 단독 → 비활성 슬롯 잔존 예약 invisible
--       시설은 OR EXISTS 분기 있으나 슬롯은 누락. 미래 슬롯 비활성화 시 운영 사고 위험.

CREATE OR REPLACE FUNCTION public.get_bbq_board(
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
AS $fn_075$
DECLARE
  v_to       DATE := COALESCE(p_date_to, p_date_from);
  v_caller   UUID := (SELECT auth.uid());
  v_is_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_caller AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    INSERT INTO public.audit_logs (actor_id, action, resource_type, metadata, created_at)
    VALUES (v_caller, 'bbq_board_unauthorized', 'bbq_board',
            jsonb_build_object('from', p_date_from, 'to', v_to), NOW());
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, resource_type, metadata, created_at)
  VALUES (v_caller, 'bbq_board_read', 'bbq_board',
          jsonb_build_object('from', p_date_from, 'to', v_to), NOW());

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(p_date_from, v_to, INTERVAL '1 day')::DATE AS d
  ),
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
  slots_to_show AS (
    SELECT s.slot_number, s.label, s.start_time, s.is_active
    FROM public.bbq_time_slots s
    WHERE s.is_active = TRUE
       OR EXISTS (
         SELECT 1 FROM public.bbq_reservations r
         WHERE r.time_slot = s.slot_number
           AND r.reservation_date BETWEEN p_date_from AND v_to
           AND r.status IN ('confirmed', 'completed')
       )
  ),
  facility_slot_grid AS (
    SELECT ds.d AS reservation_date,
           s.slot_number, s.label AS slot_label, s.start_time AS slot_start,
           f.number AS bbq_number, f.name AS bbq_name, f.is_active AS facility_active
    FROM date_series ds
    CROSS JOIN slots_to_show s
    CROSS JOIN facilities_to_show f
  )
  SELECT
    g.reservation_date, g.slot_number, g.slot_label, g.slot_start,
    g.bbq_number, g.bbq_name, g.facility_active,
    r.status, m.name AS member_name, m.phone AS member_phone,
    r.party_size, r.snapshotted_price, p.name AS product_name,
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
$fn_075$;

GRANT EXECUTE ON FUNCTION public.get_bbq_board(DATE, DATE) TO authenticated;
