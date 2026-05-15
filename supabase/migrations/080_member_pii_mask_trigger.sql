-- 080: Q5 — 회원 탈퇴 PII 마스킹 DB 트리거 (앱 레이어 의존 제거)

CREATE OR REPLACE FUNCTION public.fn_mask_deleted_member_pii()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public', 'pg_temp'
AS $fn_080$
BEGIN
  IF NEW.pii_purged = TRUE THEN RETURN NEW; END IF;

  IF NEW.status = 'deleted' AND (OLD.status IS DISTINCT FROM 'deleted' OR OLD.pii_purged = FALSE) THEN
    NEW.name              := '탈퇴회원';
    NEW.phone             := NULL;
    NEW.email             := NULL;
    NEW.address           := NULL;
    NEW.car_number        := NULL;
    NEW.memo              := NULL;
    NEW.push_token        := NULL;
    NEW.pipa_agreed_ip    := NULL;
    NEW.pipa_agreed_ua    := NULL;
    NEW.pii_purged        := TRUE;
    NEW.updated_at        := NOW();
  END IF;

  RETURN NEW;
END;
$fn_080$;

DROP TRIGGER IF EXISTS trg_mask_deleted_member_pii ON public.members;
CREATE TRIGGER trg_mask_deleted_member_pii
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_mask_deleted_member_pii();
