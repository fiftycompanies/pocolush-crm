-- 012: 플랜 테이블 + CRUD
-- 관련: #8 플랜 단일화

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  plots INT NOT NULL DEFAULT 1,
  price INT NOT NULL,
  duration_months INT NOT NULL DEFAULT 12,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO plans (name, description, plots, price, duration_months, sort_order)
VALUES ('자람터 1년', '포코러쉬 자람터 연간 이용권', 1, 79000, 12, 1);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_read" ON plans FOR SELECT USING (true);
CREATE POLICY "admin_manage" ON plans FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
);

CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
