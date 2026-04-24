-- ═══════════════════════════════════════════════════════════════════
-- 055: public-guides 버킷 assertion (RLS 는 Dashboard UI 에서 설정)
-- ═══════════════════════════════════════════════════════════════════
-- 배경: 자람터 이용가이드 PDF 공개 접근용 Storage 버킷
-- Phase 0.5 hot-track — thoughts/plans/20260421-2100_phase0.5_hottrack_plan_v1.1.md
--
-- ⚠️ Supabase 2024~2025 정책: storage.objects 에 대한 POLICY CREATE/DROP 은
--    SQL Editor 에서 금지됨 (ERROR 42501: must be owner of relation objects).
--    대신 Dashboard → Storage → {bucket} → Policies 탭 에서 설정.
--
-- 전제: Supabase Dashboard → Storage → new bucket
--   - 이름: public-guides
--   - Public: TRUE  ← 체크 시 SELECT(read) 정책 자동 생성
--   - File size limit: 10485760 (10MB)
--   - Allowed MIME types: application/pdf
--
-- 실행: Supabase SQL Editor — 이 파일은 버킷 존재 assertion 만 수행
-- ═══════════════════════════════════════════════════════════════════

-- 버킷 존재 확인 (Dashboard 수동 생성 검증)
DO $fn_055_assert$
BEGIN
  PERFORM 1 FROM storage.buckets WHERE id = 'public-guides';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'public-guides bucket not found — create via Dashboard first (Storage → New bucket, public=true, mime=application/pdf, size=10MB)'
      USING ERRCODE = 'P0001';
  END IF;
END
$fn_055_assert$;

-- ═══════════════════════════════════════════════════════════════════
-- Dashboard UI 에서 추가 정책 설정 (admin write)
-- ═══════════════════════════════════════════════════════════════════
-- 경로: Storage → public-guides → Policies → "New Policy" → "For full customization"
--
-- 정책 1: 업로드/수정/삭제는 admin 만
--   Policy name: public_guides_write_admin
--   Allowed operation: INSERT, UPDATE, DELETE (또는 ALL)
--   Target roles: authenticated
--   USING expression:
--     bucket_id = 'public-guides'
--     AND EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE id = (SELECT auth.uid()) AND role = 'admin'
--     )
--   WITH CHECK expression: (USING 과 동일)
--
-- 정책 2 (SELECT/read): public=TRUE 면 자동 생성됨 — 수동 추가 불필요
--
-- 정책 추가 후 검증 (SQL Editor 에서 읽기만):
--   SELECT polname FROM pg_policy
--   WHERE polrelid = 'storage.objects'::regclass
--     AND polname LIKE '%public_guides%';
-- ═══════════════════════════════════════════════════════════════════

-- PDF 업로드 (Dashboard UI):
--   Storage → public-guides → Upload → v2026/자람터_이용가이드.pdf
