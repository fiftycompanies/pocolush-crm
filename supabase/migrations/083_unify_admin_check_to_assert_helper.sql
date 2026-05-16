-- 083: 10 RPC 함수의 admin 체크를 assert_admin_with_audit 헬퍼로 일괄 통일
--
-- 배경 (research/plan §4):
-- - 078 에서 assert_admin_with_audit 헬퍼 도입 완료 (admin 아니면 audit_logs INSERT + RAISE)
-- - 기존 10개 함수가 인라인 admin 체크 (is_admin() 또는 EXISTS profiles role='admin')
-- - unauthorized 시도가 audit_logs 에 기록되지 않음 — PIPA 5년 보관 의무 미충족
--
-- 변경:
-- - 각 함수의 admin 체크 부분만 PERFORM public.assert_admin_with_audit() 로 교체
-- - 비즈니스 로직 본문은 snapshot 그대로 유지 (시그니처/반환/RLS 영향 0)
-- - 정상 호출 audit_logs 는 기존 함수 본문 INSERT 그대로
--
-- 대상 (10건):
--   members 도메인 (4): suspend_member / unsuspend_member / request_member_deletion / restore_member_deletion
--   membership 도메인 (1): change_membership_zone
--   notices 도메인 (1): toggle_notice_pin
--   trigger_error_logs 도메인 (4): ack_trigger_error_log / ack_all_trigger_error_logs / get_unacked_error_count / trigger_error_monthly_summary
--
-- 통일 대상 외 (admin 체크 없음 — RLS 의존):
--   get_available_farms_for_transfer, get_zone_dashboard
--
-- 롤백: snapshot 마이그 (작업 시작 전 outbox/ 저장)
-- 라이브 영향: 0 (함수 객체 ms 단위 lock — 실행 중 호출은 기존 plan 완주)

-- ─────────────────────────────────────────────────────────────────
-- 1. suspend_member
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.suspend_member(
  p_member_id UUID, p_reason_category TEXT, p_reason_memo TEXT DEFAULT NULL
)
RETURNS public.members
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $fn_083_susp$
DECLARE v_member public.members;
BEGIN
  PERFORM public.assert_admin_with_audit('suspend_member', 'member',
    jsonb_build_object('member_id', p_member_id, 'reason_category', p_reason_category));
  IF p_reason_category NOT IN ('member_request','long_inactive','abuse','duplicate','other') THEN
    RAISE EXCEPTION 'INVALID_REASON';
  END IF;
  IF p_reason_category = 'other' AND (p_reason_memo IS NULL OR LENGTH(TRIM(p_reason_memo)) = 0) THEN
    RAISE EXCEPTION 'MEMO_REQUIRED_FOR_OTHER';
  END IF;
  UPDATE public.members
  SET status='suspended', suspended_at=NOW(),
      suspended_reason=p_reason_category || COALESCE(' | ' || p_reason_memo, ''),
      suspended_by=auth.uid(), updated_at=NOW()
  WHERE id=p_member_id AND status IN ('approved','pending')
  RETURNING * INTO v_member;
  IF v_member.id IS NULL THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND_OR_INVALID_STATE'; END IF;
  UPDATE public.bbq_reservations SET status='cancelled', updated_at=NOW(), cancelled_at=NOW()
  WHERE member_id=p_member_id AND status='confirmed' AND reservation_date >= CURRENT_DATE;
  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  VALUES (auth.uid(), 'suspend_member', 'member', p_member_id,
    jsonb_build_object('reason_category', p_reason_category,
      'memo_hash', encode(digest(COALESCE(p_reason_memo,''),'sha256'),'hex')));
  RETURN v_member;
END $fn_083_susp$;

-- ─────────────────────────────────────────────────────────────────
-- 2. unsuspend_member
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unsuspend_member(p_member_id UUID)
RETURNS public.members
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn_083_unsusp$
DECLARE v_member public.members;
BEGIN
  PERFORM public.assert_admin_with_audit('unsuspend_member', 'member',
    jsonb_build_object('member_id', p_member_id));
  UPDATE public.members
  SET status='approved', suspended_at=NULL, suspended_reason=NULL, suspended_by=NULL, updated_at=NOW()
  WHERE id=p_member_id AND status='suspended'
  RETURNING * INTO v_member;
  IF v_member.id IS NULL THEN RAISE EXCEPTION 'MEMBER_NOT_SUSPENDED'; END IF;
  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  VALUES (auth.uid(), 'unsuspend_member', 'member', p_member_id, '{}'::jsonb);
  RETURN v_member;
END $fn_083_unsusp$;

-- ─────────────────────────────────────────────────────────────────
-- 3. request_member_deletion
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_member_deletion(
  p_member_id UUID, p_reason_category TEXT, p_reason_memo TEXT DEFAULT NULL
)
RETURNS public.members
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $fn_083_reqdel$
DECLARE v_member public.members;
BEGIN
  PERFORM public.assert_admin_with_audit('request_member_deletion', 'member',
    jsonb_build_object('member_id', p_member_id, 'reason_category', p_reason_category));
  IF p_reason_category NOT IN ('member_request','long_inactive','abuse','duplicate','other') THEN
    RAISE EXCEPTION 'INVALID_REASON';
  END IF;
  IF p_reason_category = 'other' AND (p_reason_memo IS NULL OR LENGTH(TRIM(p_reason_memo)) = 0) THEN
    RAISE EXCEPTION 'MEMO_REQUIRED_FOR_OTHER';
  END IF;
  UPDATE public.members
  SET status='pending_deletion', deletion_requested_at=NOW(),
      deletion_reason=p_reason_category || COALESCE(' | ' || p_reason_memo, ''),
      deletion_requested_by=auth.uid(), updated_at=NOW()
  WHERE id=p_member_id AND status IN ('approved','suspended','pending')
  RETURNING * INTO v_member;
  IF v_member.id IS NULL THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND_OR_ALREADY_DELETION'; END IF;
  UPDATE public.bbq_reservations SET status='cancelled', updated_at=NOW(), cancelled_at=NOW()
  WHERE member_id=p_member_id AND status='confirmed' AND reservation_date >= CURRENT_DATE;
  UPDATE public.memberships SET status='cancelled', updated_at=NOW()
  WHERE member_id=p_member_id AND status='active';
  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  VALUES (auth.uid(), 'request_member_deletion', 'member', p_member_id,
    jsonb_build_object('reason_category', p_reason_category,
      'memo_hash', encode(digest(COALESCE(p_reason_memo,''),'sha256'),'hex'),
      'grace_until', (NOW() + INTERVAL '30 days')::text));
  RETURN v_member;
END $fn_083_reqdel$;

-- ─────────────────────────────────────────────────────────────────
-- 4. restore_member_deletion
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.restore_member_deletion(p_member_id UUID)
RETURNS public.members
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn_083_restore$
DECLARE
  v_member public.members;
  v_restored_count INT;
BEGIN
  PERFORM public.assert_admin_with_audit('restore_member_deletion', 'member',
    jsonb_build_object('member_id', p_member_id));
  UPDATE public.members
  SET status='approved', deletion_requested_at=NULL, deletion_reason=NULL,
      deletion_requested_by=NULL, updated_at=NOW()
  WHERE id=p_member_id AND status='pending_deletion'
    AND deletion_requested_at > NOW() - INTERVAL '30 days'
  RETURNING * INTO v_member;
  IF v_member.id IS NULL THEN RAISE EXCEPTION 'NOT_RESTORABLE'; END IF;

  WITH restored AS (
    UPDATE public.memberships m
    SET status='active', updated_at=NOW()
    WHERE m.member_id = p_member_id
      AND m.status = 'cancelled'
      AND NOT EXISTS (
        SELECT 1 FROM public.memberships m2
        WHERE m2.farm_id = m.farm_id AND m2.status = 'active' AND m2.id != m.id
      )
      AND m.end_date >= CURRENT_DATE
    RETURNING m.id
  )
  SELECT COUNT(*) INTO v_restored_count FROM restored;

  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  VALUES (auth.uid(), 'restore_member_deletion', 'member', p_member_id,
    jsonb_build_object('restored_memberships', v_restored_count));
  RETURN v_member;
END $fn_083_restore$;

-- ─────────────────────────────────────────────────────────────────
-- 5. change_membership_zone
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.change_membership_zone(
  p_membership_id UUID, p_new_farm_id UUID, p_reason_category TEXT,
  p_reason_memo TEXT DEFAULT NULL, p_price_diff_krw INT DEFAULT 0,
  p_settlement_note TEXT DEFAULT NULL, p_override BOOLEAN DEFAULT FALSE
)
RETURNS public.membership_zone_history
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn_083_chzone$
DECLARE
  v_admin_id UUID; v_m public.memberships; v_new_farm public.farms; v_new_zone public.farm_zones;
  v_old_farm public.farms; v_conflict public.memberships; v_history public.membership_zone_history;
BEGIN
  PERFORM public.assert_admin_with_audit('change_membership_zone', 'membership',
    jsonb_build_object('membership_id', p_membership_id, 'new_farm_id', p_new_farm_id,
      'reason_category', p_reason_category));
  v_admin_id := auth.uid();
  IF p_reason_category NOT IN ('member_request','facility_issue','operational','maintenance','other') THEN
    RAISE EXCEPTION 'INVALID_REASON';
  END IF;
  SELECT * INTO v_m FROM public.memberships WHERE id=p_membership_id FOR UPDATE;
  IF v_m.id IS NULL THEN RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND'; END IF;
  IF v_m.status != 'active' THEN RAISE EXCEPTION 'MEMBERSHIP_NOT_ACTIVE'; END IF;
  IF v_m.farm_id = p_new_farm_id THEN RAISE EXCEPTION 'SAME_FARM'; END IF;
  SELECT * INTO v_new_farm FROM public.farms WHERE id=p_new_farm_id;
  IF v_new_farm.id IS NULL THEN RAISE EXCEPTION 'FARM_NOT_FOUND'; END IF;
  SELECT * INTO v_new_zone FROM public.farm_zones WHERE id=v_new_farm.zone_id;
  IF v_new_zone.is_operational IS NOT TRUE THEN RAISE EXCEPTION 'ZONE_NOT_OPERATIONAL'; END IF;
  IF v_m.farm_id IS NOT NULL THEN
    SELECT * INTO v_old_farm FROM public.farms WHERE id=v_m.farm_id;
  END IF;
  SELECT * INTO v_conflict FROM public.memberships
  WHERE farm_id=p_new_farm_id AND status='active' AND id != p_membership_id
  FOR UPDATE LIMIT 1;
  IF v_conflict.id IS NOT NULL THEN
    IF NOT p_override THEN RAISE EXCEPTION 'FARM_ALREADY_TAKEN: % (override=true 사용)', v_conflict.id; END IF;
    UPDATE public.memberships SET status='expired', updated_at=NOW() WHERE id=v_conflict.id;
    INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
    VALUES (v_admin_id, 'zone_change_override_expired', 'membership', v_conflict.id,
      jsonb_build_object('caused_by_membership_id', p_membership_id, 'farm_id', p_new_farm_id));
  END IF;
  INSERT INTO public.membership_zone_history (
    membership_id, member_id, from_farm_id, from_zone_id, from_farm_number,
    to_farm_id, to_zone_id, to_farm_number, reason_category, reason_memo,
    price_diff_krw, settlement_note, overrode_existing, overridden_membership_id, changed_by
  ) VALUES (
    v_m.id, v_m.member_id, v_m.farm_id, COALESCE(v_old_farm.zone_id,NULL), COALESCE(v_old_farm.number,NULL),
    v_new_farm.id, v_new_farm.zone_id, v_new_farm.number, p_reason_category, p_reason_memo,
    p_price_diff_krw, p_settlement_note, (v_conflict.id IS NOT NULL), v_conflict.id, v_admin_id
  ) RETURNING * INTO v_history;
  UPDATE public.memberships SET farm_id=p_new_farm_id, updated_at=NOW() WHERE id=p_membership_id;
  UPDATE public.farm_rentals SET farm_id=p_new_farm_id, updated_at=NOW()
  WHERE member_id=v_m.member_id AND status='active';
  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  VALUES (v_admin_id, 'change_membership_zone', 'membership', p_membership_id,
    jsonb_build_object('history_id', v_history.id,
      'from_farm_number', v_history.from_farm_number, 'to_farm_number', v_history.to_farm_number,
      'reason_category', p_reason_category, 'price_diff_krw', p_price_diff_krw,
      'overrode_existing', v_history.overrode_existing));
  RETURN v_history;
END $fn_083_chzone$;

-- ─────────────────────────────────────────────────────────────────
-- 6. toggle_notice_pin
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.toggle_notice_pin(p_notice_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $fn_083_pin$
DECLARE
  v_current INT; v_max INT;
BEGIN
  PERFORM public.assert_admin_with_audit('toggle_notice_pin', 'notice',
    jsonb_build_object('notice_id', p_notice_id));

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
    UPDATE public.notices SET pin_order = NULL, updated_at = now() WHERE id = p_notice_id;
    UPDATE public.notices SET pin_order = -(pin_order + 1000), updated_at = now() WHERE pin_order > v_current;
    UPDATE public.notices SET pin_order = -pin_order - 1000 - 1, updated_at = now() WHERE pin_order < 0;
    RETURN NULL;
  END IF;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'pin_unique_conflict: %', SQLERRM USING ERRCODE = 'P0001';
  WHEN OTHERS THEN
    RAISE;  -- assert_admin_with_audit 의 PERMISSION_DENIED 등은 그대로 전파
END
$fn_083_pin$;

-- ─────────────────────────────────────────────────────────────────
-- 7. ack_trigger_error_log
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ack_trigger_error_log(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn_083_ackone$
DECLARE v_uid UUID := auth.uid();
BEGIN
  PERFORM public.assert_admin_with_audit('ack_trigger_error_log', 'trigger_error_log',
    jsonb_build_object('id', p_id));
  UPDATE public.trigger_error_logs
  SET acked_at = NOW(), acked_by = v_uid
  WHERE id = p_id AND acked_at IS NULL;
END $fn_083_ackone$;

-- ─────────────────────────────────────────────────────────────────
-- 8. ack_all_trigger_error_logs
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ack_all_trigger_error_logs()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn_083_ackall$
DECLARE
  v_uid UUID := auth.uid();
  v_count INT;
BEGIN
  PERFORM public.assert_admin_with_audit('ack_all_trigger_error_logs', 'trigger_error_log', '{}'::jsonb);
  UPDATE public.trigger_error_logs
  SET acked_at = NOW(), acked_by = v_uid
  WHERE acked_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $fn_083_ackall$;

-- ─────────────────────────────────────────────────────────────────
-- 9. get_unacked_error_count
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_unacked_error_count()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn_083_uncount$
BEGIN
  PERFORM public.assert_admin_with_audit('get_unacked_error_count', 'trigger_error_log', '{}'::jsonb);
  RETURN (SELECT COUNT(*)::INT FROM public.trigger_error_logs WHERE acked_at IS NULL);
END $fn_083_uncount$;

-- ─────────────────────────────────────────────────────────────────
-- 10. trigger_error_monthly_summary
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_error_monthly_summary()
RETURNS TABLE(month DATE, total_count BIGINT, unacked_count BIGINT, top_function TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn_083_summary$
BEGIN
  PERFORM public.assert_admin_with_audit('trigger_error_monthly_summary', 'trigger_error_log', '{}'::jsonb);
  RETURN QUERY
  WITH base AS (
    SELECT
      DATE_TRUNC('month', created_at AT TIME ZONE 'Asia/Seoul')::DATE AS m,
      function_name, acked_at
    FROM public.trigger_error_logs
    WHERE created_at >=
      (DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Seoul') - INTERVAL '5 months') AT TIME ZONE 'Asia/Seoul'
  ),
  monthly AS (
    SELECT m, function_name,
           COUNT(*) AS n,
           COUNT(*) FILTER (WHERE acked_at IS NULL) AS n_unacked
    FROM base GROUP BY m, function_name
  ),
  ranked AS (
    SELECT m, function_name, n, n_unacked,
           SUM(n) OVER (PARTITION BY m)::BIGINT AS total_n,
           SUM(n_unacked) OVER (PARTITION BY m)::BIGINT AS total_un,
           ROW_NUMBER() OVER (PARTITION BY m ORDER BY n DESC) AS rn
    FROM monthly
  )
  SELECT r.m, r.total_n, r.total_un, r.function_name
  FROM ranked r WHERE r.rn = 1
  ORDER BY r.m DESC;
END $fn_083_summary$;

-- ─────────────────────────────────────────────────────────────────
-- COMMENT
-- ─────────────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.suspend_member(UUID, TEXT, TEXT) IS '083: admin check unified to assert_admin_with_audit helper (PIPA audit)';
COMMENT ON FUNCTION public.unsuspend_member(UUID) IS '083: admin check unified';
COMMENT ON FUNCTION public.request_member_deletion(UUID, TEXT, TEXT) IS '083: admin check unified';
COMMENT ON FUNCTION public.restore_member_deletion(UUID) IS '083: admin check unified';
COMMENT ON FUNCTION public.change_membership_zone(UUID, UUID, TEXT, TEXT, INT, TEXT, BOOLEAN) IS '083: admin check unified';
COMMENT ON FUNCTION public.toggle_notice_pin(UUID) IS '083: admin check unified';
COMMENT ON FUNCTION public.ack_trigger_error_log(UUID) IS '083: admin check unified';
COMMENT ON FUNCTION public.ack_all_trigger_error_logs() IS '083: admin check unified';
COMMENT ON FUNCTION public.get_unacked_error_count() IS '083: admin check unified';
COMMENT ON FUNCTION public.trigger_error_monthly_summary() IS '083: admin check unified';
