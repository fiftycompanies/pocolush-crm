-- 037_notice_pin.sql — 공지사항 고정 기능 (핀 순서 + 토글 + 재정렬 + 자동 해제)
-- 재작성: 라벨드 달러쿼트 + 인라인 EXISTS 패턴 (SELECT INTO 미사용)

-- 1) 핀 순서 컬럼
ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS pin_order INT NULL;

-- 2) 유일성 제약 (미고정 NULL 중복 허용)
CREATE UNIQUE INDEX IF NOT EXISTS notices_pin_order_uniq
  ON public.notices (pin_order)
  WHERE pin_order IS NOT NULL;

-- 3) 고객 조회 최적화 부분 인덱스
CREATE INDEX IF NOT EXISTS notices_pin_published_idx
  ON public.notices (pin_order NULLS LAST, published_at DESC)
  WHERE is_published = true;

-- 4) 미발행 전환 시 자동 핀 해제 트리거
DROP TRIGGER IF EXISTS notices_unpin_on_unpublish ON public.notices;
DROP FUNCTION IF EXISTS public.fn_notices_unpin_on_unpublish();

CREATE FUNCTION public.fn_notices_unpin_on_unpublish()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn_037_unpin$
BEGIN
  IF NEW.is_published = false AND OLD.is_published = true AND OLD.pin_order IS NOT NULL THEN
    NEW.pin_order := NULL;
  END IF;
  RETURN NEW;
END;
$fn_037_unpin$;

CREATE TRIGGER notices_unpin_on_unpublish
  BEFORE UPDATE OF is_published ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.fn_notices_unpin_on_unpublish();

-- 5) 토글 RPC
DROP FUNCTION IF EXISTS public.toggle_notice_pin(UUID);

CREATE FUNCTION public.toggle_notice_pin(p_notice_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn_037_toggle$
DECLARE
  v_current INT;
  v_max INT;
BEGIN
  -- admin 체크 (인라인 EXISTS, SELECT INTO 미사용)
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  -- 공지 존재 + row-level 락
  v_current := (SELECT pin_order FROM public.notices WHERE id = p_notice_id FOR UPDATE);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notice_not_found';
  END IF;

  -- 전역 advisory lock으로 pin_order race 차단
  PERFORM pg_advisory_xact_lock(hashtext('notices_pin_order'));

  IF v_current IS NULL THEN
    -- 신규 고정: MAX+1 (0부터 시작)
    v_max := COALESCE((SELECT MAX(pin_order) FROM public.notices WHERE pin_order IS NOT NULL), -1) + 1;
    UPDATE public.notices SET pin_order = v_max, updated_at = now() WHERE id = p_notice_id;
    RETURN v_max;
  ELSE
    -- 해제 + 뒤 핀들 shift
    UPDATE public.notices SET pin_order = NULL, updated_at = now() WHERE id = p_notice_id;
    UPDATE public.notices SET pin_order = pin_order - 1, updated_at = now() WHERE pin_order > v_current;
    RETURN NULL;
  END IF;
END;
$fn_037_toggle$;

-- 6) 재정렬 RPC (전체 배열 + 2-pass UNIQUE 회피)
DROP FUNCTION IF EXISTS public.reorder_notice_pins(UUID[]);

CREATE FUNCTION public.reorder_notice_pins(p_ordered_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn_037_reorder$
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

  -- 2-pass: UNIQUE 제약 충돌 회피 (음수 → 양수)
  UPDATE public.notices
     SET pin_order = -(arr.idx) - 1
  FROM unnest(p_ordered_ids) WITH ORDINALITY arr(id, idx)
  WHERE public.notices.id = arr.id
    AND public.notices.pin_order IS NOT NULL
    AND public.notices.is_published = true;

  UPDATE public.notices
     SET pin_order = -pin_order - 1, updated_at = now()
  WHERE pin_order < 0;
END;
$fn_037_reorder$;

-- 7) GRANT
REVOKE EXECUTE ON FUNCTION public.toggle_notice_pin(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reorder_notice_pins(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_notice_pin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_notice_pins(UUID[]) TO authenticated;
