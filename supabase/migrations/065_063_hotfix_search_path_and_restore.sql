-- ═══════════════════════════════════════════════════════════════════
-- 065: 063 hotfix — search_path + restore_member_deletion 멤버십 자동 복원
-- ═══════════════════════════════════════════════════════════════════
-- E2E 검증에서 발견된 BLOCKER + HIGH 핫픽스:
--
-- 1) BLOCKER: SECURITY DEFINER + SET search_path = '' 함수가 digest() 호출 실패
--    → search_path = public, extensions (따옴표 없이 콤마 구분)
--    영향 RPC: suspend_member, request_member_deletion, purge_member_pii
--
-- 2) HIGH: restore_member_deletion 이 회원만 approved 로 복원, 멤버십은 cancelled 유지
--    → BBQ 예약 등 불가 → UX 부담
--    해결: cancelled 멤버십 자동 active 복원 (UNIQUE 위반 회피 + end_date 유효 검증)
--
-- prod 적용 완료 (Supabase MCP) — 이 파일은 main 동기화용 SQL 기록.
-- ═══════════════════════════════════════════════════════════════════

-- 1) suspend_member
CREATE OR REPLACE FUNCTION public.suspend_member(p_member_id UUID, p_reason_category TEXT, p_reason_memo TEXT DEFAULT NULL)
RETURNS public.members LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $fn$
DECLARE v_member public.members;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'NOT_ADMIN' USING ERRCODE='42501'; END IF;
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
END $fn$;

-- 2) request_member_deletion
CREATE OR REPLACE FUNCTION public.request_member_deletion(p_member_id UUID, p_reason_category TEXT, p_reason_memo TEXT DEFAULT NULL)
RETURNS public.members LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $fn$
DECLARE v_member public.members;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'NOT_ADMIN' USING ERRCODE='42501'; END IF;
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
END $fn$;

-- 3) restore_member_deletion — 멤버십 자동 복원 추가 (HIGH H2)
CREATE OR REPLACE FUNCTION public.restore_member_deletion(p_member_id UUID)
RETURNS public.members LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $fn$
DECLARE
  v_member public.members;
  v_restored_count INT;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'NOT_ADMIN' USING ERRCODE='42501'; END IF;
  UPDATE public.members
  SET status='approved', deletion_requested_at=NULL, deletion_reason=NULL,
      deletion_requested_by=NULL, updated_at=NOW()
  WHERE id=p_member_id AND status='pending_deletion'
    AND deletion_requested_at > NOW() - INTERVAL '30 days'
  RETURNING * INTO v_member;
  IF v_member.id IS NULL THEN RAISE EXCEPTION 'NOT_RESTORABLE'; END IF;

  -- cancelled 멤버십 자동 active 복원
  --   UNIQUE 제약(062-a) 위반 방지: 같은 farm 에 다른 active 멤버십이 없을 때만
  --   기간 유효 검증: end_date >= CURRENT_DATE
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
END $fn$;

-- 4) purge_member_pii
CREATE OR REPLACE FUNCTION public.purge_member_pii(p_member_id UUID)
RETURNS public.members LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $fn$
DECLARE v_member public.members; v_orig_name TEXT;
BEGIN
  SELECT name INTO v_orig_name FROM public.members WHERE id=p_member_id;
  UPDATE public.members
  SET status='deleted', name='탈퇴회원', phone='***', address='***',
      car_number=NULL, memo=NULL,
      email='deleted_' || id::text || '@deleted.local',
      deleted_at=NOW(), pii_purged=TRUE, updated_at=NOW()
  WHERE id=p_member_id AND status='pending_deletion'
    AND deletion_requested_at < NOW() - INTERVAL '30 days'
    AND pii_purged=FALSE
  RETURNING * INTO v_member;
  IF v_member.id IS NULL THEN RAISE EXCEPTION 'NOT_PURGEABLE'; END IF;
  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  VALUES (NULL, 'purge_member_pii', 'member', p_member_id,
    jsonb_build_object('masked_name_hash', encode(digest(v_orig_name,'sha256'),'hex'),
      'purged_at', NOW()::text, 'retention', '5_years_audit_only'));
  RETURN v_member;
END $fn$;

-- 5) 064 dashboard count fix (LEFT JOIN inflation)
CREATE OR REPLACE FUNCTION public.get_zone_dashboard()
RETURNS TABLE (zone_id UUID, zone_name TEXT, total_farms INT, occupied INT, available INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH farm_stats AS (
    SELECT f.zone_id, f.id AS farm_id,
      EXISTS (SELECT 1 FROM public.memberships m WHERE m.farm_id = f.id AND m.status = 'active') AS is_occupied
    FROM public.farms f
    WHERE f.deleted_at IS NULL
  )
  SELECT z.id, z.name,
    COALESCE((SELECT COUNT(*) FROM farm_stats fs WHERE fs.zone_id = z.id), 0)::INT,
    COALESCE((SELECT COUNT(*) FROM farm_stats fs WHERE fs.zone_id = z.id AND fs.is_occupied), 0)::INT,
    COALESCE((SELECT COUNT(*) FROM farm_stats fs WHERE fs.zone_id = z.id AND NOT fs.is_occupied), 0)::INT
  FROM public.farm_zones z
  WHERE z.is_active = TRUE AND z.is_operational = TRUE
  ORDER BY z.name;
$$;
GRANT EXECUTE ON FUNCTION public.get_zone_dashboard() TO authenticated;
