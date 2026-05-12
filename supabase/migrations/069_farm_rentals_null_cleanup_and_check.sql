-- ═══════════════════════════════════════════════════════════════════
-- 069: farm_rentals 의 자리 없는 active 계약 정리 + CHECK 제약
-- ═══════════════════════════════════════════════════════════════════
-- 사용자 목표: "자리(farm) 없는 계약은 무효 — 계약은 자리에 종속"
-- 062-a 가 memberships 의 NULL farm 만 정리, farm_rentals 도 동일 처리 필요.
-- 발견: 하지민, 이석형2 의 active rental 이 farm_id NULL 잔존.
-- ═══════════════════════════════════════════════════════════════════

-- Part 1: farm_id NULL active 계약 expire (CHECK 적용 전 데이터 정리)
UPDATE public.farm_rentals
SET status='expired', updated_at=NOW()
WHERE status='active' AND farm_id IS NULL;

INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
SELECT NULL, 'cleanup_null_farm_rental', 'farm_rental', fr.id,
  jsonb_build_object('reason', '069 — 자리 없는 active 계약 정리', 'member_id', fr.member_id)
FROM public.farm_rentals fr
WHERE fr.status='expired' AND fr.farm_id IS NULL
  AND fr.updated_at > NOW() - INTERVAL '1 minute';

-- Part 2: CHECK — active 계약은 반드시 farm_id 보유
ALTER TABLE public.farm_rentals
  DROP CONSTRAINT IF EXISTS farm_rentals_active_requires_farm_check;

ALTER TABLE public.farm_rentals
  ADD CONSTRAINT farm_rentals_active_requires_farm_check
  CHECK (status != 'active' OR farm_id IS NOT NULL);

COMMENT ON CONSTRAINT farm_rentals_active_requires_farm_check ON public.farm_rentals IS
  '069: active 계약은 반드시 farm 자리 보유 (062-b memberships 와 동일 원칙).';
