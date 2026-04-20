-- ═══════════════════════════════════════════════════════════════════
-- 041: orphan service-photos cleanup (pg_cron + pg_net + Vault, dry-run 모드)
-- ═══════════════════════════════════════════════════════════════════
-- v3.1 §4-5 + infra02 반영 (Vercel 경유 제거, Supabase 내부 실행)
-- 블로커 해소:
--   BL-1: storage.delete_object 부재 → net.http_delete + Vault service key
--   BL-7: cron.schedule() 중복 등록 → DO IF NOT EXISTS guard
-- 의존성: 026 (audit_logs), 036 (service_order_photos), Vault secret
-- Supabase SQL Editor 호환: SELECT INTO 금지, 라벨드 달러쿼트, BEFORE 트리거
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────
-- 1. cleanup_logs 테이블
-- ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cleanup_logs (
  id           BIGSERIAL PRIMARY KEY,
  task_name    TEXT        NOT NULL,
  mode         TEXT        NOT NULL CHECK (mode IN ('dry_run', 'execute')),
  status       TEXT        NOT NULL DEFAULT 'started'
                           CHECK (status IN ('started', 'success', 'failed', 'aborted')),
  candidates_count    INT  DEFAULT 0,
  deleted_count       INT  DEFAULT 0,
  failed_count        INT  DEFAULT 0,
  sample_match_count  INT  DEFAULT 0,
  orphan_ratio        NUMERIC(5,4) DEFAULT 0,
  duration_ms  INT,
  details      JSONB,
  ran_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cleanup_logs_task_ran
  ON public.cleanup_logs (task_name, ran_at DESC);

-- RLS: admin only (role='admin' 체크 — 038c 일관성 유지)
ALTER TABLE public.cleanup_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cleanup_logs_admin" ON public.cleanup_logs;
CREATE POLICY "cleanup_logs_admin"
  ON public.cleanup_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );

-- ───────────────────────────────────────
-- 2. cleanup_service_photos_cron() 함수
-- ───────────────────────────────────────
--   - dry_run 모드: 삭제 안 함, candidates 집계만
--   - execute 모드: app.cleanup_dry_run = 'false' 설정 시 실제 삭제
--   - BL-1: net.http_delete + Vault service key
--   - sanity check: orphan_ratio > 0.5 → aborted
--   - sample_match >= 5 게이트 (execute 모드 진입 조건)
-- ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cleanup_service_photos_cron()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp, extensions
AS $fn_041_cleanup$
DECLARE
  v_log_id           BIGINT;
  v_start            TIMESTAMPTZ := clock_timestamp();
  v_dry_run          BOOLEAN;
  v_service_key      TEXT;
  v_supabase_url     TEXT;
  v_storage_total    INT;
  v_db_total         INT;
  v_candidate_count  INT := 0;
  v_sample_match     INT := 0;
  v_orphan_ratio     NUMERIC;
  v_deleted          INT := 0;
  v_failed           INT := 0;
  v_path             TEXT;
  v_request_id       BIGINT;
  v_max_delete       INT := 500;
BEGIN
  -- 1. dry_run 모드 판정 (기본 TRUE)
  v_dry_run := COALESCE(current_setting('app.cleanup_dry_run', true), 'true') = 'true';

  -- 2. Vault 에서 service key + URL 조회
  v_service_key := (SELECT decrypted_secret FROM vault.decrypted_secrets
                    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1);
  v_supabase_url := (SELECT decrypted_secret FROM vault.decrypted_secrets
                     WHERE name = 'SUPABASE_URL' LIMIT 1);
  IF v_service_key IS NULL OR v_supabase_url IS NULL THEN
    RAISE EXCEPTION 'Vault secret 없음: SUPABASE_SERVICE_ROLE_KEY 또는 SUPABASE_URL'
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. cleanup_logs 시작 기록
  INSERT INTO public.cleanup_logs (task_name, mode, status)
  VALUES ('cleanup-service-photos', CASE WHEN v_dry_run THEN 'dry_run' ELSE 'execute' END, 'started')
  RETURNING id INTO v_log_id;

  -- 4. DB / Storage 총량
  v_db_total := (SELECT COUNT(*) FROM public.service_order_photos);
  v_storage_total := (SELECT COUNT(*) FROM storage.objects
                      WHERE bucket_id = 'service-photos'
                        AND created_at < NOW() - INTERVAL '7 days');

  -- 5. orphan ratio 계산 + sanity check
  v_candidate_count := (
    SELECT COUNT(*) FROM storage.objects
    WHERE bucket_id = 'service-photos'
      AND created_at < NOW() - INTERVAL '7 days'
      AND name NOT IN (SELECT storage_path FROM public.service_order_photos WHERE storage_path IS NOT NULL)
  );
  v_orphan_ratio := v_candidate_count::NUMERIC / GREATEST(v_storage_total, 1);

  IF v_orphan_ratio > 0.5 THEN
    UPDATE public.cleanup_logs SET
      status = 'aborted',
      candidates_count = v_candidate_count,
      orphan_ratio = v_orphan_ratio,
      duration_ms = (EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000)::INT,
      details = jsonb_build_object(
        'reason', 'orphan_ratio_too_high',
        'threshold', 0.5,
        'storage_total', v_storage_total,
        'db_total', v_db_total
      )
    WHERE id = v_log_id;
    RETURN jsonb_build_object('ok', false, 'code', 'aborted', 'orphan_ratio', v_orphan_ratio);
  END IF;

  -- 6. sample_match: 앞 10건 path 포맷 검증
  --    형식: <uuid>/<timestamp>-<random>.<ext>
  SELECT COUNT(*) INTO v_sample_match
  FROM (
    SELECT name FROM storage.objects
    WHERE bucket_id = 'service-photos'
      AND created_at < NOW() - INTERVAL '7 days'
      AND name NOT IN (SELECT storage_path FROM public.service_order_photos WHERE storage_path IS NOT NULL)
    LIMIT 10
  ) AS sample
  WHERE name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/\d+-[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$';

  -- 7. 실삭제 (execute 모드 + sample_match 게이트 통과 시)
  IF NOT v_dry_run AND v_sample_match >= 5 THEN
    FOR v_path IN
      SELECT name FROM storage.objects
      WHERE bucket_id = 'service-photos'
        AND created_at < NOW() - INTERVAL '7 days'
        AND name NOT IN (SELECT storage_path FROM public.service_order_photos WHERE storage_path IS NOT NULL)
      LIMIT v_max_delete
    LOOP
      BEGIN
        v_request_id := net.http_delete(
          url := v_supabase_url || '/storage/v1/object/service-photos/' || v_path,
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || v_service_key,
            'Content-Type',  'application/json'
          )
        );
        -- pg_net 은 fire-and-forget, 성공 추정 (실제 응답은 _http_response 에서 polling 가능)
        v_deleted := v_deleted + 1;
      EXCEPTION WHEN OTHERS THEN
        v_failed := v_failed + 1;
      END;
    END LOOP;
  END IF;

  -- 8. 완료 기록
  UPDATE public.cleanup_logs SET
    status = 'success',
    candidates_count = v_candidate_count,
    deleted_count = v_deleted,
    failed_count = v_failed,
    sample_match_count = v_sample_match,
    orphan_ratio = v_orphan_ratio,
    duration_ms = (EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000)::INT,
    details = jsonb_build_object(
      'storage_total', v_storage_total,
      'db_total', v_db_total,
      'max_delete', v_max_delete,
      'sample_gate_passed', (v_sample_match >= 5)
    )
  WHERE id = v_log_id;

  -- 9. audit_logs (actor_id NULL — cron)
  INSERT INTO public.audit_logs (actor_id, action, resource_type, metadata)
  VALUES (
    NULL,
    CASE WHEN v_dry_run THEN 'cleanup_service_photos_dry_run' ELSE 'cleanup_service_photos_execute' END,
    'cron',
    jsonb_build_object(
      'candidates', v_candidate_count,
      'deleted', v_deleted,
      'sample_match', v_sample_match
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'mode', CASE WHEN v_dry_run THEN 'dry_run' ELSE 'execute' END,
    'candidates', v_candidate_count,
    'deleted', v_deleted,
    'sample_match', v_sample_match,
    'orphan_ratio', v_orphan_ratio
  );

EXCEPTION WHEN OTHERS THEN
  UPDATE public.cleanup_logs SET
    status = 'failed',
    duration_ms = (EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000)::INT,
    details = jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE)
  WHERE id = v_log_id;
  RAISE;
END
$fn_041_cleanup$;

COMMENT ON FUNCTION public.cleanup_service_photos_cron() IS
  'Phase 3c 까지 dry_run 모드. app.cleanup_dry_run=false 로 설정 시 실삭제. BL-1/BL-7 적용.';

-- ───────────────────────────────────────
-- 3. pg_cron 등록 (idempotent guard — BL-7)
-- ───────────────────────────────────────
DO $fn_041_sched$
DECLARE
  v_existing_job_id INT;
BEGIN
  -- 이미 등록된 job 존재 시 재사용 (BL-7: 중복 등록 방어)
  SELECT jobid INTO v_existing_job_id
  FROM cron.job
  WHERE jobname = 'cleanup_service_photos'
  LIMIT 1;

  IF v_existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_job_id);
  END IF;

  -- 매월 1일 KST 01:00 (UTC 16:00 전날)
  PERFORM cron.schedule(
    'cleanup_service_photos',
    '0 16 1 * *',
    $job$SELECT public.cleanup_service_photos_cron();$job$
  );

  -- 초기 default dry_run=true (명시)
  PERFORM set_config('app.cleanup_dry_run', 'true', false);
END
$fn_041_sched$;

-- ───────────────────────────────────────
-- 4. 수동 실행용 RPC (E2E SP-13)
-- ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_cleanup_service_photos_dry_run()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn_041_trigger$
BEGIN
  -- admin only
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  PERFORM set_config('app.cleanup_dry_run', 'true', true);
  RETURN public.cleanup_service_photos_cron();
END
$fn_041_trigger$;

COMMENT ON FUNCTION public.trigger_cleanup_service_photos_dry_run() IS
  'E2E SP-13 검증용: admin 이 강제 dry-run 실행.';

-- ═══════════════════════════════════════════════════════════════════
-- 검증 쿼리 (수동):
--   SELECT * FROM cron.job WHERE jobname = 'cleanup_service_photos';
--   SELECT * FROM public.cleanup_service_photos_cron();  -- admin 권한으로
--   SELECT * FROM public.cleanup_logs ORDER BY ran_at DESC LIMIT 5;
--
-- 실행 전 체크리스트:
--   [ ] Vault: SUPABASE_SERVICE_ROLE_KEY 등록 (이미 Phase -1a 에서 완료)
--   [ ] Vault: SUPABASE_URL 등록 (신규 필요!)
--   [ ] Extensions: pg_cron, pg_net 활성 (이미 완료)
--
-- Phase 3c 실삭제 전환:
--   SELECT cron.unschedule('cleanup_service_photos');
--   SELECT cron.schedule(
--     'cleanup_service_photos',
--     '0 16 1 * *',
--     $$SELECT set_config('app.cleanup_dry_run', 'false', false);
--       SELECT public.cleanup_service_photos_cron();$$
--   );
-- ═══════════════════════════════════════════════════════════════════
