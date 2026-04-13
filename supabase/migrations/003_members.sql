-- 003_members.sql — 회원 + 회원권 테이블
-- Phase 1: 자람터 고객용 회원 시스템

-- ═══════════════════════════════════════
-- 1. update_updated_at 함수 (이미 존재하면 skip)
-- ═══════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════
-- 2. members 테이블
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  -- 선택 필드 (주말농장 관련)
  farming_experience BOOLEAN DEFAULT false,
  interested_crops TEXT[] DEFAULT '{}',
  family_size INTEGER,
  car_number TEXT,
  memo TEXT,
  -- 상태 관리
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'suspended', 'withdrawn')),
  agreed_at TIMESTAMPTZ,
  -- 푸시 알림
  push_token TEXT,
  push_platform TEXT CHECK (push_platform IN ('ios', 'android', 'web')),
  push_enabled BOOLEAN DEFAULT false,
  -- 승인/탈퇴
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  withdrawal_requested_at TIMESTAMPTZ,
  withdrawal_reason TEXT,
  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_status ON public.members(status);
CREATE INDEX IF NOT EXISTS idx_members_phone ON public.members(phone);

CREATE TRIGGER members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ═══════════════════════════════════════
-- 3. memberships 테이블 (회원권)
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  membership_code TEXT UNIQUE NOT NULL,
  farm_id UUID REFERENCES public.farms(id),
  plots INTEGER DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'cancelled')),
  benefits JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memberships_member_id ON public.memberships(member_id);

CREATE TRIGGER memberships_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ═══════════════════════════════════════
-- 4. on_auth_user_created 트리거
--    고객 가입 시에만 members에 pending 레코드 생성
-- ═══════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name TEXT;
  v_phone TEXT;
BEGIN
  IF NEW.raw_user_meta_data->>'user_type' = 'member' THEN
    v_name := COALESCE(NEW.raw_user_meta_data->>'name', '');
    v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');

    -- customers 테이블에 upsert (phone 기준, 임대 계약 연동용)
    IF v_phone != '' THEN
      INSERT INTO public.customers (name, phone)
      VALUES (v_name, v_phone)
      ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name;
    END IF;

    INSERT INTO public.members (
      user_id, email, name, phone, address, agreed_at,
      farming_experience, interested_crops, family_size, car_number
    )
    VALUES (
      NEW.id,
      NEW.email,
      v_name,
      v_phone,
      COALESCE(NEW.raw_user_meta_data->>'address', ''),
      CASE WHEN (NEW.raw_user_meta_data->>'agreed')::boolean = true
        THEN NOW() ELSE NULL END,
      COALESCE((NEW.raw_user_meta_data->>'farming_experience')::boolean, false),
      CASE WHEN NEW.raw_user_meta_data->'interested_crops' IS NOT NULL
        THEN ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'interested_crops'))
        ELSE '{}'::TEXT[] END,
      (NEW.raw_user_meta_data->>'family_size')::integer,
      NEW.raw_user_meta_data->>'car_number'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_member
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_member();

-- ═══════════════════════════════════════
-- 5. RLS 정책
-- ═══════════════════════════════════════
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- members: 본인 읽기/수정
CREATE POLICY "members_self_select" ON public.members
  FOR SELECT USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

CREATE POLICY "members_self_update" ON public.members
  FOR UPDATE USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- members: 어드민 전체 관리
CREATE POLICY "members_admin_all" ON public.members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- memberships: 본인 읽기 + 어드민 전체
CREATE POLICY "memberships_self_select" ON public.memberships
  FOR SELECT USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

CREATE POLICY "memberships_admin_all" ON public.memberships
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );
