-- 079: Q2 — bbq_board_read audit 1시간 dedup
-- 검수 발견: get_bbq_board 가 호출마다 audit INSERT → 5년 후 2GB 예상
-- 옵션 2 채택: 1시간/세션 단위 dedup (99% 감축 + 감사 추적 유지)
-- 함수 본문은 075 와 동일, INSERT 부분만 조건부 변경

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
AS $fn_079$
DECLARE
  v_to            DATE := COALESCE(p_date_to, p_date_from);
  v_caller        UUID := (SELECT auth.uid());
  v_is_admin      BOOLEAN;
  v_recent_audit  BOOLEAN;
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

  -- Q2: 1시간 dedup (폴링/Realtime fan-out 으로 인한 audit 폭증 차단)
  SELECT EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE actor_id = v_caller
      AND action = 'bbq_board_read'
      AND created_at > NOW() - INTERVAL '1 hour'
  ) INTO v_recent_audit;

  IF NOT v_recent_audit THEN
    INSERT INTO public.audit_logs (actor_id, action, resource_type, metadata, created_at)
    VALUES (v_caller, 'bbq_board_read', 'bbq_board',
            jsonb_build_object('from', p_date_from, 'to', v_to), NOW());
  END IF;

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(p_date_from, v_to, INTERVAL '1 day')::DATE AS d
  ),
  facilities_to_show AS (
    SELECT f.id, f.number, f.name, f.is_active FROM public.bbq_facilities f
    WHERE f.is_active = TRUE OR EXISTS (
      SELECT 1 FROM public.bbq_reservations r
      WHERE r.bbq_number = f.number
        AND r.reservation_date BETWEEN p_date_from AND v_to
        AND r.status IN ('confirmed', 'completed'))
  ),
  slots_to_show AS (
    SELECT s.slot_number, s.label, s.start_time, s.is_active FROM public.bbq_time_slots s
    WHERE s.is_active = TRUE OR EXISTS (
      SELECT 1 FROM public.bbq_reservations r
      WHERE r.time_slot = s.slot_number
        AND r.reservation_date BETWEEN p_date_from AND v_to
        AND r.status IN ('confirmed', 'completed'))
  ),
  facility_slot_grid AS (
    SELECT ds.d AS reservation_date, s.slot_number, s.label AS slot_label, s.start_time AS slot_start,
           f.number AS bbq_number, f.name AS bbq_name, f.is_active AS facility_active
    FROM date_series ds CROSS JOIN slots_to_show s CROSS JOIN facilities_to_show f
  )
  SELECT g.reservation_date, g.slot_number, g.slot_label, g.slot_start,
         g.bbq_number, g.bbq_name, g.facility_active,
         r.status, m.name, m.phone, r.party_size, r.snapshotted_price, p.name,
         (r.product_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM public.bbq_events e
           WHERE e.product_id = r.product_id
             AND e.start_date <= g.reservation_date
             AND e.end_date >= g.reservation_date)),
         r.id
  FROM facility_slot_grid g
  LEFT JOIN public.bbq_reservations r
    ON r.reservation_date = g.reservation_date AND r.time_slot = g.slot_number
   AND r.bbq_number = g.bbq_number AND r.status IN ('confirmed', 'completed')
  LEFT JOIN public.members m ON m.id = r.member_id
  LEFT JOIN public.bbq_products p ON p.id = r.product_id
  ORDER BY g.reservation_date, g.bbq_number, g.slot_number;
END
$fn_079$;

REVOKE EXECUTE ON FUNCTION public.get_bbq_board(DATE, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_bbq_board(DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bbq_board(DATE, DATE) TO authenticated;
