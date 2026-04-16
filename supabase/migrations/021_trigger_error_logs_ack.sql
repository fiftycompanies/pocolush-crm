-- Migration 021: trigger_error_logs ack + monthly summary
-- KST timezone for month boundary
-- ON DELETE SET NULL on acked_by to survive admin user removal
-- Idempotent: safe to re-run

-- Step 1: columns
ALTER TABLE public.trigger_error_logs
  ADD COLUMN IF NOT EXISTS acked_at TIMESTAMPTZ;

ALTER TABLE public.trigger_error_logs
  ADD COLUMN IF NOT EXISTS acked_by UUID;

-- Replace FK to ensure ON DELETE SET NULL even on re-runs
ALTER TABLE public.trigger_error_logs
  DROP CONSTRAINT IF EXISTS trigger_error_logs_acked_by_fkey;

ALTER TABLE public.trigger_error_logs
  ADD CONSTRAINT trigger_error_logs_acked_by_fkey
    FOREIGN KEY (acked_by) REFERENCES auth.users(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trigger_error_logs_unacked
  ON public.trigger_error_logs(created_at DESC)
  WHERE acked_at IS NULL;

-- Step 2: ack one
CREATE OR REPLACE FUNCTION public.ack_trigger_error_log(p_id UUID)
RETURNS VOID
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

  UPDATE public.trigger_error_logs
  SET acked_at = NOW(), acked_by = v_uid
  WHERE id = p_id AND acked_at IS NULL;
END;
$func$;

-- Step 3: ack all
CREATE OR REPLACE FUNCTION public.ack_all_trigger_error_logs()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_uid UUID := auth.uid();
  v_count INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.trigger_error_logs
  SET acked_at = NOW(), acked_by = v_uid
  WHERE acked_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$func$;

-- Step 4: unacked count (used by sidebar badge)
CREATE OR REPLACE FUNCTION public.get_unacked_error_count()
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
AS $func$
  SELECT COUNT(*)::INT
  FROM public.trigger_error_logs
  WHERE acked_at IS NULL;
$func$;

-- Step 5: monthly summary (KST, last 6 months including current)
CREATE OR REPLACE FUNCTION public.trigger_error_monthly_summary()
RETURNS TABLE(
  month DATE,
  total_count BIGINT,
  unacked_count BIGINT,
  top_function TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $func$
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
           SUM(n) OVER (PARTITION BY m) AS total_n,
           SUM(n_unacked) OVER (PARTITION BY m) AS total_un,
           ROW_NUMBER() OVER (
             PARTITION BY m ORDER BY n DESC
           ) AS rn
    FROM monthly
  )
  SELECT
    m AS month,
    total_n AS total_count,
    total_un AS unacked_count,
    function_name AS top_function
  FROM ranked
  WHERE rn = 1
  ORDER BY m DESC;
$func$;
