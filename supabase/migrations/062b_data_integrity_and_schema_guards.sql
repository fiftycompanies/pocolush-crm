-- ═══════════════════════════════════════════════════════════════════
-- 062-b: 데이터 연결 정상화 + 스키마 보호 + 롤백 가능 백업
-- ═══════════════════════════════════════════════════════════════════
-- 배경 (8스킬 진단):
--   1) admin@pocolush.co.kr 가 farm 미선택 상태로 멤버십 22건 수동 발급
--   2) 5/4~5/12 진짜 farm 배정 시 기존 NULL active 정리 누락
--   3) 가짜 zone 'ㅇㅇ' + C존 미운영 잔존
--   4) farms.status ↔ memberships 자동 동기화 트리거 부재
--   5) memberships.farm_id NULL 허용 (active 상태에서도) 차단 없음
--
-- 사용자 결정 (kk):
--   - 회원/농장 row 삭제 금지 (status 변경만)
--   - 백업 + 롤백 가능 준비
--   - C존 미운영
--
-- 영향:
--   - row 삭제 0건 (보존)
--   - memberships.status 변경 ~25건 (NULL active 22 + 'ㅇㅇ' active 1 + 이석형2/하지민 NULL 2)
--   - farm_zones.is_operational FALSE: 'ㅇㅇ', 'C존' (또는 'ㄷ' 등 운영 외)
--   - farms.status 자동 sync (트리거)
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- Pre-Check: zone 명단 검증 (예상 외 zone 발견 시 차단) — QA F-BLOCKER
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_unexpected TEXT;
BEGIN
  SELECT STRING_AGG(name, ', ') INTO v_unexpected
  FROM public.farm_zones
  WHERE name NOT IN ('A존', 'B존', 'C존', 'ㅇㅇ');
  IF v_unexpected IS NOT NULL THEN
    RAISE EXCEPTION '062-b 차단: 예상 외 zone 발견 (%) — 운영팀 확인 후 마이그레이션 수정 필요', v_unexpected;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- Pre-Check: 동시성 보호 — 적용 동안 memberships 신규 INSERT 차단 (QA H-HIGH)
-- ─────────────────────────────────────────────────────────────────
LOCK TABLE public.memberships IN EXCLUSIVE MODE;
LOCK TABLE public.farm_zones IN EXCLUSIVE MODE;
LOCK TABLE public.farms IN EXCLUSIVE MODE;

-- ─────────────────────────────────────────────────────────────────
-- Part 0: 롤백 가능 백업 (변경 대상 row 의 snapshot)
-- ─────────────────────────────────────────────────────────────────
-- 백업 테이블 명명: <table>_backup_062b_<YYYYMMDD>
-- 향후 롤백: snapshot 으로 status / is_operational 복원

CREATE TABLE IF NOT EXISTS public.memberships_backup_062b_20260512 AS
SELECT m.*
FROM public.memberships m
WHERE m.status = 'active'
  AND (
    m.farm_id IS NULL
    OR m.farm_id IN (
      SELECT f.id FROM public.farms f
      JOIN public.farm_zones fz ON fz.id = f.zone_id
      WHERE fz.name NOT IN ('A존', 'B존')  -- C존 + 'ㅇㅇ' 등 운영 외
    )
  );

COMMENT ON TABLE public.memberships_backup_062b_20260512 IS
  '062-b 백업: NULL farm + 운영외 zone active 멤버십 전체 (롤백용).';

CREATE TABLE IF NOT EXISTS public.farm_zones_backup_062b_20260512 AS
SELECT * FROM public.farm_zones
WHERE name NOT IN ('A존', 'B존');  -- 비운영 처리 대상

CREATE TABLE IF NOT EXISTS public.farms_backup_062b_20260512 AS
SELECT f.* FROM public.farms f
JOIN public.farm_zones fz ON fz.id = f.zone_id
WHERE fz.name NOT IN ('A존', 'B존');

-- 백업 테이블 RLS (service_role only — QA G-HIGH)
ALTER TABLE public.memberships_backup_062b_20260512 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_zones_backup_062b_20260512 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farms_backup_062b_20260512 ENABLE ROW LEVEL SECURITY;
-- 정책 미생성 = 모든 일반 role 접근 차단, service_role 만 가능

REVOKE ALL ON public.memberships_backup_062b_20260512 FROM PUBLIC, authenticated, anon;
REVOKE ALL ON public.farm_zones_backup_062b_20260512 FROM PUBLIC, authenticated, anon;
REVOKE ALL ON public.farms_backup_062b_20260512 FROM PUBLIC, authenticated, anon;

-- 백업 검증
DO $$
DECLARE
  v_memberships_backup INT;
  v_zones_backup INT;
  v_farms_backup INT;
BEGIN
  SELECT COUNT(*) INTO v_memberships_backup FROM public.memberships_backup_062b_20260512;
  SELECT COUNT(*) INTO v_zones_backup FROM public.farm_zones_backup_062b_20260512;
  SELECT COUNT(*) INTO v_farms_backup FROM public.farms_backup_062b_20260512;
  RAISE NOTICE '백업 완료 — memberships: %, zones: %, farms: %',
    v_memberships_backup, v_zones_backup, v_farms_backup;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- Part 1: 클린업 (배치도 = 진실, 진짜 farm active 는 보존)
-- ─────────────────────────────────────────────────────────────────

-- 1-A: NULL farm_id active 22건 → expired
--   각 회원의 진짜 farm active 는 다른 row 에 존재하므로 안전
UPDATE public.memberships
SET status = 'expired', updated_at = NOW()
WHERE status = 'active' AND farm_id IS NULL;

-- 1-B: 운영 외 zone (C존, 'ㅇㅇ' 등) 의 active 멤버십 expire
--   배치도 스크린샷에 C존 없음 + 사용자 확정
UPDATE public.memberships
SET status = 'expired', updated_at = NOW()
WHERE status = 'active'
  AND farm_id IN (
    SELECT f.id FROM public.farms f
    JOIN public.farm_zones fz ON fz.id = f.zone_id
    WHERE fz.name NOT IN ('A존', 'B존')
  );

-- 1-C: audit_logs 기록 (변경된 row 만)
INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
SELECT
  NULL,
  'cleanup_orphan_active_membership',
  'membership',
  m.id,
  jsonb_build_object(
    'reason', 'migration_062b',
    'member_id', m.member_id,
    'farm_id', m.farm_id,
    'old_status', 'active',
    'new_status', 'expired',
    'cleanup_at', NOW()
  )
FROM public.memberships m
WHERE m.status = 'expired'
  AND m.updated_at > NOW() - INTERVAL '1 minute';

-- ─────────────────────────────────────────────────────────────────
-- Part 2: farm_zones is_operational 추가 + 가짜 zone 비활성
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.farm_zones
  ADD COLUMN IF NOT EXISTS is_operational BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.farm_zones.is_operational IS
  '062-b: 운영 중 zone 만 신규 farm/멤버십 사용 가능. 기존 데이터 보존용 비활성 zone 마크.';

-- 'A존', 'B존' 외 모든 zone 미운영 처리 (C존 + 'ㅇㅇ' 등)
UPDATE public.farm_zones
SET is_operational = FALSE, is_active = FALSE
WHERE name NOT IN ('A존', 'B존');

-- ─────────────────────────────────────────────────────────────────
-- Part 3: CHECK 제약 — active 상태 + NULL farm 차단
-- ─────────────────────────────────────────────────────────────────
-- Part 1 클린업 후에만 적용 가능 (이전엔 위반 22건)

ALTER TABLE public.memberships
  DROP CONSTRAINT IF EXISTS chk_active_has_farm;

ALTER TABLE public.memberships
  ADD CONSTRAINT chk_active_has_farm
  CHECK (status != 'active' OR farm_id IS NOT NULL);

COMMENT ON CONSTRAINT chk_active_has_farm ON public.memberships IS
  '062-b: active 멤버십은 반드시 farm_id 보유. 수동 INSERT 우회 차단.';

-- ─────────────────────────────────────────────────────────────────
-- Part 4: farms.status 자동 동기화 트리거
-- ─────────────────────────────────────────────────────────────────
-- memberships 또는 farm_rentals 변경 시 farms.status 자동 갱신
-- 'rented' = active 멤버십 또는 active rental 보유
-- 'available' = 그 외

CREATE OR REPLACE FUNCTION public.fn_sync_farm_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn_062b_sync$
DECLARE
  v_target_farm UUID;
  v_has_active BOOLEAN;
BEGIN
  -- 대상 farm: NEW 우선, DELETE 면 OLD
  v_target_farm := COALESCE(NEW.farm_id, OLD.farm_id);
  IF v_target_farm IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 활성 멤버십 또는 활성 rental 존재 여부
  v_has_active := EXISTS (
    SELECT 1 FROM public.memberships
    WHERE farm_id = v_target_farm AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.farm_rentals
    WHERE farm_id = v_target_farm
      AND status = 'active'
      AND end_date >= CURRENT_DATE
  );

  UPDATE public.farms
  SET status = CASE WHEN v_has_active THEN 'rented' ELSE 'available' END
  WHERE id = v_target_farm
    AND status != CASE WHEN v_has_active THEN 'rented' ELSE 'available' END;

  RETURN COALESCE(NEW, OLD);
END
$fn_062b_sync$;

DROP TRIGGER IF EXISTS trg_sync_farm_status_on_membership ON public.memberships;
CREATE TRIGGER trg_sync_farm_status_on_membership
  AFTER INSERT OR UPDATE OF farm_id, status OR DELETE
  ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_farm_status();

DROP TRIGGER IF EXISTS trg_sync_farm_status_on_rental ON public.farm_rentals;
CREATE TRIGGER trg_sync_farm_status_on_rental
  AFTER INSERT OR UPDATE OF farm_id, status, end_date OR DELETE
  ON public.farm_rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_farm_status();

COMMENT ON FUNCTION public.fn_sync_farm_status IS
  '062-b: memberships/farm_rentals 변경 시 farms.status 자동 sync (rented/available).';

-- ─────────────────────────────────────────────────────────────────
-- Part 5: 기존 farms.status 일괄 재동기화 (트리거 적용 전 데이터 보정)
-- ─────────────────────────────────────────────────────────────────

UPDATE public.farms f
SET status = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.memberships
    WHERE farm_id = f.id AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.farm_rentals
    WHERE farm_id = f.id AND status = 'active' AND end_date >= CURRENT_DATE
  ) THEN 'rented'
  ELSE 'available'
END
WHERE status != CASE
  WHEN EXISTS (
    SELECT 1 FROM public.memberships
    WHERE farm_id = f.id AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.farm_rentals
    WHERE farm_id = f.id AND status = 'active' AND end_date >= CURRENT_DATE
  ) THEN 'rented'
  ELSE 'available'
END;

-- ─────────────────────────────────────────────────────────────────
-- Part 6: 운영 외 zone 의 farm 에 신규 active 멤버십 INSERT 차단
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_prevent_inactive_zone_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn_062b_prevent$
DECLARE
  v_zone_operational BOOLEAN;
BEGIN
  IF NEW.status != 'active' OR NEW.farm_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT fz.is_operational INTO v_zone_operational
  FROM public.farms f
  JOIN public.farm_zones fz ON fz.id = f.zone_id
  WHERE f.id = NEW.farm_id;

  IF v_zone_operational IS FALSE THEN
    RAISE EXCEPTION 'ZONE_NOT_OPERATIONAL: 미운영 zone 의 farm 에는 active 멤버십을 만들 수 없습니다 (farm_id=%)', NEW.farm_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END
$fn_062b_prevent$;

DROP TRIGGER IF EXISTS trg_prevent_inactive_zone_membership ON public.memberships;
CREATE TRIGGER trg_prevent_inactive_zone_membership
  BEFORE INSERT OR UPDATE OF farm_id, status
  ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_prevent_inactive_zone_membership();

COMMENT ON FUNCTION public.fn_prevent_inactive_zone_membership IS
  '062-b: 미운영 zone(is_operational=false) 에는 active 멤버십 INSERT/UPDATE 차단.';

-- ─────────────────────────────────────────────────────────────────
-- Part 7: 검증
-- ─────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_null_active INT;
  v_invalid_zone_active INT;
  v_active_total INT;
  v_constraint_exists BOOLEAN;
  v_trigger_count INT;
BEGIN
  -- NULL active 0건
  SELECT COUNT(*) INTO v_null_active
  FROM public.memberships WHERE status = 'active' AND farm_id IS NULL;
  IF v_null_active > 0 THEN
    RAISE EXCEPTION '062-b 클린업 후에도 NULL farm active 가 % 건 남음', v_null_active;
  END IF;

  -- 운영 외 zone active 0건
  SELECT COUNT(*) INTO v_invalid_zone_active
  FROM public.memberships m
  JOIN public.farms f ON f.id = m.farm_id
  JOIN public.farm_zones fz ON fz.id = f.zone_id
  WHERE m.status = 'active' AND fz.is_operational = FALSE;
  IF v_invalid_zone_active > 0 THEN
    RAISE EXCEPTION '운영 외 zone 의 active 가 % 건 남음', v_invalid_zone_active;
  END IF;

  -- CHECK 제약 존재
  SELECT EXISTS(
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_active_has_farm'
  ) INTO v_constraint_exists;
  IF NOT v_constraint_exists THEN
    RAISE EXCEPTION 'chk_active_has_farm CHECK 제약 미적용';
  END IF;

  -- 트리거 존재
  SELECT COUNT(*) INTO v_trigger_count
  FROM pg_trigger
  WHERE tgname IN (
    'trg_sync_farm_status_on_membership',
    'trg_sync_farm_status_on_rental',
    'trg_prevent_inactive_zone_membership'
  );
  IF v_trigger_count != 3 THEN
    RAISE EXCEPTION '트리거 % 개만 등록 (3개 기대)', v_trigger_count;
  END IF;

  SELECT COUNT(*) INTO v_active_total
  FROM public.memberships WHERE status = 'active';

  RAISE NOTICE '062-b 검증 통과 — active 멤버십 % 건, NULL 0, 운영외 0, CHECK + 3 triggers OK', v_active_total;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 롤백 절차 (긴급 시):
--
-- 1. CHECK + 트리거 해제 (롤백 데이터가 위반)
--    ALTER TABLE memberships DROP CONSTRAINT chk_active_has_farm;
--    DROP TRIGGER trg_prevent_inactive_zone_membership ON memberships;
--    DROP TRIGGER trg_sync_farm_status_on_membership ON memberships;
--    DROP TRIGGER trg_sync_farm_status_on_rental ON farm_rentals;
--
-- 2. 멤버십 status 복원
--    UPDATE memberships m SET status = b.status, updated_at = b.updated_at
--    FROM memberships_backup_062b_20260512 b WHERE m.id = b.id;
--
-- 3. zone is_operational 복원
--    UPDATE farm_zones fz SET is_operational = TRUE, is_active = b.is_active
--    FROM farm_zones_backup_062b_20260512 b WHERE fz.id = b.id;
--    ALTER TABLE farm_zones DROP COLUMN is_operational;
--
-- 4. farms.status 재계산 (트리거 없는 상태)
--    UPDATE farms f SET status = ... 이전 로직대로
--
-- 5. audit_logs 정리 (필요 시)
--    DELETE FROM audit_logs WHERE action = 'cleanup_orphan_active_membership'
--      AND created_at > NOW() - INTERVAL '1 day';
--
-- 백업 테이블은 30일 후 운영자가 수동 DROP 권장:
--   DROP TABLE memberships_backup_062b_20260512;
--   DROP TABLE farm_zones_backup_062b_20260512;
--   DROP TABLE farms_backup_062b_20260512;
-- ═══════════════════════════════════════════════════════════════════
