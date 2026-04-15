-- 013: 농장존/사이트 구조
-- 관련: #6 농장존/사이트 구분 [Q7 ON DELETE RESTRICT]

CREATE TABLE IF NOT EXISTS farm_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE farm_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_read" ON farm_zones FOR SELECT USING (true);
CREATE POLICY "admin_manage" ON farm_zones FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
);

-- 기본 존 생성
INSERT INTO farm_zones (name, sort_order) VALUES ('A존', 1);

-- farms에 zone_id 추가 [Q7 ON DELETE RESTRICT]
ALTER TABLE farms ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES farm_zones(id) ON DELETE RESTRICT;

-- 기존 농장을 기본 존에 매핑
UPDATE farms SET zone_id = (SELECT id FROM farm_zones WHERE name = 'A존' LIMIT 1)
WHERE zone_id IS NULL;

-- NOT NULL 제약 추가
ALTER TABLE farms ALTER COLUMN zone_id SET NOT NULL;
