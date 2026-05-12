-- ═══════════════════════════════════════════════════════════════════
-- 066: farm_rentals ↔ memberships 양방향 동기화
-- ═══════════════════════════════════════════════════════════════════
-- 사용자 목표:
--   "회원의 계약정보가 변경되면 존에도 같이 적용. 회원과 계약정보가 중요."
--   "존은 회원이 점유하는 물건일 뿐"
--
-- 보강:
--   1) farm_rentals.status active → expired/cancelled 시 memberships 자동 cancel
--   2) memberships.status active → cancelled/expired 시 farm_rentals 자동 expire
--   3) 이석형테스트 (062-a 흔적) 계약 expire 보정 — prod 적용 완료
-- ═══════════════════════════════════════════════════════════════════

-- Step 1: 이석형테스트 잔존 계약 expire
UPDATE public.farm_rentals
SET status='expired', updated_at=NOW()
WHERE id='1cfe66df-5a04-47c5-808d-3744441ea285'
  AND member_id='f25a91b4-8faa-4921-812d-b401396cbad3';

INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
SELECT NULL, 'cleanup_orphan_rental', 'farm_rental', '1cfe66df-5a04-47c5-808d-3744441ea285',
  jsonb_build_object('reason', '062-a 멤버십 expire 후 잔존 계약 정리', 'member_name', '이석형테스트')
WHERE EXISTS (SELECT 1 FROM public.farm_rentals WHERE id='1cfe66df-5a04-47c5-808d-3744441ea285' AND status='expired');

-- Step 2: rentals → memberships 동기화 트리거
CREATE OR REPLACE FUNCTION public.fn_sync_membership_with_rental()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $fn$
DECLARE v_count INT;
BEGIN
  IF OLD.status = 'active' AND NEW.status IN ('expired', 'cancelled') THEN
    WITH cancelled AS (
      UPDATE public.memberships m
      SET status='cancelled', updated_at=NOW()
      WHERE m.member_id = NEW.member_id AND m.farm_id = NEW.farm_id AND m.status = 'active'
      RETURNING id
    )
    SELECT COUNT(*) INTO v_count FROM cancelled;
    IF v_count > 0 THEN
      INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
      VALUES (auth.uid(), 'auto_cancel_membership_on_rental_change', 'farm_rental', NEW.id,
        jsonb_build_object('cancelled_count', v_count, 'rental_new_status', NEW.status));
    END IF;
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_sync_membership_with_rental ON public.farm_rentals;
CREATE TRIGGER trg_sync_membership_with_rental
  AFTER UPDATE OF status ON public.farm_rentals
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_membership_with_rental();

-- Step 3: memberships → rentals 동기화 트리거
CREATE OR REPLACE FUNCTION public.fn_sync_rental_with_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $fn$
DECLARE v_count INT;
BEGIN
  IF OLD.status = 'active' AND NEW.status IN ('expired', 'cancelled') AND NEW.farm_id IS NOT NULL THEN
    WITH expired AS (
      UPDATE public.farm_rentals fr
      SET status='expired', updated_at=NOW()
      WHERE fr.member_id = NEW.member_id AND fr.farm_id = NEW.farm_id AND fr.status = 'active'
      RETURNING id
    )
    SELECT COUNT(*) INTO v_count FROM expired;
    IF v_count > 0 THEN
      INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
      VALUES (auth.uid(), 'auto_expire_rental_on_membership_change', 'membership', NEW.id,
        jsonb_build_object('expired_count', v_count, 'membership_new_status', NEW.status));
    END IF;
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_sync_rental_with_membership ON public.memberships;
CREATE TRIGGER trg_sync_rental_with_membership
  AFTER UPDATE OF status ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_rental_with_membership();

COMMENT ON FUNCTION public.fn_sync_membership_with_rental IS
  '066: farm_rentals 비활성 시 같은 (member,farm) 의 active membership 자동 cancel.';
COMMENT ON FUNCTION public.fn_sync_rental_with_membership IS
  '066: memberships 비활성 시 같은 (member,farm) 의 active rental 자동 expire.';

-- Step 4: farms.status 재동기화
UPDATE public.farms f SET status=(
  CASE WHEN EXISTS (SELECT 1 FROM public.memberships WHERE farm_id=f.id AND status='active')
            OR EXISTS (SELECT 1 FROM public.farm_rentals WHERE farm_id=f.id AND status='active' AND end_date>=CURRENT_DATE)
       THEN 'rented' ELSE 'available' END
) WHERE f.deleted_at IS NULL;
