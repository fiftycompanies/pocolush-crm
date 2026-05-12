-- ═══════════════════════════════════════════════════════════════════
-- 062-a: 중복 active 멤버십 클린업 + UNIQUE 제약 추가
-- ═══════════════════════════════════════════════════════════════════
-- 배경 (QA 검수에서 발견):
--   1 farm = 1 active 멤버십 원칙인데 11개 farm 에 중복 active 22건
--   (테스트 회원 잔존 + 운영자 잘못 등록 + farm 이동 후 기존 멤버십 미정리)
--
-- 정리 대상 (총 17건):
--   - 테스트 회원 9건 (이석형테스트 3, QA테스트회원 3, QA-운영-회원-A 1, E2E회원 1, +1)
--   - 운영자 결정 expire 6건 (허성수 A2, 안연준 A4, 김기현 A7, 박나영 A9, 백지원 A10, 배정은 A18, 김민준 A10)
--   - farm_id=NULL active 2건 (김기현 NULL, 박나영 NULL)
--
-- 결과:
--   - 모든 farm = 1 active 멤버십 보장
--   - UNIQUE INDEX 안전하게 적용 가능
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- Step 1: 테스트 회원의 active 멤버십 expired 처리 (이름 패턴 매칭)
-- ─────────────────────────────────────────────────────────────────
UPDATE public.memberships
SET status = 'expired', updated_at = NOW()
WHERE status = 'active'
  AND id IN (
    SELECT m.id FROM public.memberships m
    JOIN public.members mem ON mem.id = m.member_id
    WHERE m.status = 'active'
      AND (
        mem.name LIKE '%테스트%'
        OR mem.name LIKE '%QA%'
        OR mem.name LIKE '%E2E%'
      )
      -- 안전: 같은 farm 에 다른 회원도 active 가 있는 경우만 (혹시 테스트 회원만 있는 farm 보호)
      AND EXISTS (
        SELECT 1 FROM public.memberships m2
        WHERE m2.farm_id = m.farm_id
          AND m2.status = 'active'
          AND m2.id != m.id
      )
  );

-- ─────────────────────────────────────────────────────────────────
-- Step 2: 운영자 결정 expire (이름 + farm_number 명시)
--   허성수 A2, 안연준 A4, 김기현 A7, 박나영 A9, 백지원 A10, 김민준 A10, 배정은 A18
-- ─────────────────────────────────────────────────────────────────
UPDATE public.memberships
SET status = 'expired', updated_at = NOW()
WHERE status = 'active'
  AND id IN (
    SELECT m.id FROM public.memberships m
    JOIN public.members mem ON mem.id = m.member_id
    JOIN public.farms f ON f.id = m.farm_id
    WHERE m.status = 'active'
      AND (
        (mem.name = '허성수' AND f.number = 2)
        OR (mem.name = '안연준' AND f.number = 4)
        OR (mem.name = '김기현' AND f.number = 7)
        OR (mem.name = '박나영' AND f.number = 9)
        OR (mem.name = '백지원' AND f.number = 10)
        OR (mem.name = '김민준' AND f.number = 10)
        OR (mem.name = '배정은' AND f.number = 18)
      )
  );

-- ─────────────────────────────────────────────────────────────────
-- Step 3: farm_id=NULL active 멤버십 (김기현, 박나영) expired
--   가입 후 farm 배정 누락된 흔적 — 실제 계약은 다른 active 에 보존
-- ─────────────────────────────────────────────────────────────────
UPDATE public.memberships
SET status = 'expired', updated_at = NOW()
WHERE status = 'active'
  AND farm_id IS NULL
  AND member_id IN (
    SELECT id FROM public.members WHERE name IN ('김기현', '박나영')
  );

-- ─────────────────────────────────────────────────────────────────
-- Step 4: audit_logs 기록 (감사 추적)
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.audit_logs (
  actor_id, action, resource_type, resource_id, metadata
)
SELECT
  NULL,  -- 마이그레이션 (시스템)
  'cleanup_duplicate_active_membership',
  'membership',
  m.id,
  jsonb_build_object(
    'reason', 'migration_062a',
    'member_name', mem.name,
    'farm_number', f.number,
    'farm_id', m.farm_id,
    'old_status', 'active',
    'new_status', 'expired',
    'cleanup_at', NOW()
  )
FROM public.memberships m
JOIN public.members mem ON mem.id = m.member_id
LEFT JOIN public.farms f ON f.id = m.farm_id
WHERE m.status = 'expired'
  AND m.updated_at > NOW() - INTERVAL '1 minute';  -- 본 마이그레이션에서 변경된 것만

-- ─────────────────────────────────────────────────────────────────
-- Step 5: 검증 — 중복 active 가 0건이어야 함
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_dup_count INT;
BEGIN
  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT farm_id FROM public.memberships
    WHERE status = 'active' AND farm_id IS NOT NULL
    GROUP BY farm_id HAVING COUNT(*) > 1
  ) sub;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION '062a 클린업 후에도 % 개 farm 에 중복 active 가 남아있음. UNIQUE 적용 차단.', v_dup_count;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- Step 6: UNIQUE INDEX — 1 farm = 1 active 강제
-- ─────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_farm_membership
  ON public.memberships(farm_id)
  WHERE status = 'active' AND farm_id IS NOT NULL;

COMMENT ON INDEX public.uniq_active_farm_membership IS
  '062-a: 1 farm 당 active 멤버십 1개만 허용. 회원 1명이 N farm 점유는 허용 (member_id 중복 OK).';

-- ═══════════════════════════════════════════════════════════════════
-- 검증 SQL (적용 후):
--   -- 중복 active 0건 확인
--   SELECT farm_id, COUNT(*) FROM public.memberships
--   WHERE status='active' AND farm_id IS NOT NULL
--   GROUP BY farm_id HAVING COUNT(*) > 1;
--   -- 기대: 0 rows
--
--   -- UNIQUE 인덱스 존재
--   SELECT indexname FROM pg_indexes
--   WHERE tablename='memberships' AND indexname='uniq_active_farm_membership';
--   -- 기대: 1 row
--
--   -- 클린업된 17건 audit
--   SELECT COUNT(*) FROM public.audit_logs
--   WHERE action='cleanup_duplicate_active_membership';
--   -- 기대: 17 rows
-- ═══════════════════════════════════════════════════════════════════
