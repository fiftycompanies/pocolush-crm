-- 074: 핀 shift 트리거 2개 안전망 강화 (UNIQUE partial index 충돌 회피)
-- 패턴: 073 toggle_notice_pin + reorder_notice_pins 와 동일한 임시 음수 영역 사용
-- 트리거: DELETE / is_published=true→false 시 자동 호출

CREATE OR REPLACE FUNCTION public.fn_notices_delete_pin_shift()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF OLD.pin_order IS NOT NULL THEN
    -- 2단계 shift (UNIQUE partial index 충돌 회피)
    UPDATE public.notices
       SET pin_order = -(pin_order + 1000), updated_at = now()
     WHERE pin_order > OLD.pin_order;
    UPDATE public.notices
       SET pin_order = -pin_order - 1000 - 1, updated_at = now()
     WHERE pin_order < 0;
  END IF;
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_notices_unpin_on_unpublish()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_old_pin INT;
BEGIN
  IF NEW.is_published = false AND OLD.is_published = true AND OLD.pin_order IS NOT NULL THEN
    v_old_pin := OLD.pin_order;
    NEW.pin_order := NULL;
    -- 2단계 shift (UNIQUE partial index 충돌 회피)
    UPDATE public.notices
       SET pin_order = -(pin_order + 1000), updated_at = now()
     WHERE pin_order > v_old_pin;
    UPDATE public.notices
       SET pin_order = -pin_order - 1000 - 1, updated_at = now()
     WHERE pin_order < 0;
  END IF;
  RETURN NEW;
END;
$function$;
