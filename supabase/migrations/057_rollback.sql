-- 057 rollback — audit 트리거 제거
-- 주의: agreed_guide_version 컬럼은 보존 (데이터 손실 방지, 의미 없는 NULL 컬럼이므로 영향 없음)
-- 컬럼 자체를 제거하려면 수동: ALTER TABLE public.members DROP COLUMN agreed_guide_version;

DROP TRIGGER IF EXISTS trg_members_agreed_guide_audit ON public.members;
DROP FUNCTION IF EXISTS public.fn_members_agreed_guide_audit();
