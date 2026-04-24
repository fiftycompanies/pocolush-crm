-- ═══════════════════════════════════════════════════════════════════
-- 058: notice_images RLS hotfix + reorder RPC (Phase 0.5 배포 전)
-- ═══════════════════════════════════════════════════════════════════
-- 배경:
--   H4 (8스킬 Backend검수 BLOCKER-056-2): 056 notice_images_read 정책이
--     `EXISTS (profiles WHERE id = auth.uid())` 로 role 미검증 → 비어있는
--     profile row 만 있어도 미발행 draft 이미지 노출 가능.
--   H3 (QA 검수): reorderNoticeImages 가 2개 독립 UPDATE (non-atomic)
--     → 일부 실패 시 display_order drift. RPC 로 원자성 확보.
-- ═══════════════════════════════════════════════════════════════════

-- 1. RLS 재정의 — admin role 명시 검증 (H4)
DROP POLICY IF EXISTS "notice_images_read" ON public.notice_images;
CREATE POLICY "notice_images_read"
  ON public.notice_images
  FOR SELECT
  USING (
    -- 공개 공지 이미지: 누구나
    EXISTS (
      SELECT 1 FROM public.notices
      WHERE id = notice_images.notice_id
        AND is_published = true
    )
    -- 관리자만 draft/미발행 포함 전체 (role='admin' 명시)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

COMMENT ON POLICY "notice_images_read" ON public.notice_images IS
  '공개 공지는 누구나, draft/미발행은 role=admin 만. 058 에서 role 검증 추가.';

-- 2. reorder RPC — 원자적 swap (H3)
CREATE OR REPLACE FUNCTION public.fn_notice_images_reorder_swap(
  p_image_a_id UUID,
  p_image_b_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn_058_reorder$
DECLARE
  v_notice_id  UUID;
  v_a_order    INT;
  v_b_order    INT;
  v_is_admin   BOOLEAN;
BEGIN
  -- admin 권한 재확인 (SECURITY DEFINER 이므로 명시 필요)
  v_is_admin := EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
  IF NOT v_is_admin THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다' USING ERRCODE = '42501';
  END IF;

  -- 두 이미지의 현재 order + 동일 notice 소속 검증
  SELECT display_order, notice_id INTO v_a_order, v_notice_id
    FROM public.notice_images WHERE id = p_image_a_id;
  IF v_a_order IS NULL THEN
    RAISE EXCEPTION '이미지 A 가 존재하지 않습니다' USING ERRCODE = 'P0002';
  END IF;

  SELECT display_order INTO v_b_order
    FROM public.notice_images
    WHERE id = p_image_b_id AND notice_id = v_notice_id;
  IF v_b_order IS NULL THEN
    RAISE EXCEPTION '이미지 B 가 존재하지 않거나 다른 공지 소속입니다' USING ERRCODE = 'P0002';
  END IF;

  -- 3-step swap: unique 제약 없으나 미래 대비 안전하게 진행
  -- notice_id 단위 락으로 동시 reorder 직렬화
  PERFORM pg_advisory_xact_lock(hashtextextended(v_notice_id::text, 0));

  UPDATE public.notice_images SET display_order = -1 WHERE id = p_image_a_id;
  UPDATE public.notice_images SET display_order = v_a_order WHERE id = p_image_b_id;
  UPDATE public.notice_images SET display_order = v_b_order WHERE id = p_image_a_id;
END
$fn_058_reorder$;

COMMENT ON FUNCTION public.fn_notice_images_reorder_swap IS
  '공지 이미지 2장 display_order 원자적 swap. 058 H3 해결.';

-- 클라이언트 호출 허용
GRANT EXECUTE ON FUNCTION public.fn_notice_images_reorder_swap(UUID, UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 검증:
--   SELECT polname, polqual::text FROM pg_policy
--     WHERE polrelid = 'public.notice_images'::regclass;
--   SELECT proname FROM pg_proc WHERE proname = 'fn_notice_images_reorder_swap';
-- ═══════════════════════════════════════════════════════════════════
