-- 081: Q6 — bbq_facilities RLS: 비활성 시설은 admin 또는 인증 회원에게만
-- 활성 시설은 모두 조회 가능, 비활성 시설은 admin/approved 회원에게만 (anon 차단)

DROP POLICY IF EXISTS bbq_facilities_public_read ON public.bbq_facilities;

CREATE POLICY bbq_facilities_public_read ON public.bbq_facilities
  FOR SELECT
  USING (
    is_active = TRUE
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.members
      WHERE members.user_id = (SELECT auth.uid()) AND members.status = 'approved'
    )
  );
