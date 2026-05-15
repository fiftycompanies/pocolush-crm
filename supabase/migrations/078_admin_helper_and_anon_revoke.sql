-- 078: A8 (anon REVOKE) + A2 (assert_admin_with_audit 헬퍼)
-- 검수 결과 적용. 라이브 영향 0 (DDL, 진행 호출 영향 없음).

CREATE OR REPLACE FUNCTION public.assert_admin_with_audit(
  p_action TEXT,
  p_resource_type TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn_078$
DECLARE
  v_caller UUID := (SELECT auth.uid());
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_caller AND role = 'admin'
  ) THEN
    INSERT INTO public.audit_logs (actor_id, action, resource_type, metadata, created_at)
    VALUES (v_caller, p_action || '_unauthorized', p_resource_type, p_metadata, NOW());
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;
END;
$fn_078$;

GRANT EXECUTE ON FUNCTION public.assert_admin_with_audit(TEXT, TEXT, JSONB) TO authenticated;

-- A8: anon REVOKE — defense-in-depth (admin only RPC)
REVOKE EXECUTE ON FUNCTION public.get_bbq_board(DATE, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_bbq_board(DATE, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.toggle_notice_pin(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.toggle_notice_pin(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reorder_notice_pins(UUID[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reorder_notice_pins(UUID[]) FROM PUBLIC;
