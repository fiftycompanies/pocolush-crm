-- ═══════════════════════════════════════════════════════════════════
-- 070: farm_rentals status CHECK 에 'pending' 추가
-- ═══════════════════════════════════════════════════════════════════
-- 배경: 069 에서 active + farm_id NULL 을 금지.
--       농장 미할당 계약은 'pending' 상태로 생성, 농장 할당 시 'active' 전환.
-- ═══════════════════════════════════════════════════════════════════

-- 기존 status CHECK 교체 (024 에서 active/expired/cancelled 만 허용)
ALTER TABLE public.farm_rentals
  DROP CONSTRAINT IF EXISTS farm_rentals_status_check;

ALTER TABLE public.farm_rentals
  ADD CONSTRAINT farm_rentals_status_check
  CHECK (status IN ('pending', 'active', 'expired', 'cancelled'));

COMMENT ON CONSTRAINT farm_rentals_status_check ON public.farm_rentals IS
  '070: pending(농장 미할당 대기) 추가 — 농장 할당 시 active 전환.';
