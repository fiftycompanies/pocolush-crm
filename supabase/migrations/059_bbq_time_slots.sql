-- 059_bbq_time_slots.sql
-- 하드코딩된 바베큐 타임 슬롯을 DB 테이블로 전환
-- 관리자 CRUD 가능, 기존 예약 데이터 호환

-- ═══════════════════════════════════════
-- (1) bbq_time_slots 테이블
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.bbq_time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_number INTEGER UNIQUE NOT NULL CHECK (slot_number > 0),
  label TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (start_time < end_time)
);

-- ═══════════════════════════════════════
-- (2) 기존 3개 슬롯 시드
-- ═══════════════════════════════════════
INSERT INTO public.bbq_time_slots (slot_number, label, start_time, end_time, sort_order) VALUES
  (1, '1타임', '11:00', '13:50', 1),
  (2, '2타임', '14:00', '16:50', 2),
  (3, '3타임', '17:00', '19:50', 3)
ON CONFLICT (slot_number) DO NOTHING;

-- ═══════════════════════════════════════
-- (3) CHECK 제약 동적 삭제 (자동 생성 이름 대응)
-- ═══════════════════════════════════════
DO $$ DECLARE _con TEXT; BEGIN
  SELECT conname INTO _con FROM pg_constraint
  WHERE conrelid = 'public.bbq_reservations'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%time_slot%';
  IF _con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.bbq_reservations DROP CONSTRAINT %I', _con);
  END IF;
END $$;

-- ═══════════════════════════════════════
-- (4) FK 추가 (멱등)
-- ═══════════════════════════════════════
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bbq_reservations_time_slot_fk') THEN
    ALTER TABLE public.bbq_reservations
      ADD CONSTRAINT bbq_reservations_time_slot_fk
      FOREIGN KEY (time_slot) REFERENCES public.bbq_time_slots(slot_number)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ═══════════════════════════════════════
-- (5) RLS
-- ═══════════════════════════════════════
ALTER TABLE public.bbq_time_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bbq_time_slots_read ON public.bbq_time_slots;
CREATE POLICY bbq_time_slots_read ON public.bbq_time_slots
  FOR SELECT USING (true);

DROP POLICY IF EXISTS bbq_time_slots_admin_write ON public.bbq_time_slots;
CREATE POLICY bbq_time_slots_admin_write ON public.bbq_time_slots
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

-- ═══════════════════════════════════════
-- (6) updated_at 트리거
-- ═══════════════════════════════════════
DROP TRIGGER IF EXISTS bbq_time_slots_updated_at ON public.bbq_time_slots;
CREATE TRIGGER bbq_time_slots_updated_at
  BEFORE UPDATE ON public.bbq_time_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ═══════════════════════════════════════
-- (7) RPC 재정의: 슬롯 유효성을 bbq_time_slots 기준으로
-- ═══════════════════════════════════════
DROP FUNCTION IF EXISTS public.create_bbq_reservation(UUID, DATE, INTEGER, INTEGER, INTEGER, UUID);

CREATE FUNCTION public.create_bbq_reservation(
  p_member_id UUID,
  p_date DATE,
  p_slot INTEGER,
  p_bbq_number INTEGER,
  p_party_size INTEGER DEFAULT 1,
  p_product_id UUID DEFAULT NULL
)
RETURNS public.bbq_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result public.bbq_reservations;
  v_price INTEGER;
  v_product_id UUID;
  v_slot_exists BOOLEAN;
BEGIN
  -- 슬롯 유효성 검증 (활성 슬롯만 허용)
  SELECT EXISTS(
    SELECT 1 FROM public.bbq_time_slots
    WHERE slot_number = p_slot AND is_active = TRUE
  ) INTO v_slot_exists;

  IF NOT v_slot_exists THEN
    RAISE EXCEPTION 'INVALID_TIME_SLOT';
  END IF;

  -- 상품 조회
  v_product_id := p_product_id;
  IF v_product_id IS NULL THEN
    SELECT id INTO v_product_id FROM public.bbq_products
    WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1;
  END IF;

  -- 가격 조회
  IF v_product_id IS NOT NULL THEN
    SELECT public.get_bbq_reservation_price(v_product_id, p_date) INTO v_price;
  END IF;

  -- 예약 생성
  INSERT INTO public.bbq_reservations
    (member_id, reservation_date, time_slot, bbq_number, party_size, product_id, snapshotted_price, price)
  VALUES
    (p_member_id, p_date, p_slot, p_bbq_number, p_party_size, v_product_id, v_price, COALESCE(v_price, 30000))
  RETURNING * INTO v_result;

  RETURN v_result;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'SLOT_ALREADY_BOOKED';
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_bbq_reservation(UUID, DATE, INTEGER, INTEGER, INTEGER, UUID) TO authenticated;
