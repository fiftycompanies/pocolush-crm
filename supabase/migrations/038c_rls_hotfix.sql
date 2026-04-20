-- ═══════════════════════════════════════════════════════════════════
-- 038c: RLS 핫픽스 — role='admin' 체크 누락 3개 테이블
-- ═══════════════════════════════════════════════════════════════════
-- 배경: P1-1 (thoughts/research/20260420-2200_v3.1_P0_P1_이슈_리서치.md)
-- 문제: 008_notifications, 010_member_status_logs 의 RLS 정책이
--       `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())` 만 체크
--       → profiles 레코드만 있으면 누구나 전체 접근 가능
-- 영향: notification_logs (phone/push_token 평문 노출 — PIPA 2026 위반 위험)
-- 우선순위: Phase 0 핫픽스 (5영업일 관찰 기간 동안 취약 상태 방지)
-- Supabase SQL Editor 호환: PERFORM + IF NOT EXISTS, 라벨드 달러쿼트
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────
-- 1. notification_logs
-- ───────────────────────────────────────
DROP POLICY IF EXISTS "notification_logs_admin" ON public.notification_logs;

CREATE POLICY "notification_logs_admin"
  ON public.notification_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );

-- ───────────────────────────────────────
-- 2. notification_settings
-- ───────────────────────────────────────
DROP POLICY IF EXISTS "notification_settings_admin" ON public.notification_settings;

CREATE POLICY "notification_settings_admin"
  ON public.notification_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );

-- ───────────────────────────────────────
-- 3. member_status_logs
-- ───────────────────────────────────────
DROP POLICY IF EXISTS "admin_full_access" ON public.member_status_logs;

CREATE POLICY "admin_full_access"
  ON public.member_status_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );

-- ───────────────────────────────────────
-- 4. audit_logs 기록
-- ───────────────────────────────────────
DO $fn_038c_audit$
BEGIN
  PERFORM 1 FROM public.audit_logs WHERE action = 'rls_hotfix_038c' LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.audit_logs (actor_id, action, resource_type, metadata)
    VALUES (
      NULL,
      'rls_hotfix_038c',
      'migration',
      jsonb_build_object(
        'tables', ARRAY['notification_logs', 'notification_settings', 'member_status_logs'],
        'note', 'role=admin 누락 핫픽스 — P1-1',
        'applied_at', NOW()
      )
    );
  END IF;
END
$fn_038c_audit$;

-- ═══════════════════════════════════════════════════════════════════
-- 검증 쿼리 (수동 실행):
--   SELECT polname, polqual FROM pg_policy
--   WHERE polrelid IN ('public.notification_logs'::regclass,
--                      'public.notification_settings'::regclass,
--                      'public.member_status_logs'::regclass);
-- 기대: polqual 에 "role = 'admin'" 포함됨
-- ═══════════════════════════════════════════════════════════════════
