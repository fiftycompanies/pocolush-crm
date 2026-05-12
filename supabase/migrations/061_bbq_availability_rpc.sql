-- ═══════════════════════════════════════════════════════════════════
-- 061: BBQ 가용성 SECURITY DEFINER RPC — RLS 우회 + status 확장
-- ═══════════════════════════════════════════════════════════════════
-- 배경 (qa 스킬 8스킬 검수):
--   결함 1: app/member/reservation/page.tsx 의 가용성 조회가
--     .eq('status','confirmed') 만 카운팅 → 016 auto_complete 또는 운영자
--     수동 변환으로 completed 가 된 미래 예약을 가용성에 안 잡음
--     → 예약된 시설이 "빈자리" 로 표시 + 중복 예약 시도 위험
--
--   결함 2: 060 hotfix 후 bbq_reservations_member_select 가
--     본인 + admin 만 노출 → 회원이 타인 예약을 못 봐서 가용성 계산 깨짐
--     (현재 prod 에 다중 회원 슬롯 0건이라 미발현, 신규 예약 발생 시 즉시 발현)
--
-- 조치:
--   - SECURITY DEFINER RPC 2개로 RLS 우회 (개인정보 비노출, 카운팅만)
--   - status IN ('confirmed', 'completed') 확장 (예약된 슬롯 정확히 카운팅)
--   - 클라이언트는 RPC 호출로 교체 (개별 SELECT 제거)
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- RPC 1: 슬롯별 가용성 (타임슬롯 선택 화면)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_bbq_availability(
  p_date DATE
)
RETURNS TABLE (
  slot_number INT,
  booked_count INT,
  available_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $fn_061_avail$
DECLARE
  v_active_facilities INT;
BEGIN
  -- 활성 시설 수 (가용성 분모)
  SELECT COUNT(*) INTO v_active_facilities
  FROM public.bbq_facilities WHERE is_active = TRUE;

  RETURN QUERY
  SELECT
    s.slot_number,
    COUNT(r.id)::INT AS booked_count,
    GREATEST(v_active_facilities - COUNT(r.id)::INT, 0) AS available_count
  FROM public.bbq_time_slots s
  LEFT JOIN public.bbq_reservations r
    ON r.time_slot = s.slot_number
    AND r.reservation_date = p_date
    AND r.status IN ('confirmed', 'completed')  -- 예약 점유 상태 (cancelled 만 제외)
  WHERE s.is_active = TRUE
  GROUP BY s.slot_number
  ORDER BY s.slot_number;
END
$fn_061_avail$;

COMMENT ON FUNCTION public.get_bbq_availability(DATE) IS
  '061: 날짜별 슬롯 가용성 (RLS 우회, status IN confirmed+completed 카운팅).';

GRANT EXECUTE ON FUNCTION public.get_bbq_availability(DATE) TO authenticated;

-- ─────────────────────────────────────────────────────────────────
-- RPC 2: 특정 슬롯의 점유 시설 번호 목록 (BBQGrid 표시)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_booked_facilities(
  p_date DATE,
  p_slot INT
)
RETURNS TABLE (bbq_number INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $fn_061_booked$
  SELECT bbq_number
  FROM public.bbq_reservations
  WHERE reservation_date = p_date
    AND time_slot = p_slot
    AND status IN ('confirmed', 'completed');
$fn_061_booked$;

COMMENT ON FUNCTION public.get_booked_facilities(DATE, INT) IS
  '061: 날짜+슬롯의 점유 bbq_number 목록 (RLS 우회, 시설 번호만 노출).';

GRANT EXECUTE ON FUNCTION public.get_booked_facilities(DATE, INT) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 검증 SQL:
--   SELECT * FROM public.get_bbq_availability('2026-05-17');
--   -- 기대: slot 1 → booked 1 (5b0546a9), slot 2 → 0 (cancelled), slot 3 → 0
--
--   SELECT * FROM public.get_booked_facilities('2026-05-17', 1);
--   -- 기대: bbq_number 1
--
--   SELECT * FROM public.get_bbq_availability('2026-05-23');
--   -- 기대: slot 3 → booked 1 (53276ab8)
-- ═══════════════════════════════════════════════════════════════════
