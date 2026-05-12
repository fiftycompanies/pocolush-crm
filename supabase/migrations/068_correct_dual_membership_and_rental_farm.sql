-- ═══════════════════════════════════════════════════════════════════
-- 068: 이중 ms 정리 + rental 진짜 자리 복원 (배치도 = 진실)
-- ═══════════════════════════════════════════════════════════════════
-- 067 분석 후 발견:
--   강은주/정성훈/조효선 의 ms 가 배치도와 다른 자리 (A존 8/19/20) 에 잔존.
--   배치도 = A존 37/35/25 만 진짜.
--
-- 처리:
--   1) 잘못된 ms 3건 expire (A존 8/19/20)
--   2) rental 3건 farm_id 를 진짜 ms 자리 (A존 37/35/25) 로 복원
--
-- 주의: Part 1 의 ms expire 가 066 트리거 fn_sync_membership_with_rental 발동 →
--   같은 (member, farm) rental 도 cascade expire. 068 별도 SQL 로 rental status=active 복원.
-- ═══════════════════════════════════════════════════════════════════

-- Part 1: 잘못된 active ms 3건 expire
UPDATE public.memberships
SET status='expired', updated_at=NOW()
WHERE id IN (
  '4f6e1770-3dc2-4394-ae07-bfcc7196accd',  -- 강은주 A존 8
  '4d0eeb0a-7094-47bd-933e-7d69544adf31',  -- 정성훈 A존 19
  '8880d144-37dc-4f9a-8126-7935b67360f3'   -- 조효선 A존 20
);

-- Part 2: rental 3건 진짜 자리 복원
UPDATE public.farm_rentals SET farm_id='a4224007-a282-4534-8316-d4b88bc288cc', updated_at=NOW()
WHERE id='075ea472-f47f-4330-a82b-cc1d75f42e00';

UPDATE public.farm_rentals fr
SET farm_id=(SELECT farm_id FROM public.memberships WHERE id='0bcd67da-b084-49d6-88ea-b8a29cb71a29'),
    updated_at=NOW()
WHERE fr.id='7c1b2c82-295b-4025-8aaf-227ed5f98bb1';

UPDATE public.farm_rentals fr
SET farm_id=(SELECT farm_id FROM public.memberships WHERE id='c7a751b8-f963-40c8-a24b-cbfe5098264a'),
    updated_at=NOW()
WHERE fr.id='eee8bb01-8fdd-4385-99c4-51a2b47cd63a';

-- Part 3: 트리거 cascade 로 expired 된 rental 복원
UPDATE public.farm_rentals
SET status='active', updated_at=NOW()
WHERE id IN (
  '7c1b2c82-295b-4025-8aaf-227ed5f98bb1',  -- 정성훈 → A존 35
  'eee8bb01-8fdd-4385-99c4-51a2b47cd63a'   -- 조효선 → A존 25
);

INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
SELECT NULL, 'fix_membership_to_match_layout', 'membership', id::uuid,
  jsonb_build_object('reason', '068 — 배치도와 다른 ms expire (강은주/정성훈/조효선)')
FROM (VALUES
  ('4f6e1770-3dc2-4394-ae07-bfcc7196accd'),
  ('4d0eeb0a-7094-47bd-933e-7d69544adf31'),
  ('8880d144-37dc-4f9a-8126-7935b67360f3')
) AS x(id);

UPDATE public.farms f SET status=(
  CASE WHEN EXISTS (SELECT 1 FROM public.memberships WHERE farm_id=f.id AND status='active')
            OR EXISTS (SELECT 1 FROM public.farm_rentals WHERE farm_id=f.id AND status='active' AND end_date>=CURRENT_DATE)
       THEN 'rented' ELSE 'available' END
) WHERE f.deleted_at IS NULL;
