-- ═══════════════════════════════════════════════════════════════════
-- 067: 잔존 5건 클린업 — kk 결정 (계약 없는 ms expire + rental farm 동기화)
-- ═══════════════════════════════════════════════════════════════════
-- kk 결정:
--   1) QA테스트회원 멤버십 2건 (계약 없음) → expired
--   2) 강은주/정성훈/조효선 rental → ms.farm_id 와 일치 (배치도 기준)
--
-- 주의: 이 마이그레이션은 prod 에 적용되었으나 후속 발견으로 068 에서 보정됨.
-- 068 이 함께 적용되어야 최종 정합 달성.
-- ═══════════════════════════════════════════════════════════════════

UPDATE public.memberships
SET status='expired', updated_at=NOW()
WHERE id IN (
  'a4e516f0-b047-42f4-a599-ad83ea1267e2',  -- QA테스트회원 A존 7번
  'c2cb2031-73c9-416d-9f5a-4b6d2a776ac5'   -- QA테스트회원 A존 9번
);

INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
SELECT NULL, 'cleanup_orphan_membership', 'membership', id::uuid,
  jsonb_build_object('reason', '067 — 계약 없는 멤버십 정리 (QA테스트회원)')
FROM (VALUES
  ('a4e516f0-b047-42f4-a599-ad83ea1267e2'),
  ('c2cb2031-73c9-416d-9f5a-4b6d2a776ac5')
) AS x(id);

-- 강은주 rental → A존 7 (실제로는 A존 37 이어야 했음 — 068 에서 보정)
UPDATE public.farm_rentals SET farm_id='195a63ac-b68d-4d68-9b09-674bfb2d9611', updated_at=NOW()
WHERE id='075ea472-f47f-4330-a82b-cc1d75f42e00';

-- 정성훈 rental → ms 4d0eeb0a 의 farm_id (잘못된 ms, 068 에서 보정)
UPDATE public.farm_rentals fr
SET farm_id=(SELECT farm_id FROM public.memberships WHERE id='4d0eeb0a-7094-47bd-933e-7d69544adf31'),
    updated_at=NOW()
WHERE fr.id='7c1b2c82-295b-4025-8aaf-227ed5f98bb1';

-- 조효선 rental → ms 8880d144 의 farm_id (잘못된 ms, 068 에서 보정)
UPDATE public.farm_rentals fr
SET farm_id=(SELECT farm_id FROM public.memberships WHERE id='8880d144-37dc-4f9a-8126-7935b67360f3'),
    updated_at=NOW()
WHERE fr.id='eee8bb01-8fdd-4385-99c4-51a2b47cd63a';

UPDATE public.farms f SET status=(
  CASE WHEN EXISTS (SELECT 1 FROM public.memberships WHERE farm_id=f.id AND status='active')
            OR EXISTS (SELECT 1 FROM public.farm_rentals WHERE farm_id=f.id AND status='active' AND end_date>=CURRENT_DATE)
       THEN 'rented' ELSE 'available' END
) WHERE f.deleted_at IS NULL;
