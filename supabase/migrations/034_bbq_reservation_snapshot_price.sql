-- 034_bbq_reservation_snapshot_price.sql
-- Hotfix: R2 배포 후 create_bbq_reservation RPC가 snapshotted_price/product_id를
-- 저장하지 않아 신규 예약이 가격 스냅샷 없이 생성되는 문제를 수정.
-- + 기존 NULL 건 백필.

-- (1) RPC 재정의 (5→6 인자, p_product_id 추가)
DROP FUNCTION IF EXISTS public.create_bbq_reservation(UUID, DATE, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.create_bbq_reservation(UUID, DATE, INTEGER, INTEGER, INTEGER, UUID);

CREATE FUNCTION public.create_bbq_reservation(p_member_id UUID, p_date DATE, p_slot INTEGER, p_bbq_number INTEGER, p_party_size INTEGER DEFAULT 1, p_product_id UUID DEFAULT NULL) RETURNS public.bbq_reservations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn_034_br$ DECLARE v_result public.bbq_reservations; v_price INTEGER; v_product_id UUID; BEGIN v_product_id := p_product_id; IF v_product_id IS NULL THEN SELECT id INTO v_product_id FROM public.bbq_products WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1; END IF; IF v_product_id IS NOT NULL THEN SELECT public.get_bbq_reservation_price(v_product_id, p_date) INTO v_price; END IF; INSERT INTO public.bbq_reservations (member_id, reservation_date, time_slot, bbq_number, party_size, product_id, snapshotted_price, price) VALUES (p_member_id, p_date, p_slot, p_bbq_number, p_party_size, v_product_id, v_price, COALESCE(v_price, 30000)) RETURNING * INTO v_result; RETURN v_result; EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'SLOT_ALREADY_BOOKED'; END; $fn_034_br$;

GRANT EXECUTE ON FUNCTION public.create_bbq_reservation(UUID, DATE, INTEGER, INTEGER, INTEGER, UUID) TO authenticated;

-- (2) 기존 snapshotted_price NULL 건 백필
UPDATE public.bbq_reservations
SET snapshotted_price = price,
    product_id = COALESCE(product_id, (SELECT id FROM public.bbq_products ORDER BY created_at LIMIT 1))
WHERE snapshotted_price IS NULL;
