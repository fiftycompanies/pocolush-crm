-- 073: toggle_notice_pin RPC 진단 강화 + UNIQUE 충돌 회피
-- 배경: 사용자가 "고정 변경에 실패했습니다." 토스트 발생. RPC 의 message 가
--       'not_admin'/'notice_not_found' 어디에도 매칭 안 되는 미상 에러.
--
-- 조치:
--   1. auth.uid() NULL 명시 분기
--   2. UNIQUE partial index 충돌 회피: 2-단계 shift (음수 임시 영역 → 양수 복귀)
--   3. EXCEPTION WHEN OTHERS 로 모든 에러를 명시 message 와 함께 raise
--   4. unique_violation 별도 분기 (pin_unique_conflict)

CREATE OR REPLACE FUNCTION public.toggle_notice_pin(p_notice_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_current INT;
  v_max INT;
  v_uid UUID;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_admin: auth uid is null' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND role = 'admin') THEN
    RAISE EXCEPTION 'not_admin: uid=% role mismatch', v_uid USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('notices_pin_order'));

  PERFORM 1 FROM public.notices WHERE id = p_notice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notice_not_found: %', p_notice_id USING ERRCODE = 'P0001';
  END IF;

  v_current := (SELECT pin_order FROM public.notices WHERE id = p_notice_id);

  IF v_current IS NULL THEN
    v_max := COALESCE((SELECT MAX(pin_order) FROM public.notices WHERE pin_order IS NOT NULL), -1) + 1;
    UPDATE public.notices SET pin_order = v_max, updated_at = now() WHERE id = p_notice_id;
    RETURN v_max;
  ELSE
    -- 해제 + 뒤 핀 shift (UNIQUE partial index 충돌 회피)
    UPDATE public.notices SET pin_order = NULL, updated_at = now() WHERE id = p_notice_id;
    UPDATE public.notices SET pin_order = -(pin_order + 1000), updated_at = now() WHERE pin_order > v_current;
    UPDATE public.notices SET pin_order = -pin_order - 1000 - 1, updated_at = now() WHERE pin_order < 0;
    RETURN NULL;
  END IF;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'pin_unique_conflict: %', SQLERRM USING ERRCODE = 'P0001';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'toggle_notice_pin_error: % (code=%)', SQLERRM, SQLSTATE USING ERRCODE = 'P0001';
END;
$function$;

GRANT EXECUTE ON FUNCTION public.toggle_notice_pin(uuid) TO authenticated;
