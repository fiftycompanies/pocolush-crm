-- 037_notice_pin.sql — 공지사항 고정 기능 (핀 순서 + 토글 + 재정렬 + 자동 해제)

-- 1) 핀 순서 컬럼 (NULL = 미고정, 0부터 오름차순 = 고정 순서)
ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS pin_order INT NULL;

-- 2) 유일성 제약 (동일 pin_order 방지, 미고정끼리는 NULL 중복 허용)
CREATE UNIQUE INDEX IF NOT EXISTS notices_pin_order_uniq
  ON public.notices (pin_order)
  WHERE pin_order IS NOT NULL;

-- 3) 고객 조회 최적화 부분 인덱스
CREATE INDEX IF NOT EXISTS notices_pin_published_idx
  ON public.notices (pin_order NULLS LAST, published_at DESC)
  WHERE is_published = true;

-- 4) 미발행 전환 시 자동 핀 해제 트리거 (Before Update)
CREATE OR REPLACE FUNCTION public.fn_notices_unpin_on_unpublish()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_published = false AND OLD.is_published = true AND OLD.pin_order IS NOT NULL THEN
    NEW.pin_order := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notices_unpin_on_unpublish ON public.notices;
CREATE TRIGGER notices_unpin_on_unpublish
  BEFORE UPDATE OF is_published ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.fn_notices_unpin_on_unpublish();

-- 5) 토글 RPC (핀/해제 자동 결정 + 해제 시 뒤 핀 순서 shift)
CREATE OR REPLACE FUNCTION public.toggle_notice_pin(p_notice_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current INT;
  v_max INT;
  v_is_admin BOOLEAN;
BEGIN
  -- 1) admin 체크 (SECURITY DEFINER는 RLS 우회 → 수동 체크 필수)
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  INTO v_is_admin;
  IF NOT v_is_admin THEN RAISE EXCEPTION 'not_admin'; END IF;

  -- 2) 공지 존재 + row-level 락
  SELECT pin_order INTO v_current FROM notices WHERE id = p_notice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'notice_not_found'; END IF;

  -- 3) 전역 advisory lock으로 pin_order race 차단
  PERFORM pg_advisory_xact_lock(hashtext('notices_pin_order'));

  IF v_current IS NULL THEN
    -- 신규 고정: MAX+1 (0부터 시작)
    SELECT COALESCE(MAX(pin_order), -1) + 1 INTO v_max FROM notices WHERE pin_order IS NOT NULL;
    UPDATE notices SET pin_order = v_max, updated_at = now() WHERE id = p_notice_id;
    RETURN v_max;
  ELSE
    -- 해제 + 뒤 핀들 shift
    UPDATE notices SET pin_order = NULL, updated_at = now() WHERE id = p_notice_id;
    UPDATE notices SET pin_order = pin_order - 1, updated_at = now() WHERE pin_order > v_current;
    RETURN NULL;
  END IF;
END $$;

-- 6) 재정렬 RPC (전체 배열 방식 + 2-pass UNIQUE 회피)
CREATE OR REPLACE FUNCTION public.reorder_notice_pins(p_ordered_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_len INT := COALESCE(array_length(p_ordered_ids, 1), 0);
  v_distinct_len INT;
BEGIN
  -- 1) admin 체크
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  INTO v_is_admin;
  IF NOT v_is_admin THEN RAISE EXCEPTION 'not_admin'; END IF;

  -- 2) 입력 검증 (길이 상한 100, 중복/NULL 금지)
  IF v_len = 0 OR v_len > 100 THEN RAISE EXCEPTION 'invalid_array_length %', v_len; END IF;
  SELECT count(DISTINCT x) INTO v_distinct_len FROM unnest(p_ordered_ids) x WHERE x IS NOT NULL;
  IF v_distinct_len <> v_len THEN RAISE EXCEPTION 'duplicate_or_null_ids'; END IF;

  -- 3) 동시성 락
  PERFORM pg_advisory_xact_lock(hashtext('notices_pin_order'));

  -- 4) 2-pass: UNIQUE 제약 충돌 회피 (음수 → 양수)
  UPDATE notices
     SET pin_order = -(arr.idx) - 1
  FROM unnest(p_ordered_ids) WITH ORDINALITY arr(id, idx)
  WHERE notices.id = arr.id
    AND notices.pin_order IS NOT NULL
    AND notices.is_published = true;

  UPDATE notices
     SET pin_order = -pin_order - 1, updated_at = now()
  WHERE pin_order < 0;
END $$;

-- 7) GRANT: PUBLIC revoke + authenticated 한정
REVOKE EXECUTE ON FUNCTION public.toggle_notice_pin(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reorder_notice_pins(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_notice_pin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_notice_pins(UUID[]) TO authenticated;
