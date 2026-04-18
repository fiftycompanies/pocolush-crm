-- 030_farm_rentals_optional_farm.sql
-- R5: farm_id를 선택사항으로 (나중에 농장 할당 가능)
-- auto_issue_membership 트리거를 payment_status + farm_id 양쪽 UPDATE에 반응하도록 확장

-- (1) farm_id NOT NULL 제거 + FK ON DELETE SET NULL
ALTER TABLE public.farm_rentals DROP CONSTRAINT IF EXISTS farm_rentals_farm_id_fkey;
ALTER TABLE public.farm_rentals ALTER COLUMN farm_id DROP NOT NULL;
ALTER TABLE public.farm_rentals ADD CONSTRAINT farm_rentals_farm_id_fkey FOREIGN KEY (farm_id) REFERENCES public.farms(id) ON DELETE SET NULL;

-- (2) auto_issue_membership 트리거 재정의
DROP TRIGGER IF EXISTS auto_issue_membership_trigger ON public.farm_rentals;
DROP FUNCTION IF EXISTS public.auto_issue_membership() CASCADE;

CREATE FUNCTION public.auto_issue_membership() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $fn_030_aim$ DECLARE v_member_id UUID; v_code TEXT; v_plots INT; v_attempts INT := 0; v_new_id UUID; BEGIN IF NEW.payment_status = '납부완료' AND NEW.farm_id IS NOT NULL AND ((OLD.payment_status IS NULL OR OLD.payment_status <> '납부완료') OR (OLD.farm_id IS NULL AND NEW.farm_id IS NOT NULL)) THEN IF NEW.member_id IS NOT NULL THEN v_member_id := NEW.member_id; ELSE SELECT m.id INTO v_member_id FROM public.members m JOIN public.customers c ON public.normalize_phone(m.phone) = public.normalize_phone(c.phone) WHERE c.id = NEW.customer_id LIMIT 1; END IF; IF v_member_id IS NOT NULL THEN IF NOT EXISTS (SELECT 1 FROM public.memberships WHERE member_id = v_member_id AND farm_id = NEW.farm_id AND status = 'active') THEN BEGIN LOOP v_code := 'poco-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0'); v_attempts := v_attempts + 1; EXIT WHEN NOT EXISTS (SELECT 1 FROM public.memberships WHERE membership_code = v_code) OR v_attempts >= 20; END LOOP; SELECT plots INTO v_plots FROM public.plans WHERE name = NEW.plan LIMIT 1; IF v_plots IS NULL THEN v_plots := CASE NEW.plan WHEN '씨앗' THEN 1 WHEN '새싹' THEN 2 WHEN '자람' THEN 3 ELSE 1 END; END IF; INSERT INTO public.memberships (member_id, membership_code, farm_id, plots, start_date, end_date, status, benefits, plan_name) VALUES (v_member_id, v_code, NEW.farm_id, v_plots, COALESCE(NEW.start_date, CURRENT_DATE), COALESCE(NEW.end_date, CURRENT_DATE + INTERVAL '1 year'), 'active', jsonb_build_array('에어바운스 / 키즈놀이터 / 모래놀이터 무료 이용','동물 먹이주기 체험 무료','하계철 수영장 무료 이용','동계철 눈썰매장 할인권 제공','전기 수도 농기구 무상 이용','포코러쉬 풀빌라 할인권 제공'), NEW.plan) RETURNING id INTO v_new_id; INSERT INTO public.membership_logs (membership_id, action, to_status, to_start, to_end) VALUES (v_new_id, 'issued', 'active', NEW.start_date, NEW.end_date); EXCEPTION WHEN OTHERS THEN RAISE WARNING 'auto_issue_membership failed for rental %: %', NEW.id, SQLERRM; END; END IF; END IF; END IF; RETURN NEW; END; $fn_030_aim$;

CREATE TRIGGER auto_issue_membership_trigger AFTER INSERT OR UPDATE OF payment_status, farm_id ON public.farm_rentals FOR EACH ROW EXECUTE FUNCTION public.auto_issue_membership();
