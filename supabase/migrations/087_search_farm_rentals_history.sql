-- 087: 농장 임대 이력 검색 RPC + trigram 인덱스 (search_bbq_reservations 패턴 답습)
--
-- 배경:
--   - /dashboard/farms-board 하단 §이력 검색 섹션 추가
--   - JTBD: "지난 분기 만료된 임대 조회" / "김XX 임차인 과거 계약 찾기" / "5월 활성 임대 통계"
--   - 보드 (현재 active 매트릭스) 와 별개 (모든 status 검색)
--
-- 설계:
--   - 신규 RPC search_farm_rentals_history() — admin only + PIPA audit 1h dedup
--   - 인덱스 3개 (customers name/phone trgm + farm_rentals end_date/status)
--   - 기간 필터: start_date <= dateTo AND end_date >= dateFrom (overlap)
--   - 페이지네이션 + 임차인 검색 + 상태 multi-select + plan 필터 + zone 필터
--
-- 영향:
--   - get_farms_board (085) 영향 0 (별도 RPC)
--   - customers / farm_rentals 인덱스 추가만
--   - audit_logs 'farm_history_search' action 1h dedup

-- ─────────────────────────────────────────────────────────────────
-- Part 1: 인덱스 (pg_trgm 은 082 에서 이미 활성)
-- ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
  ON public.customers USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_phone_trgm
  ON public.customers USING gin (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_farm_rentals_end_date_status
  ON public.farm_rentals (end_date DESC, status);

CREATE INDEX IF NOT EXISTS idx_farm_rentals_start_date
  ON public.farm_rentals (start_date DESC);

-- ─────────────────────────────────────────────────────────────────
-- Part 2: 신규 RPC search_farm_rentals_history()
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.search_farm_rentals_history(
  p_date_from   DATE,
  p_date_to     DATE,
  p_query       TEXT    DEFAULT NULL,
  p_status      TEXT[]  DEFAULT NULL,
  p_plan        TEXT[]  DEFAULT NULL,
  p_zone_id     UUID    DEFAULT NULL,
  p_page        INT     DEFAULT 0,
  p_limit       INT     DEFAULT 20
)
RETURNS TABLE (
  rental_id         UUID,
  farm_id           UUID,
  farm_number       INT,
  farm_name         TEXT,
  zone_id           UUID,
  zone_name         TEXT,
  customer_id       UUID,
  customer_name     TEXT,
  customer_phone    TEXT,
  start_date        DATE,
  end_date          DATE,
  rental_plan       TEXT,
  monthly_fee       INT,
  payment_status    TEXT,
  rental_status     TEXT,
  created_at        TIMESTAMPTZ,
  total_count       BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $fn_087_farm_history$
DECLARE
  v_caller       UUID    := (SELECT auth.uid());
  v_recent_audit BOOLEAN;
  v_page         INT     := GREATEST(p_page, 0);
  v_limit        INT     := LEAST(GREATEST(p_limit, 1), 100);
BEGIN
  -- admin 권한 + 무권한 자동 audit (078 헬퍼)
  PERFORM public.assert_admin_with_audit(
    'farm_history_search',
    'farm_rental',
    jsonb_build_object('from', p_date_from, 'to', p_date_to)
  );

  -- PIPA 1h dedup (079 패턴)
  SELECT EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE actor_id = v_caller
      AND action = 'farm_history_search'
      AND created_at > NOW() - INTERVAL '1 hour'
  ) INTO v_recent_audit;

  IF NOT v_recent_audit THEN
    INSERT INTO public.audit_logs (actor_id, action, resource_type, metadata, created_at)
    VALUES (v_caller, 'farm_history_search', 'farm_rental',
            jsonb_build_object(
              'from', p_date_from,
              'to', p_date_to,
              'query_present', p_query IS NOT NULL AND p_query <> '',
              'status_filter', p_status,
              'plan_filter', p_plan,
              'zone_filter', p_zone_id
            ),
            NOW());
  END IF;

  -- 검색 + 페이지네이션 (start_date ~ end_date overlap)
  RETURN QUERY
  WITH filtered AS (
    SELECT
      r.id              AS rental_id,
      r.farm_id,
      f.number          AS farm_number,
      f.name            AS farm_name,
      f.zone_id,
      z.name            AS zone_name,
      r.customer_id,
      c.name            AS customer_name,
      c.phone           AS customer_phone,
      r.start_date,
      r.end_date,
      r.plan::TEXT      AS rental_plan,
      r.monthly_fee,
      r.payment_status::TEXT,
      r.status::TEXT    AS rental_status,
      r.created_at
    FROM public.farm_rentals r
    LEFT JOIN public.farms       f ON f.id = r.farm_id
    LEFT JOIN public.farm_zones  z ON z.id = f.zone_id
    LEFT JOIN public.customers   c ON c.id = r.customer_id
    WHERE r.start_date <= p_date_to
      AND r.end_date   >= p_date_from
      AND (p_status IS NULL OR r.status = ANY(p_status))
      AND (p_plan   IS NULL OR r.plan::TEXT = ANY(p_plan))
      AND (p_zone_id IS NULL OR f.zone_id = p_zone_id)
      AND (
        p_query IS NULL OR p_query = ''
        OR c.name  ILIKE '%' || p_query || '%'
        OR c.phone ILIKE '%' || p_query || '%'
      )
  ),
  counted AS (SELECT COUNT(*)::BIGINT AS total FROM filtered)
  SELECT
    fl.rental_id, fl.farm_id, fl.farm_number, fl.farm_name,
    fl.zone_id, fl.zone_name,
    fl.customer_id, fl.customer_name, fl.customer_phone,
    fl.start_date, fl.end_date, fl.rental_plan, fl.monthly_fee,
    fl.payment_status, fl.rental_status, fl.created_at,
    (SELECT total FROM counted)
  FROM filtered fl
  ORDER BY fl.end_date DESC, fl.farm_number
  OFFSET (v_page * v_limit)
  LIMIT v_limit;
END
$fn_087_farm_history$;

-- 권한
GRANT EXECUTE ON FUNCTION public.search_farm_rentals_history(
  DATE, DATE, TEXT, TEXT[], TEXT[], UUID, INT, INT
) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.search_farm_rentals_history(
  DATE, DATE, TEXT, TEXT[], TEXT[], UUID, INT, INT
) FROM anon, PUBLIC;

COMMENT ON FUNCTION public.search_farm_rentals_history IS
  '087: 농장 임대 이력 검색 (admin only + PIPA audit 1h dedup). 페이지네이션 + 기간/상태/플랜/존/검색 필터.';
