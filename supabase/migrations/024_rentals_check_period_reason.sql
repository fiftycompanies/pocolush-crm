-- 024_rentals_check_period_reason.sql (v3 — 한 줄 함수 압축)

ALTER TABLE public.farm_rentals DROP CONSTRAINT IF EXISTS farm_rentals_status_check;
ALTER TABLE public.farm_rentals ADD CONSTRAINT farm_rentals_status_check CHECK (status IN ('active', 'expired', 'cancelled'));

DROP FUNCTION IF EXISTS public.update_membership_period(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS public.update_membership_period(UUID, DATE, DATE, TEXT);

CREATE FUNCTION public.update_membership_period(p_membership_id UUID, p_start_date DATE, p_end_date DATE, p_reason TEXT DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn_024$ DECLARE v_from_start DATE; v_from_end DATE; v_uid UUID := auth.uid(); BEGIN SELECT start_date, end_date INTO v_from_start, v_from_end FROM public.memberships WHERE id = p_membership_id FOR UPDATE; IF v_from_start IS NULL THEN RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND'; END IF; IF p_end_date < p_start_date THEN RAISE EXCEPTION 'INVALID_PERIOD'; END IF; UPDATE public.memberships SET start_date = p_start_date, end_date = p_end_date, updated_at = now() WHERE id = p_membership_id; INSERT INTO public.membership_logs(membership_id, action, from_start, to_start, from_end, to_end, reason, changed_by) VALUES (p_membership_id, 'period_updated', v_from_start, p_start_date, v_from_end, p_end_date, p_reason, v_uid); END; $fn_024$;

GRANT EXECUTE ON FUNCTION public.update_membership_period(UUID, DATE, DATE, TEXT) TO authenticated;
