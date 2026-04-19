-- 038_notice_pin_hotfix.sql — 037 블로커 3건 핫픽스 (v3: SELECT INTO 완전 제거)
-- Supabase SQL Editor가 "SELECT ... INTO var" 패턴을 PL/pgSQL 변수 할당 대신
-- SQL SELECT INTO (테이블 생성)으로 해석 → 모든 SELECT INTO를 아래 패턴으로 교체:
--   · 존재 확인: PERFORM ... FROM ... WHERE ...; IF NOT FOUND THEN RAISE
--   · 값 조회: var := (SELECT ... FROM ... WHERE ...)
-- 이 조합은 036 패턴과 일치하여 Supabase에서 안정적으로 동작.

-- ═══════════════════════════════════════
-- 1) toggle_notice_pin 재작성 (SELECT INTO 없음)
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
BEGIN
  -- admin 체크
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  -- 전역 advisory lock
  PERFORM pg_advisory_xact_lock(hashtext('notices_pin_order'));

  -- 공지 존재 + row lock (PERFORM은 FOUND 세팅)
  PERFORM 1 FROM public.notices WHERE id = p_notice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notice_not_found';
  END IF;

  -- 현재 pin_order 조회 (스칼라 할당)
  v_current := (SELECT pin_order FROM public.notices WHERE id = p_notice_id);

  IF v_current IS NULL THEN
    -- 신규 고정: MAX+1
    v_max := COALESCE((SELECT MAX(pin_order) FROM public.notices WHERE pin_order IS NOT NULL), -1) + 1;
    UPDATE public.notices SET pin_order = v_max, updated_at = now() WHERE id = p_notice_id;
    RETURN v_max;
  ELSE
    -- 해제 + 뒤 핀 shift
    UPDATE public.notices SET pin_order = NULL, updated_at = now() WHERE id = p_notice_id;
    UPDATE public.notices SET pin_order = pin_order - 1, updated_at = now() WHERE pin_order > v_current;
    RETURN NULL;
  END IF;
END;
$fn_038_toggle$;

REVOKE EXECUTE ON FUNCTION public.toggle_notice_pin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_notice_pin(UUID) TO authenticated;

-- ═══════════════════════════════════════
-- 2) 자동 해제 트리거 (BEFORE UPDATE OF is_published, 단일 트리거)
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
-- 3) reorder 재작성 (SELECT INTO 없음)
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

  -- 입력 길이 (스칼라 할당)
  v_len := COALESCE(array_length(p_ordered_ids, 1), 0);
  IF v_len = 0 OR v_len > 100 THEN
    RAISE EXCEPTION 'invalid_array_length %', v_len;
  END IF;

  -- 중복/NULL 검증 (스칼라 할당)
  v_distinct_len := (SELECT count(DISTINCT x) FROM unnest(p_ordered_ids) x WHERE x IS NOT NULL);
  IF v_distinct_len <> v_len THEN
    RAISE EXCEPTION 'duplicate_or_null_ids';
  END IF;

  -- 동시성 락
  PERFORM pg_advisory_xact_lock(hashtext('notices_pin_order'));

  -- 1단계: 전체 기존 핀을 임시 음수로 전환 (UNIQUE 충돌 회피)
  UPDATE public.notices
     SET pin_order = -pin_order - 1000
   WHERE pin_order IS NOT NULL;

  -- 2단계: 입력 배열 순서대로 0부터 재할당
  UPDATE public.notices
     SET pin_order = arr.idx - 1, updated_at = now()
    FROM unnest(p_ordered_ids) WITH ORDINALITY arr(id, idx)
   WHERE public.notices.id = arr.id
     AND public.notices.pin_order IS NOT NULL;

  -- 3단계: 음수로 남은 것(배열에 없던 기존 핀) → NULL 해제
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
