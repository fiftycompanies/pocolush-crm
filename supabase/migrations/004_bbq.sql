-- 004_bbq.sql — 바베큐장 시설 + 예약 테이블

-- ═══════════════════════════════════════
-- 1. bbq_facilities 테이블
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.bbq_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  price INTEGER DEFAULT 30000,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6개 기본 시설 시드
INSERT INTO public.bbq_facilities (number, name) VALUES
  (1, '바베큐장 1번'), (2, '바베큐장 2번'), (3, '바베큐장 3번'),
  (4, '바베큐장 4번'), (5, '바베큐장 5번'), (6, '바베큐장 6번')
ON CONFLICT (number) DO NOTHING;

-- ═══════════════════════════════════════
-- 2. bbq_reservations 테이블
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.bbq_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  reservation_date DATE NOT NULL,
  time_slot INTEGER NOT NULL CHECK (time_slot IN (1, 2, 3)),
  bbq_number INTEGER NOT NULL REFERENCES public.bbq_facilities(number),
  party_size INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
  price INTEGER DEFAULT 30000,
  memo TEXT,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (reservation_date, time_slot, bbq_number)
);

CREATE INDEX IF NOT EXISTS idx_bbq_reservations_member_id ON public.bbq_reservations(member_id);
CREATE INDEX IF NOT EXISTS idx_bbq_reservations_date ON public.bbq_reservations(reservation_date);

CREATE TRIGGER bbq_reservations_updated_at
  BEFORE UPDATE ON public.bbq_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ═══════════════════════════════════════
-- 3. create_bbq_reservation RPC (race condition 방지)
-- ═══════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_bbq_reservation(
  p_member_id UUID,
  p_date DATE,
  p_slot INTEGER,
  p_bbq_number INTEGER,
  p_party_size INTEGER DEFAULT 1
)
RETURNS public.bbq_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result public.bbq_reservations;
BEGIN
  INSERT INTO public.bbq_reservations (member_id, reservation_date, time_slot, bbq_number, party_size)
  VALUES (p_member_id, p_date, p_slot, p_bbq_number, p_party_size)
  RETURNING * INTO v_result;
  RETURN v_result;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'SLOT_ALREADY_BOOKED';
END;
$$;

-- ═══════════════════════════════════════
-- 4. RLS
-- ═══════════════════════════════════════
ALTER TABLE public.bbq_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bbq_reservations ENABLE ROW LEVEL SECURITY;

-- bbq_facilities: 전체 읽기, 어드민 쓰기
CREATE POLICY "bbq_facilities_public_read" ON public.bbq_facilities
  FOR SELECT USING (true);

CREATE POLICY "bbq_facilities_admin_write" ON public.bbq_facilities
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- bbq_reservations: 승인 회원 본인 + 어드민
CREATE POLICY "bbq_reservations_member_select" ON public.bbq_reservations
  FOR SELECT USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = (SELECT auth.uid()) AND status = 'approved')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

CREATE POLICY "bbq_reservations_member_insert" ON public.bbq_reservations
  FOR INSERT WITH CHECK (
    member_id IN (SELECT id FROM public.members WHERE user_id = (SELECT auth.uid()) AND status = 'approved')
  );

CREATE POLICY "bbq_reservations_member_update" ON public.bbq_reservations
  FOR UPDATE USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = (SELECT auth.uid()) AND status = 'approved')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

CREATE POLICY "bbq_reservations_admin_all" ON public.bbq_reservations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()))
  );
