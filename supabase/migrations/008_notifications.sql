-- 008_notifications.sql — 알림 발송 이력 + 설정

-- ═══════════════════════════════════════
-- 1. notification_logs 테이블
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.member_notifications(id),
  channel TEXT NOT NULL CHECK (channel IN ('alimtalk', 'push', 'sms')),
  recipient TEXT NOT NULL,
  template_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'disabled')),
  response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════
-- 2. notification_settings 테이블
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 설정 (모두 비활성화)
INSERT INTO public.notification_settings (key, value) VALUES
  ('alimtalk_enabled', 'false'),
  ('push_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════
-- 3. RLS
-- ═══════════════════════════════════════
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_logs_admin" ON public.notification_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

CREATE POLICY "notification_settings_admin" ON public.notification_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()))
  );
