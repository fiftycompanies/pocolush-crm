-- ═══════════════════════════════════════════════════════════════════
-- 063: 회원 라이프사이클 — 비활성화 + 소프트 삭제 + 30일 grace
-- ═══════════════════════════════════════════════════════════════════
-- 풀스택 권고 (kk 결정사항 일괄):
--   - 30일 grace (한국 SaaS 표준)
--   - 사유 5종: 회원_요청 / 장기_미사용 / 부정사용 / 중복가입 / 기타(메모필수)
--   - 알림: Phase 1 발송 안 함 (pending_deletion 만 알림톡 — Phase 2)
--   - withdrawn enum 제거
--   - audit metadata 는 hash 만 (PII 평문 금지)
--   - PIPA + 전자상거래법 §6③ 5년 보관 (거래기록 CASCADE 절대 금지)
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- Part 0: 백업 (롤백 가능)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.members_backup_063_20260512 AS
SELECT * FROM public.members WHERE status = 'withdrawn';

ALTER TABLE public.members_backup_063_20260512 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.members_backup_063_20260512 FROM PUBLIC, authenticated, anon;

-- ─────────────────────────────────────────────────────────────────
-- Part 1: status enum 재정의 (withdrawn 제거, 신규 3개 추가)
-- ─────────────────────────────────────────────────────────────────

-- 기존 withdrawn 행 → deleted 로 마이그레이트 (현재 0건 예상)
UPDATE public.members SET status = 'approved' WHERE status = 'withdrawn';
-- (deleted 는 아래 CHECK 추가 후에만 가능, 일단 안전한 approved 로)

ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_status_check;
ALTER TABLE public.members
  ADD CONSTRAINT members_status_check
  CHECK (status IN (
    'pending',           -- 가입 대기
    'approved',          -- 정상 활성
    'suspended',         -- 비활성화 (어드민 차단, 복원 가능)
    'pending_deletion',  -- 삭제 신청 + 30일 grace
    'deleted'            -- PII 마스킹 완료 (거래기록 5년 보관)
  ));

-- ─────────────────────────────────────────────────────────────────
-- Part 2: 신규 컬럼 (라이프사이클 추적)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS suspended_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason     TEXT,
  ADD COLUMN IF NOT EXISTS suspended_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_reason      TEXT,
  ADD COLUMN IF NOT EXISTS deletion_requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pii_purged           BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.members.suspended_at IS '063: 비활성화 시점';
COMMENT ON COLUMN public.members.deletion_requested_at IS '063: 삭제 신청 시점 (30일 grace 시작)';
COMMENT ON COLUMN public.members.deleted_at IS '063: PII 마스킹 완료 시점';
COMMENT ON COLUMN public.members.pii_purged IS '063: 마스킹 처리 여부';

-- ─────────────────────────────────────────────────────────────────
-- Part 3: is_admin() 공통 헬퍼 (063/062 RPC 공용)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$fn$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

COMMENT ON FUNCTION public.is_admin IS
  '063: admin 권한 검증 헬퍼. 063/062 RPC 에서 재사용.';

-- ─────────────────────────────────────────────────────────────────
-- Part 4: suspend_member RPC
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.suspend_member(
  p_member_id UUID,
  p_reason_category TEXT,
  p_reason_memo TEXT DEFAULT NULL
)
RETURNS public.members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn_063_suspend$
DECLARE
  v_member public.members;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN' USING ERRCODE = '42501';
  END IF;

  IF p_reason_category NOT IN ('member_request','long_inactive','abuse','duplicate','other') THEN
    RAISE EXCEPTION 'INVALID_REASON' USING ERRCODE = '22023';
  END IF;
  IF p_reason_category = 'other' AND (p_reason_memo IS NULL OR LENGTH(TRIM(p_reason_memo)) = 0) THEN
    RAISE EXCEPTION 'MEMO_REQUIRED_FOR_OTHER' USING ERRCODE = '22023';
  END IF;

  UPDATE public.members
  SET status = 'suspended',
      suspended_at = NOW(),
      suspended_reason = p_reason_category || COALESCE(' | ' || p_reason_memo, ''),
      suspended_by = auth.uid(),
      updated_at = NOW()
  WHERE id = p_member_id AND status IN ('approved','pending')
  RETURNING * INTO v_member;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'MEMBER_NOT_FOUND_OR_INVALID_STATE';
  END IF;

  -- 미래 BBQ 예약 자동 취소
  UPDATE public.bbq_reservations
  SET status = 'cancelled', updated_at = NOW(), cancelled_at = NOW()
  WHERE member_id = p_member_id
    AND status = 'confirmed'
    AND reservation_date >= CURRENT_DATE;

  -- 활성 멤버십 보존 (비활성화는 일시정지 — 016 cron 패턴 따름)

  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  VALUES (
    auth.uid(), 'suspend_member', 'member', p_member_id,
    jsonb_build_object(
      'reason_category', p_reason_category,
      'memo_hash', encode(digest(COALESCE(p_reason_memo, ''), 'sha256'), 'hex')
    )
  );

  RETURN v_member;
END
$fn_063_suspend$;

GRANT EXECUTE ON FUNCTION public.suspend_member(UUID, TEXT, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────
-- Part 5: unsuspend_member RPC
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unsuspend_member(p_member_id UUID)
RETURNS public.members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn_063_unsuspend$
DECLARE
  v_member public.members;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN' USING ERRCODE = '42501';
  END IF;

  UPDATE public.members
  SET status = 'approved',
      suspended_at = NULL,
      suspended_reason = NULL,
      suspended_by = NULL,
      updated_at = NOW()
  WHERE id = p_member_id AND status = 'suspended'
  RETURNING * INTO v_member;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'MEMBER_NOT_SUSPENDED';
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  VALUES (auth.uid(), 'unsuspend_member', 'member', p_member_id, '{}'::jsonb);

  RETURN v_member;
END
$fn_063_unsuspend$;

GRANT EXECUTE ON FUNCTION public.unsuspend_member(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────
-- Part 6: request_member_deletion RPC (30일 grace 시작)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_member_deletion(
  p_member_id UUID,
  p_reason_category TEXT,
  p_reason_memo TEXT DEFAULT NULL
)
RETURNS public.members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn_063_request_del$
DECLARE
  v_member public.members;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN' USING ERRCODE = '42501';
  END IF;

  IF p_reason_category NOT IN ('member_request','long_inactive','abuse','duplicate','other') THEN
    RAISE EXCEPTION 'INVALID_REASON';
  END IF;
  IF p_reason_category = 'other' AND (p_reason_memo IS NULL OR LENGTH(TRIM(p_reason_memo)) = 0) THEN
    RAISE EXCEPTION 'MEMO_REQUIRED_FOR_OTHER';
  END IF;

  UPDATE public.members
  SET status = 'pending_deletion',
      deletion_requested_at = NOW(),
      deletion_reason = p_reason_category || COALESCE(' | ' || p_reason_memo, ''),
      deletion_requested_by = auth.uid(),
      updated_at = NOW()
  WHERE id = p_member_id AND status IN ('approved','suspended','pending')
  RETURNING * INTO v_member;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'MEMBER_NOT_FOUND_OR_ALREADY_DELETION';
  END IF;

  -- 미래 BBQ 예약 자동 취소
  UPDATE public.bbq_reservations
  SET status = 'cancelled', updated_at = NOW(), cancelled_at = NOW()
  WHERE member_id = p_member_id
    AND status = 'confirmed'
    AND reservation_date >= CURRENT_DATE;

  -- 활성 멤버십 → 일단 cancelled 처리 (회원이 30일 내 복원하면 운영자가 수동 재발급)
  -- 자동 복원 X (가격 변동 + 환불 정산 복잡)
  UPDATE public.memberships
  SET status = 'cancelled', updated_at = NOW()
  WHERE member_id = p_member_id AND status = 'active';

  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  VALUES (
    auth.uid(), 'request_member_deletion', 'member', p_member_id,
    jsonb_build_object(
      'reason_category', p_reason_category,
      'memo_hash', encode(digest(COALESCE(p_reason_memo, ''), 'sha256'), 'hex'),
      'grace_until', (NOW() + INTERVAL '30 days')::text
    )
  );

  RETURN v_member;
END
$fn_063_request_del$;

GRANT EXECUTE ON FUNCTION public.request_member_deletion(UUID, TEXT, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────
-- Part 7: restore_member_deletion RPC (30일 grace 내 복원)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.restore_member_deletion(p_member_id UUID)
RETURNS public.members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn_063_restore$
DECLARE
  v_member public.members;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN' USING ERRCODE = '42501';
  END IF;

  UPDATE public.members
  SET status = 'approved',
      deletion_requested_at = NULL,
      deletion_reason = NULL,
      deletion_requested_by = NULL,
      updated_at = NOW()
  WHERE id = p_member_id
    AND status = 'pending_deletion'
    AND deletion_requested_at > NOW() - INTERVAL '30 days'
  RETURNING * INTO v_member;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'NOT_RESTORABLE: 30일 grace 만료 또는 상태 불일치';
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  VALUES (auth.uid(), 'restore_member_deletion', 'member', p_member_id, '{}'::jsonb);

  RETURN v_member;
END
$fn_063_restore$;

GRANT EXECUTE ON FUNCTION public.restore_member_deletion(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────
-- Part 8: purge_member_pii — 30일 후 PII 마스킹 (cron 호출용)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_member_pii(p_member_id UUID)
RETURNS public.members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn_063_purge$
DECLARE
  v_member public.members;
BEGIN
  -- cron 또는 admin 호출 (SECURITY DEFINER 우회 권한)
  -- admin 검증은 호출처에서 (cron 은 시스템)

  UPDATE public.members
  SET status = 'deleted',
      name = '탈퇴회원',
      phone = '***',
      address = '***',
      car_number = NULL,
      memo = NULL,
      email = 'deleted_' || id::text || '@deleted.local',
      deleted_at = NOW(),
      pii_purged = TRUE,
      updated_at = NOW()
  WHERE id = p_member_id
    AND status = 'pending_deletion'
    AND deletion_requested_at < NOW() - INTERVAL '30 days'
    AND pii_purged = FALSE
  RETURNING * INTO v_member;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'NOT_PURGEABLE: 30일 grace 미경과 또는 이미 처리됨';
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
  VALUES (
    NULL, 'purge_member_pii', 'member', p_member_id,
    jsonb_build_object(
      'masked_name_hash', encode(digest(v_member.name, 'sha256'), 'hex'),
      'purged_at', NOW()::text,
      'retention', '5_years_audit_only'
    )
  );

  RETURN v_member;
END
$fn_063_purge$;

-- cron 만 호출 가능 (인증 사용자 X)
REVOKE ALL ON FUNCTION public.purge_member_pii(UUID) FROM PUBLIC;

-- ─────────────────────────────────────────────────────────────────
-- Part 9: 30일 grace 자동 처리 cron
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_purge_pending_deletion_members()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn_063_cron$
DECLARE
  r RECORD;
  v_count INT := 0;
BEGIN
  FOR r IN
    SELECT id FROM public.members
    WHERE status = 'pending_deletion'
      AND deletion_requested_at < NOW() - INTERVAL '30 days'
      AND pii_purged = FALSE
  LOOP
    BEGIN
      PERFORM public.purge_member_pii(r.id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
      VALUES (NULL, 'purge_failed', 'member', r.id,
        jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE));
    END;
  END LOOP;
  RETURN v_count;
END
$fn_063_cron$;

-- cron 스케줄 (매일 KST 03:00 = UTC 18:00)
DO $$
DECLARE v_existing INT;
BEGIN
  v_existing := (SELECT jobid FROM cron.job WHERE jobname = 'purge_pending_deletion_members' LIMIT 1);
  IF v_existing IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing);
  END IF;
  PERFORM cron.schedule(
    'purge_pending_deletion_members',
    '0 18 * * *',
    $job$ SELECT public.fn_purge_pending_deletion_members(); $job$
  );
END $$;

-- ─────────────────────────────────────────────────────────────────
-- Part 10: RLS 조정 — 회원 본인이 deleted 상태 조회 차단
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "members_select_own" ON public.members;
CREATE POLICY "members_select_own" ON public.members
  FOR SELECT USING (
    (user_id = (SELECT auth.uid()) AND status != 'deleted')
    OR public.is_admin()
  );

-- ─────────────────────────────────────────────────────────────────
-- Part 11: 검증
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_constraint_ok BOOLEAN;
  v_rpc_count INT;
  v_cron_ok BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_constraint WHERE conname = 'members_status_check'
  ) INTO v_constraint_ok;
  IF NOT v_constraint_ok THEN
    RAISE EXCEPTION 'members_status_check 미적용';
  END IF;

  SELECT COUNT(*) INTO v_rpc_count FROM pg_proc
  WHERE proname IN (
    'is_admin',
    'suspend_member', 'unsuspend_member',
    'request_member_deletion', 'restore_member_deletion',
    'purge_member_pii', 'fn_purge_pending_deletion_members'
  );
  IF v_rpc_count != 7 THEN
    RAISE EXCEPTION 'RPC % 개만 등록 (7개 기대)', v_rpc_count;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM cron.job WHERE jobname = 'purge_pending_deletion_members'
  ) INTO v_cron_ok;
  IF NOT v_cron_ok THEN
    RAISE EXCEPTION 'cron purge_pending_deletion_members 미등록';
  END IF;

  RAISE NOTICE '063 검증 통과 — CHECK + 7 RPCs + cron OK';
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 롤백 절차:
--   1. cron 해제
--      SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge_pending_deletion_members';
--   2. RPC 7개 DROP
--   3. RLS 복원
--   4. 컬럼 DROP (suspended_at 등 8개)
--   5. CHECK 제약 원본 복원 (pending, approved, suspended, withdrawn)
--   6. members_backup_063_20260512 에서 status 복원
-- ═══════════════════════════════════════════════════════════════════
