-- 038_notice_pin_hotfix.sql — 037 블로커 3건 핫픽스 (v2: BEFORE 트리거 단일화)
-- 1) toggle RPC: `:=` 스칼라 할당 후 IF NOT FOUND 무동작 → SELECT INTO 패턴 복귀
-- 2) unpublish 트리거: 자기 해제 + 나머지 shift를 BEFORE 트리거 하나로 통합 (AFTER UPDATE OF 구문 회피)
-- 3) reorder RPC: 전체 핀 음수 전환 후 재할당으로 UNIQUE 충돌 차단
-- 4) DELETE 시 pin_order shift 트리거 추가

-- ═══════════════════════════════════════
-- 1) toggle_notice_pin 재작성 (SELECT INTO 복귀)
-- ═══════════════════════════════════════
DROP FUNCTION IF EXISTS public.toggle_notice_pin(UUID);

CREATE FUNCTION public.toggle_notice_pin(p_notice_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn_038_toggle$
DECLARE
  v_current INT;
  v_max INT;
  v_found_marker INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('notices_pin_order'));

  SELECT pin_order, 1 INTO v_current, v_found_marker
  FROM public.notices
  WHERE id = p_notice_id
  FOR UPDATE;

  IF v_found_marker IS NULL THEN
    RAISE EXCEPTION 'notice_not_found';
  END IF;

  IF v_current IS NULL THEN
    SELECT COALESCE(MAX(pin_order), -1) + 1 INTO v_max
    FROM public.notices
    WHERE pin_order IS NOT NULL;

    UPDATE public.notices SET pin_order = v_max, updated_at = now() WHERE id = p_notice_id;
    RETURN v_max;
  ELSE
    UPDATE public.notices SET pin_order = NULL, updated_at = now() WHERE id = p_notice_id;
    UPDATE public.notices SET pin_order = pin_order - 1, updated_at = now() WHERE pin_order > v_current;
    RETURN NULL;
  END IF;
END;
$fn_038_toggle$;

REVOKE EXECUTE ON FUNCTION public.toggle_notice_pin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_notice_pin(UUID) TO authenticated;

-- ═══════════════════════════════════════
-- 2) 자동 해제 트리거 (BEFORE UPDATE OF is_published 단일 트리거)
--    자기 자신 NEW.pin_order := NULL + 나머지 shift 둘 다 처리
-- ═══════════════════════════════════════
DROP TRIGGER IF EXISTS notices_unpin_on_unpublish ON public.notices;
DROP TRIGGER IF EXISTS notices_unpin_on_unpublish_before ON public.notices;
DROP TRIGGER IF EXISTS notices_unpin_shift_after ON public.notices;
DROP FUNCTION IF EXISTS public.fn_notices_unpin_on_unpublish();
DROP FUNCTION IF EXISTS public.fn_notices_unpin_before();
DROP FUNCTION IF EXISTS public.fn_notices_unpin_shift_after();

CREATE FUNCTION public.fn_notices_unpin_on_unpublish()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn_038_unpin$
DECLARE
  v_old_pin INT;
BEGIN
  IF NEW.is_published = false AND OLD.is_published = true AND OLD.pin_order IS NOT NULL THEN
    v_old_pin := OLD.pin_order;
    NEW.pin_order := NULL;
    UPDATE public.notices
       SET pin_order = pin_order - 1, updated_at = now()
     WHERE pin_order > v_old_pin;
  END IF;
  RETURN NEW;
END;
$fn_038_unpin$;

CREATE TRIGGER notices_unpin_on_unpublish
  BEFORE UPDATE OF is_published ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.fn_notices_unpin_on_unpublish();

-- ═══════════════════════════════════════
-- 3) reorder 재작성: 전체 음수 전환 → 재할당 → 미사용 NULL
-- ═══════════════════════════════════════
DROP FUNCTION IF EXISTS public.reorder_notice_pins(UUID[]);

CREATE FUNCTION public.reorder_notice_pins(p_ordered_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn_038_reorder$
DECLARE
  v_len INT;
  v_distinct_len INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  v_len := COALESCE(array_length(p_ordered_ids, 1), 0);
  IF v_len = 0 OR v_len > 100 THEN
    RAISE EXCEPTION 'invalid_array_length %', v_len;
  END IF;

  v_distinct_len := (SELECT count(DISTINCT x) FROM unnest(p_ordered_ids) x WHERE x IS NOT NULL);
  IF v_distinct_len <> v_len THEN
    RAISE EXCEPTION 'duplicate_or_null_ids';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('notices_pin_order'));

  UPDATE public.notices
     SET pin_order = -pin_order - 1000
  WHERE pin_order IS NOT NULL;

  UPDATE public.notices
     SET pin_order = arr.idx - 1, updated_at = now()
  FROM unnest(p_ordered_ids) WITH ORDINALITY arr(id, idx)
  WHERE public.notices.id = arr.id
    AND public.notices.pin_order IS NOT NULL;

  UPDATE public.notices
     SET pin_order = NULL, updated_at = now()
  WHERE pin_order < 0;
END;
$fn_038_reorder$;

REVOKE EXECUTE ON FUNCTION public.reorder_notice_pins(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_notice_pins(UUID[]) TO authenticated;

-- ═══════════════════════════════════════
-- 4) DELETE 시 pin_order shift 트리거
-- ═══════════════════════════════════════
DROP TRIGGER IF EXISTS notices_delete_pin_shift ON public.notices;
DROP FUNCTION IF EXISTS public.fn_notices_delete_pin_shift();

CREATE FUNCTION public.fn_notices_delete_pin_shift()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn_038_del$
BEGIN
  IF OLD.pin_order IS NOT NULL THEN
    UPDATE public.notices
       SET pin_order = pin_order - 1, updated_at = now()
     WHERE pin_order > OLD.pin_order;
  END IF;
  RETURN OLD;
END;
$fn_038_del$;

CREATE TRIGGER notices_delete_pin_shift
  AFTER DELETE ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.fn_notices_delete_pin_shift();
