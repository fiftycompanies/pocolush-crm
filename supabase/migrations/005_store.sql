-- 005_store.sql — 스토어 상품 + 서비스 신청

-- ═══════════════════════════════════════
-- 1. store_products 테이블
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.store_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'service'
    CHECK (category IN ('service', 'seed', 'supply', 'etc')),
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER store_products_updated_at
  BEFORE UPDATE ON public.store_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 기본 상품 시드
INSERT INTO public.store_products (name, description, price, category, sort_order) VALUES
  ('물주기', '농장에 물주기 서비스', 5000, 'service', 1),
  ('잡초뽑기', '잡초 제거 서비스', 5000, 'service', 2),
  ('씨앗구매', '씨앗 패키지 구매', 5000, 'seed', 3)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════
-- 2. service_orders 테이블
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.store_products(id),
  farm_id UUID REFERENCES public.farms(id),
  quantity INTEGER DEFAULT 1,
  total_price INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  admin_note TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_orders_member_id ON public.service_orders(member_id);

CREATE TRIGGER service_orders_updated_at
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ═══════════════════════════════════════
-- 3. RLS
-- ═══════════════════════════════════════
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_products_public_read" ON public.store_products
  FOR SELECT USING (true);

CREATE POLICY "store_products_admin_write" ON public.store_products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

CREATE POLICY "service_orders_member_select" ON public.service_orders
  FOR SELECT USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = (SELECT auth.uid()) AND status = 'approved')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

CREATE POLICY "service_orders_member_insert" ON public.service_orders
  FOR INSERT WITH CHECK (
    member_id IN (SELECT id FROM public.members WHERE user_id = (SELECT auth.uid()) AND status = 'approved')
  );

CREATE POLICY "service_orders_admin_all" ON public.service_orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()))
  );
