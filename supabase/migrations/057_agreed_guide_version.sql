-- ═══════════════════════════════════════════════════════════════════
-- 057: members.agreed_guide_version + audit_logs 트리거
-- ═══════════════════════════════════════════════════════════════════
-- 배경: PIPA §22① 별도 동의 원칙 — 자람터 이용가이드 동의 버전 관리
-- Phase 0.5 hot-track / D2 = A (체크박스 2개 분리)
--
-- BLOCKER 해결:
--   P0-057-1 (Backend): legacy agreed=true 소급 제거 — privacy 만 기존 agreed_at 공유,
--                        guide 는 반드시 명시 플래그
--   BL-2 (QA): agreed_at 관계 명시 — 컬럼 용도 주석으로 구분
--   BL-6 (QA): AFTER INSERT EXCEPTION swallow — Auth confirmation 메일 side effect 방지
--   P0-3 (Security): audit_logs 5년 보관 의무 (전자상거래법 §6 ③)
-- ═══════════════════════════════════════════════════════════════════

-- 1. 컬럼 추가 (DEFAULT NULL)
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS agreed_guide_version TEXT;

COMMENT ON COLUMN public.members.agreed_guide_version IS
  'PIPA §22① 별도 동의 — 자람터 이용가이드 동의 버전 (예: v2026).
   신규 가입자만 기록, 기존 회원 backfill 없음 (D-K6 = 불필요 확정).
   어드민 직접 생성(AddMemberModal) 시 NULL 허용 (고객 자발 동의 행위 없음).
   BL-2: 기존 agreed_at 은 회원가입 최초 전체동의 timestamp, 본 컬럼은 가이드 버전 텍스트.';

-- 2. 감사 로그 트리거 (P0-3 Security)
CREATE OR REPLACE FUNCTION public.fn_members_agreed_guide_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn_057_audit$
BEGIN
  -- 가이드 버전 첫 기록 or 변경 감지
  IF NEW.agreed_guide_version IS NOT NULL
     AND (OLD IS NULL
          OR OLD.agreed_guide_version IS NULL
          OR OLD.agreed_guide_version IS DISTINCT FROM NEW.agreed_guide_version)
  THEN
    BEGIN
      INSERT INTO public.audit_logs (
        actor_id, action, resource_type, resource_id, metadata
      )
      VALUES (
        NEW.id,
        'agreed_guide',
        'member',
        NEW.id,
        jsonb_build_object(
          'guide_version', NEW.agreed_guide_version,
          'agreed_at', NOW(),
          'prev_version', CASE WHEN OLD IS NULL THEN NULL ELSE OLD.agreed_guide_version END
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- BL-6: audit INSERT 실패 시 members INSERT 연쇄 롤백 방지
      --       Supabase Auth confirmation 메일 side effect 차단
      RAISE WARNING 'fn_members_agreed_guide_audit: audit INSERT 실패 — %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END
$fn_057_audit$;

-- 기존 트리거 제거 후 재등록 (003 미설치 staging 방어)
DROP TRIGGER IF EXISTS trg_members_agreed_guide_audit ON public.members;
CREATE TRIGGER trg_members_agreed_guide_audit
  AFTER INSERT OR UPDATE OF agreed_guide_version ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_members_agreed_guide_audit();

-- ═══════════════════════════════════════════════════════════════════
-- 검증 쿼리:
--   SELECT column_name, data_type FROM information_schema.columns
--     WHERE table_schema = 'public' AND table_name = 'members'
--       AND column_name = 'agreed_guide_version';
--
--   -- 테스트: UPDATE public.members SET agreed_guide_version = 'v2026'
--            WHERE id = '<test-uuid>';
--   -- audit_logs 확인: SELECT * FROM public.audit_logs
--                       WHERE action = 'agreed_guide' ORDER BY created_at DESC LIMIT 5;
-- ═══════════════════════════════════════════════════════════════════
