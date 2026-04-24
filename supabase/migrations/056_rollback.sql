-- 056 rollback — notice_images + RLS + 트리거 + prune cron 제거
-- 주의: notice-images 버킷 자체는 Dashboard 에서 수동 보존
--       Storage 객체는 필요 시 수동 삭제

-- 1. cron 제거
DO $fn_056_rb_sched$
DECLARE
  v_existing_job INT;
BEGIN
  v_existing_job := (
    SELECT jobid FROM cron.job WHERE jobname = 'notices_prune_drafts' LIMIT 1
  );
  IF v_existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_job);
  END IF;
END
$fn_056_rb_sched$;

-- 2. 트리거 + 함수
DROP TRIGGER IF EXISTS trg_notice_images_guard ON public.notice_images;
DROP TRIGGER IF EXISTS trg_notice_images_cleanup_storage ON public.notice_images;
DROP FUNCTION IF EXISTS public.fn_notice_images_guard();
DROP FUNCTION IF EXISTS public.fn_notice_images_cleanup_storage();
DROP FUNCTION IF EXISTS public.fn_notices_prune_drafts();

-- 3. Storage RLS
DROP POLICY IF EXISTS "notice_images_read_all" ON storage.objects;
DROP POLICY IF EXISTS "notice_images_write_admin" ON storage.objects;

-- 4. 테이블 RLS
DROP POLICY IF EXISTS "notice_images_read" ON public.notice_images;
DROP POLICY IF EXISTS "notice_images_write_admin" ON public.notice_images;

-- 5. 테이블 DROP (데이터 손실 주의 — 필요 시 사전 백업)
DROP TABLE IF EXISTS public.notice_images CASCADE;
