-- ============================================
-- POCOLUSH CRM Database Schema
-- Supabase 대시보드 SQL Editor에서 직접 실행하세요.
-- ============================================

-- 직원 프로필
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name       TEXT NOT NULL,
  role       TEXT DEFAULT 'staff', -- 'admin' | 'staff'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 고객
CREATE TABLE IF NOT EXISTS customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 문의
CREATE TABLE IF NOT EXISTS inquiries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  type        TEXT NOT NULL,
  status      TEXT DEFAULT 'new',
  assignee_id UUID REFERENCES profiles(id),
  data        JSONB,
  tags        TEXT[],
  source      TEXT DEFAULT 'website',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 메모/히스토리
CREATE TABLE IF NOT EXISTS inquiry_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID REFERENCES inquiries(id) ON DELETE CASCADE,
  author_id  UUID REFERENCES profiles(id),
  content    TEXT NOT NULL,
  note_type  TEXT DEFAULT 'memo', -- 'memo' | 'call' | 'visit' | 'status_change'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 알림
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES profiles(id),
  inquiry_id UUID REFERENCES inquiries(id),
  message    TEXT NOT NULL,
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inquiries_updated_at
  BEFORE UPDATE ON inquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 신규 문의 시 notifications 자동 생성 (모든 staff에게)
CREATE OR REPLACE FUNCTION notify_new_inquiry()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, inquiry_id, message)
  SELECT id, NEW.id,
    '새 문의가 접수되었습니다: ' || NEW.type
  FROM profiles;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_new_inquiry
  AFTER INSERT ON inquiries
  FOR EACH ROW EXECUTE FUNCTION notify_new_inquiry();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON customers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON inquiries FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON inquiry_notes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "own_notifications" ON notifications FOR ALL USING (user_id = auth.uid());
