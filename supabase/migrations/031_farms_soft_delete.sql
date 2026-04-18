-- 031_farms_soft_delete.sql
-- R1: farms / farm_zones에 deleted_at 추가 + 뷰 farms_active / farm_zones_active
-- 임대 이력이 있는 farm도 삭제 가능 (soft-delete)

ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.farm_zones ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE OR REPLACE VIEW public.farms_active AS
SELECT * FROM public.farms WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW public.farm_zones_active AS
SELECT * FROM public.farm_zones WHERE deleted_at IS NULL;

GRANT SELECT ON public.farms_active TO authenticated;
GRANT SELECT ON public.farm_zones_active TO authenticated;
