-- ═══════════════════════════════════════════════════════════════════
-- 055: public-guides 버킷 RLS (Dashboard 수동 생성 전제)
-- ═══════════════════════════════════════════════════════════════════
-- 배경: 자람터 이용가이드 PDF 공개 접근용 Storage 버킷
-- Phase 0.5 hot-track — thoughts/plans/20260421-2100_phase0.5_hottrack_plan_v1.1.md
--
-- 전제: Supabase Dashboard → Storage → new bucket
--   - 이름: public-guides
--   - Public: TRUE
--   - File size limit: 10485760 (10MB)
--   - Allowed MIME types: application/pdf
--
-- 실행: Supabase SQL Editor (admin 권한)
-- Supabase SQL Editor 제약 준수: SELECT INTO 금지, 라벨드 달러쿼트
-- ═══════════════════════════════════════════════════════════════════

-- 1. 버킷 존재 assertion (Dashboard 수동 생성 확인)
DO $fn_055_assert$
BEGIN
  PERFORM 1 FROM storage.buckets WHERE id = 'public-guides';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'public-guides bucket not found — create via Dashboard first (Storage → New bucket, public=true)'
      USING ERRCODE = 'P0001';
  END IF;
END
$fn_055_assert$;

-- 2. RLS 정책 (기존 제거 후 재생성)
DROP POLICY IF EXISTS "public_guides_read_all" ON storage.objects;
DROP POLICY IF EXISTS "public_guides_write_admin" ON storage.objects;

-- 공개 읽기 (로그인 여부 무관)
CREATE POLICY "public_guides_read_all"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'public-guides');

-- 업로드/수정/삭제는 admin 만 (role='admin')
CREATE POLICY "public_guides_write_admin"
  ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'public-guides'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'public-guides'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

COMMENT ON POLICY "public_guides_read_all" ON storage.objects IS
  'public-guides 버킷은 공개 읽기 (자람터 이용가이드 PDF)';

-- ═══════════════════════════════════════════════════════════════════
-- 검증 쿼리 (수동):
--   SELECT * FROM storage.buckets WHERE id = 'public-guides';
--   SELECT polname FROM pg_policy
--     WHERE polrelid = 'storage.objects'::regclass
--       AND polname LIKE 'public_guides%';
--
-- PDF 업로드 (Dashboard UI 권장):
--   Storage → public-guides → Upload → v2026/자람터_이용가이드.pdf
-- ═══════════════════════════════════════════════════════════════════
