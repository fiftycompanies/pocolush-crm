-- 082: 평상 예약 이력 검색 RPC + trigram 인덱스
--
-- 배경 (thoughts/research/20260516-1330_bbq_board_history_research.md):
-- - 평상 예약 현황 페이지 하단에 이력 검색 섹션 추가 요청
-- - JTBD: "지난 달 김XX 회원 예약 조회" / "5월 노쇼 통계" / "환불 위한 과거 예약 찾기"
-- - 페이지네이션 + 기간 + 검색 + 상태/시설 필터
--
-- 설계:
-- - 신규 RPC search_bbq_reservations() — admin only + PIPA audit 1h dedup (079 패턴)
-- - 인덱스 3개 CONCURRENTLY (락 없음)
-- - pg_trgm 익스텐션 (회원명/연락처 부분 일치)
-- - total_count BIGINT 동봉 (페이지네이션용)
--
-- 영향:
-- - get_bbq_board 영향 0 (별도 RPC)
-- - bbq_reservations / members 인덱스 추가만
-- - audit_logs 'bbq_history_search' action 1h dedup

-- ─────────────────────────────────────────────────────────────────
-- Part 1: 익스텐션 + 인덱스 (CONCURRENTLY — 락 없음)
-- ─────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CONCURRENTLY 제거 — Supabase MCP apply_migration 은 트랜잭션 내 실행 (CONCURRENTLY 불가)
-- 현재 30건 데이터 + 5년 후 1800건 예상 → 락 시간 ms 단위, 영향 0
CREATE INDEX IF NOT EXISTS idx_bbq_reservations_date_status
  ON public.bbq_reservations (reservation_date DESC, status);

-- CONCURRENTLY 제거 — Supabase MCP apply_migration 은 트랜잭션 내 실행 (CONCURRENTLY 불가)
-- 현재 30건 데이터 + 5년 후 1800건 예상 → 락 시간 ms 단위, 영향 0
CREATE INDEX IF NOT EXISTS idx_members_name_trgm
  ON public.members USING gin (name gin_trgm_ops);

-- CONCURRENTLY 제거 — Supabase MCP apply_migration 은 트랜잭션 내 실행 (CONCURRENTLY 불가)
-- 현재 30건 데이터 + 5년 후 1800건 예상 → 락 시간 ms 단위, 영향 0
CREATE INDEX IF NOT EXISTS idx_members_phone_trgm
  ON public.members USING gin (phone gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────
-- Part 2: 신규 RPC search_bbq_reservations()
-- ─────────────────────────────────────────────────────────────────

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
AS $fn_082_search$
DECLARE
  v_caller       UUID    := (SELECT auth.uid());
  v_is_admin     BOOLEAN;
  v_recent_audit BOOLEAN;
  v_page         INT     := GREATEST(p_page, 0);
  v_limit        INT     := LEAST(GREATEST(p_limit, 1), 100);  -- 1~100 clamp
BEGIN
  -- admin 권한 체크 (063 헬퍼 재사용)
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    INSERT INTO public.audit_logs (actor_id, action, resource_type, metadata, created_at)
    VALUES (v_caller, 'bbq_history_unauthorized', 'bbq_reservation',
            jsonb_build_object('from', p_date_from, 'to', p_date_to), NOW());
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  -- PIPA audit (079 패턴 답습 — 1시간 dedup, 검색 100회 → 1회 기록)
  SELECT EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE actor_id = v_caller
      AND action = 'bbq_history_search'
      AND created_at > NOW() - INTERVAL '1 hour'
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

  -- 검색 + 페이지네이션
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
      r.created_at
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
    f.reservation_id, f.reservation_date, f.time_slot, f.slot_label,
    f.bbq_number, f.bbq_name, f.status,
    f.member_id, f.member_name, f.member_phone,
    f.party_size, f.snapshotted_price, f.product_name, f.created_at,
    (SELECT total FROM counted)
  FROM filtered f
  ORDER BY f.reservation_date DESC, f.time_slot, f.bbq_number
  OFFSET (v_page * v_limit)
  LIMIT v_limit;
END
$fn_082_search$;

-- 권한
GRANT EXECUTE ON FUNCTION public.search_bbq_reservations(
  DATE, DATE, TEXT, TEXT[], INT, INT, INT
) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.search_bbq_reservations(
  DATE, DATE, TEXT, TEXT[], INT, INT, INT
) FROM anon, PUBLIC;

COMMENT ON FUNCTION public.search_bbq_reservations IS
  '082: 평상 예약 이력 검색 (admin only + PIPA audit 1h dedup). 페이지네이션 + 기간/상태/시설/검색 필터.';
