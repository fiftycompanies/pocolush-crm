-- 006_coupons.sql — 쿠폰 정의 + 쿠폰 발급

-- ═══════════════════════════════════════
-- 1. coupons 테이블
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value INTEGER NOT NULL,
  target_service TEXT,
  valid_from DATE,
  valid_until DATE,
  max_issues INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════
-- 2. coupon_issues 테이블
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.coupon_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  coupon_code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued', 'used', 'expired')),
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES auth.users(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupon_issues_member_id ON public.coupon_issues(member_id);
CREATE INDEX IF NOT EXISTS idx_coupon_issues_coupon_code ON public.coupon_issues(coupon_code);

-- ═══════════════════════════════════════
-- 3. generate_coupon_code RPC
-- ═══════════════════════════════════════
CREATE OR REPLACE FUNCTION public.generate_coupon_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
  v_attempts INTEGER := 0;
BEGIN
  LOOP
    v_code := upper(encode(extensions.gen_random_bytes(4), 'hex'));
    SELECT EXISTS(SELECT 1 FROM public.coupon_issues WHERE coupon_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
    v_attempts := v_attempts + 1;
    IF v_attempts > 100 THEN
      RAISE EXCEPTION 'COUPON_CODE_GENERATION_FAILED';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

-- ═══════════════════════════════════════
-- 4. RLS
-- ═══════════════════════════════════════
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coupons_public_read" ON public.coupons
  FOR SELECT USING (true);

CREATE POLICY "coupons_admin_write" ON public.coupons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

CREATE POLICY "coupon_issues_member_select" ON public.coupon_issues
  FOR SELECT USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

CREATE POLICY "coupon_issues_member_insert" ON public.coupon_issues
  FOR INSERT WITH CHECK (
    member_id IN (SELECT id FROM public.members WHERE user_id = (SELECT auth.uid()) AND status = 'approved')
  );

CREATE POLICY "coupon_issues_admin_all" ON public.coupon_issues
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()))
  );
