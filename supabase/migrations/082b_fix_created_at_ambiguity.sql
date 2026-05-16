-- 082b hotfix: column reference "created_at" is ambiguous
--
-- 원인: RETURN TABLE 의 created_at 컬럼과 audit_logs.created_at 충돌
-- (1h dedup 체크 SELECT 에서 PostgreSQL이 어느 created_at 인지 판단 불가)
--
-- 해결:
-- 1. audit_logs 별칭 명시 (al.created_at)
-- 2. 내부 CTE 의 r.created_at 을 r_created_at 별칭으로 분리
--
-- 영향: 함수 본문만 재정의. 인덱스/익스텐션/권한 변경 없음. 라이브 영향 0.

CREATE OR REPLACE FUNCTION public.search_bbq_reservations(
  p_date_from       DATE,
  p_date_to         DATE,
  p_query           TEXT    DEFAULT NULL,
  p_status          TEXT[]  DEFAULT NULL,
  p_facility_number INT     DEFAULT NULL,
  p_page            INT     DEFAULT 0,
  p_limit           INT     DEFAULT 20
)
RETURNS TABLE (
  reservation_id    UUID,
  reservation_date  DATE,
  time_slot         INT,
  slot_label        TEXT,
  bbq_number        INT,
  bbq_name          TEXT,
  status            TEXT,
  member_id         UUID,
  member_name       TEXT,
  member_phone      TEXT,
  party_size        INT,
  snapshotted_price INT,
  product_name      TEXT,
  created_at        TIMESTAMPTZ,
  total_count       BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn_082b_search$
DECLARE
  v_caller       UUID    := (SELECT auth.uid());
  v_is_admin     BOOLEAN;
  v_recent_audit BOOLEAN;
  v_page         INT     := GREATEST(p_page, 0);
  v_limit        INT     := LEAST(GREATEST(p_limit, 1), 100);
BEGIN
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    INSERT INTO public.audit_logs (actor_id, action, resource_type, metadata, created_at)
    VALUES (v_caller, 'bbq_history_unauthorized', 'bbq_reservation',
            jsonb_build_object('from', p_date_from, 'to', p_date_to), NOW());
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  -- al.created_at 명시 — RETURN TABLE created_at 과 충돌 방지 (082b fix)
  SELECT EXISTS (
    SELECT 1 FROM public.audit_logs al
    WHERE al.actor_id = v_caller
      AND al.action = 'bbq_history_search'
      AND al.created_at > NOW() - INTERVAL '1 hour'
  ) INTO v_recent_audit;

  IF NOT v_recent_audit THEN
    INSERT INTO public.audit_logs (actor_id, action, resource_type, metadata, created_at)
    VALUES (v_caller, 'bbq_history_search', 'bbq_reservation',
            jsonb_build_object(
              'from', p_date_from,
              'to', p_date_to,
              'query_present', p_query IS NOT NULL AND p_query <> '',
              'status_filter', p_status,
              'facility_filter', p_facility_number
            ),
            NOW());
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      r.id                AS reservation_id,
      r.reservation_date,
      r.time_slot,
      s.label             AS slot_label,
      r.bbq_number,
      f.name              AS bbq_name,
      r.status,
      r.member_id,
      m.name              AS member_name,
      m.phone             AS member_phone,
      r.party_size,
      r.snapshotted_price,
      p.name              AS product_name,
      r.created_at        AS r_created_at  -- 별칭으로 분리 (082b fix)
    FROM public.bbq_reservations r
    LEFT JOIN public.members         m ON m.id = r.member_id
    LEFT JOIN public.bbq_facilities  f ON f.number = r.bbq_number
    LEFT JOIN public.bbq_time_slots  s ON s.slot_number = r.time_slot
    LEFT JOIN public.bbq_products    p ON p.id = r.product_id
    WHERE r.reservation_date BETWEEN p_date_from AND p_date_to
      AND (p_status IS NULL OR r.status = ANY(p_status))
      AND (p_facility_number IS NULL OR r.bbq_number = p_facility_number)
      AND (
        p_query IS NULL OR p_query = ''
        OR m.name  ILIKE '%' || p_query || '%'
        OR m.phone ILIKE '%' || p_query || '%'
      )
  ),
  counted AS (SELECT COUNT(*)::BIGINT AS total FROM filtered)
  SELECT
    fl.reservation_id, fl.reservation_date, fl.time_slot, fl.slot_label,
    fl.bbq_number, fl.bbq_name, fl.status,
    fl.member_id, fl.member_name, fl.member_phone,
    fl.party_size, fl.snapshotted_price, fl.product_name, fl.r_created_at,
    (SELECT total FROM counted)
  FROM filtered fl
  ORDER BY fl.reservation_date DESC, fl.time_slot, fl.bbq_number
  OFFSET (v_page * v_limit)
  LIMIT v_limit;
END
$fn_082b_search$;
