-- 055 rollback — public-guides RLS 제거
-- 주의: 버킷 자체는 Dashboard 에서 수동 보존 (데이터 손실 방지)

DROP POLICY IF EXISTS "public_guides_read_all" ON storage.objects;
DROP POLICY IF EXISTS "public_guides_write_admin" ON storage.objects;
