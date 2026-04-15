-- 017: 농장 번호를 존별 유니크로 변경
-- 기존: number UNIQUE (전역) → 변경: (zone_id, number) UNIQUE (존별)

ALTER TABLE farms DROP CONSTRAINT IF EXISTS farms_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS farms_zone_number_unique ON farms (zone_id, number);
