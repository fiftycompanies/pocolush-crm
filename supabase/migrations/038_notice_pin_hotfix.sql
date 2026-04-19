-- 038_notice_pin_hotfix.sql — 037 블로커 3건 핫픽스
-- 1) toggle RPC: `:=` 스칼라 할당 후 IF NOT FOUND 무동작 → SELECT INTO 패턴 복귀
-- 2) unpublish 트리거: 자동 해제 후 뒤 핀들 shift 추가
-- 3) reorder RPC: 배열에 포함되지 않은 고정 공지 전량을 먼저 NULL로 초기화 → UNIQUE 충돌 차단

-- ═══════════════════════════════════════
-- 1) toggle_notice_pin 재작성
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
  v_exists BOOLEAN := FALSE;
BEGIN
  -- admin 체크
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  -- 전역 advisory lock (race 차단)
  PERFORM pg_advisory_xact_lock(hashtext('notices_pin_order'));

  -- 공지 존재 확인 + row lock — SELECT INTO 패턴으로 FOUND 정상 세팅
  SELECT pin_order, TRUE INTO v_current, v_exists
  FROM public.notices
  WHERE id = p_notice_id
  FOR UPDATE;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'notice_not_found';
  END IF;

  IF v_current IS NULL THEN
    -- 신규 고정: MAX+1 (0부터 시작)
    SELECT COALESCE(MAX(pin_order), -1) + 1 INTO v_max
    FROM public.notices
    WHERE pin_order IS NOT NULL;

    UPDATE public.notices SET pin_order = v_max, updated_at = now() WHERE id = p_notice_id;
    RETURN v_max;
  ELSE
    -- 해제 + 뒤 핀들 shift
    UPDATE public.notices SET pin_order = NULL, updated_at = now() WHERE id = p_notice_id;
    UPDATE public.notices SET pin_order = pin_order - 1, updated_at = now() WHERE pin_order > v_current;
    RETURN NULL;
  END IF;
END;
$fn_038_toggle$;

REVOKE EXECUTE ON FUNCTION public.toggle_notice_pin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_notice_pin(UUID) TO authenticated;

-- ═══════════════════════════════════════
-- 2) 자동 해제 트리거: shift 추가 (BEFORE → AFTER로 전환 필요, shift는 다른 row 대상)
-- ═══════════════════════════════════════
DROP TRIGGER IF EXISTS notices_unpin_on_unpublish ON public.notices;
DROP FUNCTION IF EXISTS public.fn_notices_unpin_on_unpublish();

-- BEFORE: 자기 자신의 pin_order=NULL (NEW 조작)
CREATE FUNCTION public.fn_notices_unpin_before()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn_038_unpin_before$
BEGIN
  IF NEW.is_published = false AND OLD.is_published = true AND OLD.pin_order IS NOT NULL THEN
    NEW.pin_order := NULL;
  END IF;
  RETURN NEW;
END;
$fn_038_unpin_before$;

-- AFTER: 나머지 핀들 shift (다른 row UPDATE)
CREATE FUNCTION public.fn_notices_unpin_shift_after()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn_038_unpin_shift$
BEGIN
  IF NEW.pin_order IS NULL AND OLD.pin_order IS NOT NULL THEN
    UPDATE public.notices
       SET pin_order = pin_order - 1, updated_at = now()
     WHERE pin_order > OLD.pin_order;
  END IF;
  RETURN NULL; -- AFTER는 반환값 무시
END;
$fn_038_unpin_shift$;

CREATE TRIGGER notices_unpin_on_unpublish_before
  BEFORE UPDATE OF is_published ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.fn_notices_unpin_before();

CREATE TRIGGER notices_unpin_shift_after
  AFTER UPDATE OF pin_order ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.fn_notices_unpin_shift_after();

-- ═══════════════════════════════════════
-- 3) reorder 재작성: 전체 초기화 후 재할당 (UNIQUE 충돌 원천 차단)
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
  -- admin 체크
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  -- 입력 검증
  v_len := COALESCE(array_length(p_ordered_ids, 1), 0);
  IF v_len = 0 OR v_len > 100 THEN
    RAISE EXCEPTION 'invalid_array_length %', v_len;
  END IF;

  v_distinct_len := (SELECT count(DISTINCT x) FROM unnest(p_ordered_ids) x WHERE x IS NOT NULL);
  IF v_distinct_len <> v_len THEN
    RAISE EXCEPTION 'duplicate_or_null_ids';
  END IF;

  -- 동시성 락
  PERFORM pg_advisory_xact_lock(hashtext('notices_pin_order'));

  -- 전체 기존 핀들을 임시로 음수 전환 (UNIQUE 충돌 원천 차단)
  UPDATE public.notices
     SET pin_order = -pin_order - 1000
  WHERE pin_order IS NOT NULL;

  -- 입력 배열 순서대로 0부터 재할당 (is_published 무관 — 클라이언트가 필터링한 결과 그대로)
  UPDATE public.notices
     SET pin_order = arr.idx - 1, updated_at = now()
  FROM unnest(p_ordered_ids) WITH ORDINALITY arr(id, idx)
  WHERE public.notices.id = arr.id
    AND public.notices.pin_order IS NOT NULL;

  -- 음수로 남은 것(= 입력 배열에 없는 기존 핀) → NULL (해제)
  UPDATE public.notices
     SET pin_order = NULL, updated_at = now()
  WHERE pin_order < 0;
END;
$fn_038_reorder$;

REVOKE EXECUTE ON FUNCTION public.reorder_notice_pins(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_notice_pins(UUID[]) TO authenticated;

-- ═══════════════════════════════════════
-- 4) DELETE 시 pin_order shift 트리거 추가
-- ═══════════════════════════════════════
DROP TRIGGER IF EXISTS notices_delete_pin_shift ON public.notices;
DROP FUNCTION IF EXISTS public.fn_notices_delete_pin_shift();

CREATE FUNCTION public.fn_notices_delete_pin_shift()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn_038_del_shift$
BEGIN
  IF OLD.pin_order IS NOT NULL THEN
    UPDATE public.notices
       SET pin_order = pin_order - 1, updated_at = now()
     WHERE pin_order > OLD.pin_order;
  END IF;
  RETURN NULL;
END;
$fn_038_del_shift$;

CREATE TRIGGER notices_delete_pin_shift
  AFTER DELETE ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.fn_notices_delete_pin_shift();
