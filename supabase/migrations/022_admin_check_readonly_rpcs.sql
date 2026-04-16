-- Migration 022: enforce admin check on read-only diagnostic RPCs
-- Closes minor info-leak via SECURITY DEFINER bypass of RLS
-- Idempotent: pure CREATE OR REPLACE

CREATE OR REPLACE FUNCTION public.get_unacked_error_count()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN (
    SELECT COUNT(*)::INT
    FROM public.trigger_error_logs
    WHERE acked_at IS NULL
  );
END;
$func$;


CREATE OR REPLACE FUNCTION public.trigger_error_monthly_summary()
RETURNS TABLE(
  month DATE,
  total_count BIGINT,
  unacked_count BIGINT,
  top_function TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      DATE_TRUNC(
        'month',
        created_at AT TIME ZONE 'Asia/Seoul'
      )::DATE AS m,
      function_name,
      acked_at
    FROM public.trigger_error_logs
    WHERE created_at >=
      (DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Seoul')
        - INTERVAL '5 months') AT TIME ZONE 'Asia/Seoul'
  ),
  monthly AS (
    SELECT m, function_name,
           COUNT(*) AS n,
           COUNT(*) FILTER (WHERE acked_at IS NULL) AS n_unacked
    FROM base
    GROUP BY m, function_name
  ),
  ranked AS (
    SELECT m, function_name, n, n_unacked,
           SUM(n) OVER (PARTITION BY m)::BIGINT AS total_n,
           SUM(n_unacked) OVER (PARTITION BY m)::BIGINT AS total_un,
           ROW_NUMBER() OVER (
             PARTITION BY m ORDER BY n DESC
           ) AS rn
    FROM monthly
  )
  SELECT
    r.m AS month,
    r.total_n AS total_count,
    r.total_un AS unacked_count,
    r.function_name AS top_function
  FROM ranked r
  WHERE r.rn = 1
  ORDER BY r.m DESC;
END;
$func$;
