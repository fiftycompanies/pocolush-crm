-- 033_bbq_products_events.sql
-- R2: 바베큐존 상품 + 기간제 이벤트 (0원 이벤트 등)

-- (1) 상품 테이블
CREATE TABLE IF NOT EXISTS public.bbq_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  base_price INTEGER NOT NULL,
  duration_minutes INTEGER DEFAULT 170,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- (2) 이벤트 (기간제 할인)
CREATE TABLE IF NOT EXISTS public.bbq_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.bbq_products(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_price INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bbq_events_product_date ON public.bbq_events(product_id, start_date, end_date);

-- (3) bbq_reservations 확장
ALTER TABLE public.bbq_reservations ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.bbq_products(id);
ALTER TABLE public.bbq_reservations ADD COLUMN IF NOT EXISTS snapshotted_price INTEGER;

-- (4) RLS
ALTER TABLE public.bbq_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bbq_products_read ON public.bbq_products;
CREATE POLICY bbq_products_read ON public.bbq_products FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS bbq_products_admin_write ON public.bbq_products;
CREATE POLICY bbq_products_admin_write ON public.bbq_products FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.bbq_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bbq_events_read ON public.bbq_events;
CREATE POLICY bbq_events_read ON public.bbq_events FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS bbq_events_admin_write ON public.bbq_events;
CREATE POLICY bbq_events_admin_write ON public.bbq_events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- (5) 기본 상품 시드 + 기존 예약 백필
INSERT INTO public.bbq_products (name, base_price, duration_minutes)
SELECT '바베큐장 예약 (기본)', 30000, 170
WHERE NOT EXISTS (SELECT 1 FROM public.bbq_products);

UPDATE public.bbq_reservations
SET product_id = (SELECT id FROM public.bbq_products ORDER BY created_at LIMIT 1),
    snapshotted_price = COALESCE(price, 30000)
WHERE product_id IS NULL;

-- (6) 가격 조회 함수 (예약 시 사용)
DROP FUNCTION IF EXISTS public.get_bbq_reservation_price(UUID, DATE);
CREATE FUNCTION public.get_bbq_reservation_price(p_product_id UUID, p_date DATE) RETURNS INTEGER LANGUAGE plpgsql STABLE AS $fn_033_price$ DECLARE v_price INTEGER; BEGIN SELECT event_price INTO v_price FROM public.bbq_events WHERE product_id = p_product_id AND start_date <= p_date AND end_date >= p_date ORDER BY start_date DESC LIMIT 1; IF v_price IS NOT NULL THEN RETURN v_price; END IF; SELECT base_price INTO v_price FROM public.bbq_products WHERE id = p_product_id; RETURN COALESCE(v_price, 30000); END; $fn_033_price$;

GRANT EXECUTE ON FUNCTION public.get_bbq_reservation_price(UUID, DATE) TO authenticated;
