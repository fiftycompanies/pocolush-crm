-- ============================================
-- POCOLUSH CRM v2 — 자람터 농장 관리 스키마
-- Supabase 대시보드 SQL Editor에서 직접 실행하세요.
-- (001_init.sql 이 먼저 실행되어 있어야 합니다)
-- ============================================

-- 농장 테이블
CREATE TABLE IF NOT EXISTS farms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number       INTEGER NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  area_pyeong  NUMERIC(6,1) NOT NULL,
  area_sqm     NUMERIC(8,2) GENERATED ALWAYS AS (area_pyeong * 3.30579) STORED,
  status       TEXT DEFAULT 'available',
  position_x   INTEGER DEFAULT 0,
  position_y   INTEGER DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 10개 농장 데이터
INSERT INTO farms (number, name, area_pyeong, position_x, position_y) VALUES
  (1,  '1번 농장',  3.0, 0, 0),
  (2,  '2번 농장',  2.5, 1, 0),
  (3,  '3번 농장',  3.5, 2, 0),
  (4,  '4번 농장',  2.0, 3, 0),
  (5,  '5번 농장',  4.0, 4, 0),
  (6,  '6번 농장',  3.0, 0, 1),
  (7,  '7번 농장',  2.5, 1, 1),
  (8,  '8번 농장',  3.5, 2, 1),
  (9,  '9번 농장',  2.0, 3, 1),
  (10, '10번 농장', 4.0, 4, 1)
ON CONFLICT (number) DO NOTHING;

-- 임대 계약 테이블
CREATE TABLE IF NOT EXISTS farm_rentals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id         UUID NOT NULL REFERENCES farms(id),
  customer_id     UUID NOT NULL REFERENCES customers(id),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  plan            TEXT,
  monthly_fee     INTEGER NOT NULL,
  payment_method  TEXT NOT NULL,
  payment_status  TEXT DEFAULT '대기',
  status          TEXT DEFAULT 'active',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- updated_at 트리거
DROP TRIGGER IF EXISTS farm_rentals_updated_at ON farm_rentals;
CREATE TRIGGER farm_rentals_updated_at
  BEFORE UPDATE ON farm_rentals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- farms status 자동 동기화 함수
CREATE OR REPLACE FUNCTION sync_farm_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE farms
  SET status = CASE
    WHEN EXISTS (
      SELECT 1 FROM farm_rentals
      WHERE farm_id = COALESCE(NEW.farm_id, OLD.farm_id)
        AND status = 'active'
        AND end_date >= CURRENT_DATE
    ) THEN 'rented'
    ELSE 'available'
  END
  WHERE id = COALESCE(NEW.farm_id, OLD.farm_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_farm_status_on_rental ON farm_rentals;
CREATE TRIGGER sync_farm_status_on_rental
  AFTER INSERT OR UPDATE OR DELETE ON farm_rentals
  FOR EACH ROW EXECUTE FUNCTION sync_farm_status();

-- RLS
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_rentals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all" ON farms;
DROP POLICY IF EXISTS "auth_all" ON farm_rentals;
CREATE POLICY "auth_all" ON farms FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON farm_rentals FOR ALL USING (auth.role() = 'authenticated');
