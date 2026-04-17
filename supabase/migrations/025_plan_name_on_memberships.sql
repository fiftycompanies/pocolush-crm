-- 025_plan_name_on_memberships.sql (v3 — 한 줄 함수 압축)

ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS plan_name TEXT;

UPDATE public.memberships ms SET plan_name = sub.plan FROM (SELECT DISTINCT ON (member_id, farm_id) member_id, farm_id, plan FROM public.farm_rentals WHERE status='active' AND member_id IS NOT NULL ORDER BY member_id, farm_id, created_at DESC) sub WHERE ms.member_id = sub.member_id AND ms.farm_id = sub.farm_id AND ms.plan_name IS NULL;

DROP TRIGGER IF EXISTS memberships_sync_plan_name ON public.memberships;
DROP FUNCTION IF EXISTS public.sync_membership_plan_name();

CREATE FUNCTION public.sync_membership_plan_name() RETURNS TRIGGER LANGUAGE plpgsql AS $fn_025$ BEGIN IF NEW.plan_name IS NULL AND NEW.member_id IS NOT NULL AND NEW.farm_id IS NOT NULL THEN SELECT plan INTO NEW.plan_name FROM public.farm_rentals WHERE member_id = NEW.member_id AND farm_id = NEW.farm_id AND status = 'active' ORDER BY created_at DESC LIMIT 1; END IF; RETURN NEW; END; $fn_025$;

CREATE TRIGGER memberships_sync_plan_name BEFORE INSERT ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.sync_membership_plan_name();
