-- 023_member_status_view.sql (v3 — 한 줄 함수 압축)

CREATE OR REPLACE VIEW public.members_with_status AS
SELECT m.id, m.user_id, m.email, m.name, m.phone, m.address, m.status AS member_status, m.farming_experience, m.interested_crops, m.family_size, m.car_number, m.memo, m.agreed_at, m.approved_at, m.approved_by, m.withdrawal_requested_at, m.withdrawal_reason, m.created_at, m.updated_at, (COALESCE(r.active_rental_count, 0) + COALESCE(pr.phone_rental_count, 0)) AS active_rental_count, COALESCE(ms.active_membership_count, 0) AS active_membership_count, ms.nearest_membership_end
FROM public.members m
LEFT JOIN (SELECT member_id, COUNT(*) AS active_rental_count FROM public.farm_rentals WHERE status='active' AND member_id IS NOT NULL GROUP BY member_id) r ON r.member_id = m.id
LEFT JOIN (SELECT regexp_replace(c.phone, '[^0-9]', '', 'g') AS phone_norm, COUNT(*) AS phone_rental_count FROM public.customers c JOIN public.farm_rentals fr ON fr.customer_id = c.id WHERE fr.status='active' AND fr.member_id IS NULL GROUP BY regexp_replace(c.phone, '[^0-9]', '', 'g')) pr ON pr.phone_norm = regexp_replace(m.phone, '[^0-9]', '', 'g')
LEFT JOIN (SELECT member_id, COUNT(*) FILTER (WHERE status='active' AND end_date >= CURRENT_DATE) AS active_membership_count, MIN(end_date) FILTER (WHERE status='active') AS nearest_membership_end FROM public.memberships GROUP BY member_id) ms ON ms.member_id = m.id;

REVOKE ALL ON public.members_with_status FROM PUBLIC, authenticated, anon;

DROP FUNCTION IF EXISTS public.get_members_list_admin();

CREATE FUNCTION public.get_members_list_admin() RETURNS SETOF public.members_with_status LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn_023$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF; RETURN QUERY SELECT * FROM public.members_with_status; END; $fn_023$;

GRANT EXECUTE ON FUNCTION public.get_members_list_admin() TO authenticated;
