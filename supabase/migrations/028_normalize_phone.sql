-- 028_normalize_phone.sql
-- phone 정규화 전면 적용: 숫자만 남기는 함수 + 기존 데이터 백필 + 중복 병합(기존 우선)
-- + handle_new_member / auto_issue_membership / issue_membership 재정의
-- Dashboard 파서 우회: 함수 본문 한 줄 압축 + 고유 dollar-tag

-- (1) 공통 정규화 함수
CREATE OR REPLACE FUNCTION public.normalize_phone(p_phone TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $fn_028_norm$ SELECT CASE WHEN p_phone IS NULL THEN NULL ELSE regexp_replace(p_phone, '[^0-9]', '', 'g') END; $fn_028_norm$;

GRANT EXECUTE ON FUNCTION public.normalize_phone(TEXT) TO authenticated, anon;

-- (2) customers 중복 병합 (기존 created_at 오래된 행 유지)
-- 현재 데이터 기준 중복 0건이라 no-op 예상. 안전장치.
DO $fn_028_dedup_c$
DECLARE
  v_row RECORD;
  v_keep UUID;
BEGIN
  FOR v_row IN
    SELECT public.normalize_phone(phone) AS phone_norm, array_agg(id ORDER BY created_at ASC) AS ids
    FROM public.customers
    WHERE phone IS NOT NULL
    GROUP BY public.normalize_phone(phone)
    HAVING COUNT(*) > 1
  LOOP
    v_keep := v_row.ids[1];
    -- farm_rentals.customer_id 재연결
    UPDATE public.farm_rentals SET customer_id = v_keep
      WHERE customer_id = ANY(v_row.ids[2:array_upper(v_row.ids,1)]);
    -- 나머지 customers 삭제
    DELETE FROM public.customers
      WHERE id = ANY(v_row.ids[2:array_upper(v_row.ids,1)]);
    RAISE NOTICE 'customers merged: phone_norm=%, keep=%, removed=%', v_row.phone_norm, v_keep, array_length(v_row.ids,1)-1;
  END LOOP;
END $fn_028_dedup_c$;

-- (3) members 중복 병합 (기존 created_at 오래된 행 유지)
-- members_phone_unique 인덱스 있음. 중복 있으면 삭제 대상 members의 user_id 연결도 같이 처리 필요
-- 현재 중복 0건. 방어 코드만.
DO $fn_028_dedup_m$
DECLARE
  v_row RECORD;
  v_keep UUID;
BEGIN
  FOR v_row IN
    SELECT public.normalize_phone(phone) AS phone_norm, array_agg(id ORDER BY created_at ASC) AS ids
    FROM public.members
    WHERE phone IS NOT NULL
    GROUP BY public.normalize_phone(phone)
    HAVING COUNT(*) > 1
  LOOP
    v_keep := v_row.ids[1];
    RAISE WARNING 'members duplicate detected for phone_norm=%. Manual review required. Keeping %, others: %', v_row.phone_norm, v_keep, v_row.ids[2:array_upper(v_row.ids,1)];
  END LOOP;
END $fn_028_dedup_m$;

-- (4) 기존 데이터 phone 정규화 백필
-- 현재 members 5건(하이픈無 이미 정규화됨), 나머지 19건 업데이트 필요
UPDATE public.members
SET phone = public.normalize_phone(phone)
WHERE phone IS NOT NULL AND phone <> public.normalize_phone(phone);

UPDATE public.customers
SET phone = public.normalize_phone(phone)
WHERE phone IS NOT NULL AND phone <> public.normalize_phone(phone);

-- (5) auto_issue_membership 재정의 (phone 정규화 매칭)
-- 한 줄 압축 + $fn_028_aim$ 태그
DROP FUNCTION IF EXISTS public.auto_issue_membership() CASCADE;
CREATE FUNCTION public.auto_issue_membership() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $fn_028_aim$ DECLARE v_member_id UUID; v_code TEXT; v_plots INT; v_attempts INT := 0; v_new_id UUID; BEGIN IF NEW.payment_status = '납부완료' AND (OLD.payment_status IS NULL OR OLD.payment_status <> '납부완료') THEN IF NEW.member_id IS NOT NULL THEN v_member_id := NEW.member_id; ELSE SELECT m.id INTO v_member_id FROM public.members m JOIN public.customers c ON public.normalize_phone(m.phone) = public.normalize_phone(c.phone) WHERE c.id = NEW.customer_id LIMIT 1; END IF; IF v_member_id IS NOT NULL THEN IF NOT EXISTS (SELECT 1 FROM public.memberships WHERE member_id = v_member_id AND farm_id = NEW.farm_id AND status = 'active') THEN BEGIN LOOP v_code := 'poco-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0'); v_attempts := v_attempts + 1; EXIT WHEN NOT EXISTS (SELECT 1 FROM public.memberships WHERE membership_code = v_code) OR v_attempts >= 20; END LOOP; SELECT plots INTO v_plots FROM public.plans WHERE name = NEW.plan LIMIT 1; IF v_plots IS NULL THEN v_plots := CASE NEW.plan WHEN '씨앗' THEN 1 WHEN '새싹' THEN 2 WHEN '자람' THEN 3 ELSE 1 END; END IF; INSERT INTO public.memberships (member_id, membership_code, farm_id, plots, start_date, end_date, status, benefits, plan_name) VALUES (v_member_id, v_code, NEW.farm_id, v_plots, COALESCE(NEW.start_date, CURRENT_DATE), COALESCE(NEW.end_date, CURRENT_DATE + INTERVAL '1 year'), 'active', ARRAY['에어바운스 / 키즈놀이터 / 모래놀이터 무료 이용','동물 먹이주기 체험 무료','하계철 수영장 무료 이용','동계철 눈썰매장 할인권 제공','전기 수도 농기구 무상 이용','포코러쉬 풀빌라 할인권 제공']::TEXT[], NEW.plan) RETURNING id INTO v_new_id; INSERT INTO public.membership_logs (membership_id, action, to_status, to_start, to_end) VALUES (v_new_id, 'issued', 'active', NEW.start_date, NEW.end_date); EXCEPTION WHEN OTHERS THEN RAISE WARNING 'auto_issue_membership failed for rental %: %', NEW.id, SQLERRM; END; END IF; END IF; END IF; RETURN NEW; END; $fn_028_aim$;

-- 트리거 재연결 (CASCADE DROP으로 사라졌을 수 있음)
DROP TRIGGER IF EXISTS auto_issue_membership_trigger ON public.farm_rentals;
CREATE TRIGGER auto_issue_membership_trigger AFTER INSERT OR UPDATE OF payment_status ON public.farm_rentals FOR EACH ROW EXECUTE FUNCTION public.auto_issue_membership();

-- (6) issue_membership 재정의 (phone 정규화 매칭)
DROP FUNCTION IF EXISTS public.issue_membership(UUID);
CREATE FUNCTION public.issue_membership(p_rental_id UUID) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $fn_028_issue$ DECLARE v_rental RECORD; v_member_id UUID; v_code TEXT; v_plots INT; v_attempts INT := 0; v_new_id UUID; BEGIN SELECT * INTO v_rental FROM public.farm_rentals WHERE id = p_rental_id; IF NOT FOUND THEN RAISE EXCEPTION 'RENTAL_NOT_FOUND'; END IF; IF v_rental.member_id IS NOT NULL THEN v_member_id := v_rental.member_id; ELSE SELECT m.id INTO v_member_id FROM public.members m JOIN public.customers c ON public.normalize_phone(m.phone) = public.normalize_phone(c.phone) WHERE c.id = v_rental.customer_id LIMIT 1; END IF; IF v_member_id IS NULL THEN RAISE EXCEPTION 'MEMBER_NOT_LINKED'; END IF; IF EXISTS (SELECT 1 FROM public.memberships WHERE member_id = v_member_id AND farm_id = v_rental.farm_id AND status = 'active') THEN RAISE EXCEPTION 'ACTIVE_MEMBERSHIP_EXISTS'; END IF; LOOP v_code := 'poco-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0'); v_attempts := v_attempts + 1; EXIT WHEN NOT EXISTS (SELECT 1 FROM public.memberships WHERE membership_code = v_code) OR v_attempts >= 20; END LOOP; SELECT plots INTO v_plots FROM public.plans WHERE name = v_rental.plan LIMIT 1; IF v_plots IS NULL THEN v_plots := CASE v_rental.plan WHEN '씨앗' THEN 1 WHEN '새싹' THEN 2 WHEN '자람' THEN 3 ELSE 1 END; END IF; INSERT INTO public.memberships (member_id, membership_code, farm_id, plots, start_date, end_date, status, benefits, plan_name) VALUES (v_member_id, v_code, v_rental.farm_id, v_plots, COALESCE(v_rental.start_date, CURRENT_DATE), COALESCE(v_rental.end_date, CURRENT_DATE + INTERVAL '1 year'), 'active', ARRAY['에어바운스 / 키즈놀이터 / 모래놀이터 무료 이용','동물 먹이주기 체험 무료','하계철 수영장 무료 이용','동계철 눈썰매장 할인권 제공','전기 수도 농기구 무상 이용','포코러쉬 풀빌라 할인권 제공']::TEXT[], v_rental.plan) RETURNING id INTO v_new_id; INSERT INTO public.membership_logs (membership_id, action, to_status, to_start, to_end, reason, changed_by) VALUES (v_new_id, 'manual_issue', 'active', v_rental.start_date, v_rental.end_date, 'manual', auth.uid()); RETURN v_new_id; END; $fn_028_issue$;

GRANT EXECUTE ON FUNCTION public.issue_membership(UUID) TO authenticated;

-- (7) handle_new_member 재정의 (phone 정규화)
-- 원본은 003_members.sql:89-132. 동일 로직 + v_phone 정규화
DROP FUNCTION IF EXISTS public.handle_new_member() CASCADE;
CREATE FUNCTION public.handle_new_member() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $fn_028_hnm$ DECLARE v_name TEXT; v_phone TEXT; v_address TEXT; v_farming_experience BOOLEAN; v_family_size INTEGER; v_car_number TEXT; v_interested_crops TEXT[]; BEGIN IF (NEW.raw_user_meta_data->>'user_type') = 'member' THEN v_name := COALESCE(NEW.raw_user_meta_data->>'name', ''); v_phone := public.normalize_phone(COALESCE(NEW.raw_user_meta_data->>'phone', '')); v_address := NEW.raw_user_meta_data->>'address'; v_farming_experience := COALESCE((NEW.raw_user_meta_data->>'farming_experience')::BOOLEAN, FALSE); v_family_size := NULLIF(NEW.raw_user_meta_data->>'family_size','')::INTEGER; v_car_number := NEW.raw_user_meta_data->>'car_number'; v_interested_crops := CASE WHEN NEW.raw_user_meta_data->'interested_crops' IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'interested_crops')) ELSE ARRAY[]::TEXT[] END; IF v_phone IS NOT NULL AND v_phone <> '' THEN INSERT INTO public.customers (name, phone) VALUES (v_name, v_phone) ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name; END IF; INSERT INTO public.members (user_id, email, name, phone, address, farming_experience, family_size, car_number, interested_crops, agreed_at, status) VALUES (NEW.id, NEW.email, v_name, v_phone, v_address, v_farming_experience, v_family_size, v_car_number, v_interested_crops, NOW(), 'pending'); END IF; RETURN NEW; END; $fn_028_hnm$;

-- 트리거 재연결
DROP TRIGGER IF EXISTS on_auth_user_created_member ON auth.users;
CREATE TRIGGER on_auth_user_created_member AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_member();

-- 롤백 가이드:
-- 017_membership_issue_v2.sql의 원본 auto_issue_membership / issue_membership CREATE OR REPLACE
-- 003_members.sql의 원본 handle_new_member CREATE OR REPLACE
-- DROP FUNCTION public.normalize_phone(TEXT);
