-- 007_notices.sql — 공지사항 + 회원 알림

-- ═══════════════════════════════════════
-- 1. notices 테이블
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'notice'
    CHECK (category IN ('notice', 'orientation', 'event', 'info')),
  is_published BOOLEAN DEFAULT false,
  is_push_sent BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER notices_updated_at
  BEFORE UPDATE ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ═══════════════════════════════════════
-- 2. member_notifications 테이블
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.member_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('approval', 'reservation', 'reservation_cancel', 'service_request', 'service_complete', 'coupon', 'notice', 'withdrawal')),
  reference_id UUID,
  reference_type TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_notifications_member_id ON public.member_notifications(member_id);

-- ═══════════════════════════════════════
-- 3. RLS
-- ═══════════════════════════════════════
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_notifications ENABLE ROW LEVEL SECURITY;

-- notices: 발행된 것 전체 읽기, 어드민 CRUD
CREATE POLICY "notices_published_read" ON public.notices
  FOR SELECT USING (
    is_published = true
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

CREATE POLICY "notices_admin_all" ON public.notices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- member_notifications: 본인만
CREATE POLICY "member_notifications_self" ON public.member_notifications
  FOR SELECT USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = (SELECT auth.uid()))
  );

CREATE POLICY "member_notifications_self_update" ON public.member_notifications
  FOR UPDATE USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = (SELECT auth.uid()))
  );

CREATE POLICY "member_notifications_admin_all" ON public.member_notifications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()))
  );
