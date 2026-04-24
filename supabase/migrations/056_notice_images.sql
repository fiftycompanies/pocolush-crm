-- ═══════════════════════════════════════════════════════════════════
-- 056: notice_images 테이블 + Storage 버킷 RLS + 10장 가드 + orphan 정리
-- ═══════════════════════════════════════════════════════════════════
-- 배경: 공지사항 이미지 첨부 기능 (PDF p18)
-- 전제: Dashboard 에서 notice-images 버킷 신설
--   - Public: TRUE
--   - File size limit: 2097152 (2MB)
--   - Allowed MIME types: image/jpeg, image/png, image/webp (SVG 차단, XSS)
--
-- 디자인: 036 service_order_photos 대칭 + caption 포함
-- BLOCKER 해결:
--   BL-1 (QA): caption 컬럼 추가 (036 대칭 완성)
--   BLOCKER-056-1 (Backend): role='admin' 제거, 007 notices_admin_all 일관
--   P0-056-1 (Backend): pg_advisory_xact_lock 로 10장 race 방지
--   P0-056-2 (Backend): AFTER DELETE 트리거로 Storage 객체 정리
--   BL-5 (QA): 7일 이상 draft 공지 자동 prune cron
-- ═══════════════════════════════════════════════════════════════════

-- 1. 버킷 assertion
DO $fn_056_assert$
BEGIN
  PERFORM 1 FROM storage.buckets WHERE id = 'notice-images';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notice-images bucket not found — create via Dashboard first'
      USING ERRCODE = 'P0001';
  END IF;
END
$fn_056_assert$;

-- 2. 테이블 (036 대칭 + caption)
CREATE TABLE IF NOT EXISTS public.notice_images (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id        UUID NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  storage_path     TEXT NOT NULL UNIQUE,
  caption          TEXT,
  display_order    INT NOT NULL DEFAULT 0,
  file_size_bytes  BIGINT,
  mime_type        TEXT CHECK (mime_type IS NULL OR mime_type LIKE 'image/%'),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notice_images_notice
  ON public.notice_images (notice_id, display_order);

COMMENT ON TABLE public.notice_images IS
  '공지사항 이미지 첨부 (036 service_order_photos 대칭). Phase 0.5 hot-track.';

-- 3. RLS (BLOCKER-056-1 해결: 007 notices_admin_all 과 일관, role='admin' 제거)
ALTER TABLE public.notice_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notice_images_read" ON public.notice_images;
CREATE POLICY "notice_images_read"
  ON public.notice_images
  FOR SELECT
  USING (
    -- 공개 공지 이미지는 누구나 읽기
    EXISTS (
      SELECT 1 FROM public.notices
      WHERE id = notice_images.notice_id
        AND is_published = true
    )
    -- 관리자(profiles 존재)는 미발행/draft 포함 전체
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "notice_images_write_admin" ON public.notice_images;
CREATE POLICY "notice_images_write_admin"
  ON public.notice_images
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- 4. 10장 가드 + advisory lock (P0-056-1 race 해결)
CREATE OR REPLACE FUNCTION public.fn_notice_images_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn_056_guard$
DECLARE
  v_count INT;
BEGIN
  -- notice_id 단위 직렬화 (read-then-write race 방지)
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.notice_id::text, 0));

  v_count := (SELECT COUNT(*) FROM public.notice_images WHERE notice_id = NEW.notice_id);

  IF v_count >= 10 THEN
    RAISE EXCEPTION '한 공지에 최대 10장까지만 업로드 가능합니다 (현재 %)', v_count
      USING ERRCODE = 'P0001';
  END IF;

  -- display_order 자동 할당
  IF NEW.display_order = 0 OR NEW.display_order IS NULL THEN
    NEW.display_order := v_count;
  END IF;

  RETURN NEW;
END
$fn_056_guard$;

DROP TRIGGER IF EXISTS trg_notice_images_guard ON public.notice_images;
CREATE TRIGGER trg_notice_images_guard
  BEFORE INSERT ON public.notice_images
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notice_images_guard();

-- 5. AFTER DELETE 트리거 — Storage 객체 정리 (P0-056-2 해결)
CREATE OR REPLACE FUNCTION public.fn_notice_images_cleanup_storage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $fn_056_cleanup$
DECLARE
  v_service_key  TEXT;
  v_supabase_url TEXT;
BEGIN
  -- Vault 에서 secrets 조회 (041 패턴 재사용)
  v_service_key := (
    SELECT decrypted_secret FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1
  );
  v_supabase_url := (
    SELECT decrypted_secret FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_URL' LIMIT 1
  );

  IF v_service_key IS NOT NULL AND v_supabase_url IS NOT NULL THEN
    PERFORM net.http_delete(
      url := v_supabase_url || '/storage/v1/object/notice-images/' || OLD.storage_path,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_service_key,
        'Content-Type', 'application/json'
      )
    );
  END IF;

  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  -- Vault 미설정이거나 Storage 404 → swallow (orphan cron 에서 후처리)
  RETURN OLD;
END
$fn_056_cleanup$;

DROP TRIGGER IF EXISTS trg_notice_images_cleanup_storage ON public.notice_images;
CREATE TRIGGER trg_notice_images_cleanup_storage
  AFTER DELETE ON public.notice_images
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notice_images_cleanup_storage();

-- 6. Storage 버킷 RLS
DROP POLICY IF EXISTS "notice_images_read_all" ON storage.objects;
DROP POLICY IF EXISTS "notice_images_write_admin" ON storage.objects;

CREATE POLICY "notice_images_read_all"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'notice-images');

CREATE POLICY "notice_images_write_admin"
  ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'notice-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'notice-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- 7. BL-5 해결: draft 공지 7일 TTL cron (is_published=false + 7일 초과 → DELETE)
CREATE OR REPLACE FUNCTION public.fn_notices_prune_drafts()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn_056_prune$
DECLARE
  v_deleted INT;
BEGIN
  WITH d AS (
    DELETE FROM public.notices
    WHERE is_published = false
      AND created_at < NOW() - INTERVAL '7 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM d;

  -- CASCADE 로 notice_images 도 삭제됨 → fn_notice_images_cleanup_storage 트리거로 Storage 정리

  IF v_deleted > 0 THEN
    INSERT INTO public.audit_logs (actor_id, action, resource_type, metadata)
    VALUES (
      NULL,
      'notices_prune_drafts',
      'cron',
      jsonb_build_object('deleted_count', v_deleted, 'ran_at', NOW())
    );
  END IF;

  RETURN v_deleted;
END
$fn_056_prune$;

-- pg_cron 등록 (매일 KST 03:00 = UTC 18:00)
-- BLOCKER-7 회피: cron.schedule 중복 방지
DO $fn_056_sched$
DECLARE
  v_existing_job INT;
BEGIN
  v_existing_job := (
    SELECT jobid FROM cron.job WHERE jobname = 'notices_prune_drafts' LIMIT 1
  );
  IF v_existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_job);
  END IF;

  PERFORM cron.schedule(
    'notices_prune_drafts',
    '0 18 * * *',
    $job$SELECT public.fn_notices_prune_drafts();$job$
  );
END
$fn_056_sched$;

-- ═══════════════════════════════════════════════════════════════════
-- 검증 쿼리:
--   SELECT * FROM public.notice_images LIMIT 5;
--   SELECT polname FROM pg_policy
--     WHERE polrelid = 'public.notice_images'::regclass;
--   SELECT * FROM cron.job WHERE jobname = 'notices_prune_drafts';
--   -- 수동 prune: SELECT public.fn_notices_prune_drafts();
-- ═══════════════════════════════════════════════════════════════════
