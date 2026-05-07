-- 059_rollback.sql
-- 059_bbq_time_slots.sql 롤백용

-- (1) RPC 복원 (034 버전)
DROP FUNCTION IF EXISTS public.create_bbq_reservation(UUID, DATE, INTEGER, INTEGER, INTEGER, UUID);

CREATE FUNCTION public.create_bbq_reservation(
  p_member_id UUID, p_date DATE, p_slot INTEGER,
  p_bbq_number INTEGER, p_party_size INTEGER DEFAULT 1,
  p_product_id UUID DEFAULT NULL
) RETURNS public.bbq_reservations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn_034_br$
DECLARE
  v_result public.bbq_reservations;
  v_price INTEGER;
  v_product_id UUID;
BEGIN
  v_product_id := p_product_id;
  IF v_product_id IS NULL THEN
    SELECT id INTO v_product_id FROM public.bbq_products
    WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF v_product_id IS NOT NULL THEN
    SELECT public.get_bbq_reservation_price(v_product_id, p_date) INTO v_price;
  END IF;
  INSERT INTO public.bbq_reservations
    (member_id, reservation_date, time_slot, bbq_number, party_size, product_id, snapshotted_price, price)
  VALUES
    (p_member_id, p_date, p_slot, p_bbq_number, p_party_size, v_product_id, v_price, COALESCE(v_price, 30000))
  RETURNING * INTO v_result;
  RETURN v_result;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'SLOT_ALREADY_BOOKED';
END;
$fn_034_br$;

GRANT EXECUTE ON FUNCTION public.create_bbq_reservation(UUID, DATE, INTEGER, INTEGER, INTEGER, UUID) TO authenticated;

-- (2) FK 제거
ALTER TABLE public.bbq_reservations DROP CONSTRAINT IF EXISTS bbq_reservations_time_slot_fk;

-- (3) CHECK 복원
ALTER TABLE public.bbq_reservations ADD CONSTRAINT bbq_reservations_time_slot_check CHECK (time_slot IN (1, 2, 3));

-- (4) 테이블 정리
DROP TRIGGER IF EXISTS bbq_time_slots_updated_at ON public.bbq_time_slots;
DROP POLICY IF EXISTS bbq_time_slots_admin_write ON public.bbq_time_slots;
DROP POLICY IF EXISTS bbq_time_slots_read ON public.bbq_time_slots;
DROP TABLE IF EXISTS public.bbq_time_slots;
