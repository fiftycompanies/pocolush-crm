-- 027_reactivate_member.sql (v3 — 한 줄 함수 압축)

DROP FUNCTION IF EXISTS public.reactivate_member(UUID, TEXT);

CREATE FUNCTION public.reactivate_member(p_member_id UUID, p_reason TEXT DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn_027$ DECLARE v_uid UUID := auth.uid(); v_rental_id UUID; BEGIN IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND role = 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF; UPDATE public.members SET status = 'approved', updated_at = now() WHERE id = p_member_id AND status = 'suspended'; IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_NOT_SUSPENDED'; END IF; INSERT INTO public.member_status_logs(member_id, from_status, to_status, reason, changed_by) VALUES (p_member_id, 'suspended', 'approved', p_reason, v_uid); FOR v_rental_id IN SELECT fr.id FROM public.farm_rentals fr WHERE fr.status = 'active' AND (fr.member_id = p_member_id OR (fr.member_id IS NULL AND fr.customer_id IN (SELECT c.id FROM public.customers c JOIN public.members m ON regexp_replace(m.phone, '[^0-9]', '', 'g') = regexp_replace(c.phone, '[^0-9]', '', 'g') WHERE m.id = p_member_id))) LOOP BEGIN PERFORM public.issue_membership(v_rental_id); EXCEPTION WHEN OTHERS THEN NULL; END; END LOOP; END; $fn_027$;

GRANT EXECUTE ON FUNCTION public.reactivate_member(UUID, TEXT) TO authenticated;
