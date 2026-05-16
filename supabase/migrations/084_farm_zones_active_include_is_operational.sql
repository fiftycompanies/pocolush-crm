-- 084: farm_zones_active view 에 is_operational 컬럼 포함
--
-- 배경:
-- - 031 마이그가 farm_zones_active view 생성 (당시 컬럼만 SELECT)
-- - 062b 마이그가 is_operational 컬럼을 farm_zones 에 추가
-- - view 는 SELECT 명시 컬럼이라 신규 컬럼 미반영
-- - /dashboard/farms-board (2026-05-16) 매트릭스에서 z.is_operational 사용 →
--   모든 zone 이 undefined/false 로 잡혀 "운영 중인 zone 이 없습니다" 표시
--
-- 해결:
-- - SELECT * 로 갱신 (deleted_at 필터만 유지)
-- - 모든 신규 컬럼 자동 포함 (is_operational, 향후 추가 컬럼도)
--
-- 영향:
-- - client (lib/use-data.ts useFarms) 가 z.is_operational 정상 수신
-- - 다른 사용처 영향 0 (view 컬럼 추가는 backward compatible)

CREATE OR REPLACE VIEW public.farm_zones_active AS
SELECT * FROM public.farm_zones WHERE deleted_at IS NULL;

COMMENT ON VIEW public.farm_zones_active IS
  '084: deleted_at IS NULL 필터 + 모든 컬럼 (062b is_operational 포함)';
