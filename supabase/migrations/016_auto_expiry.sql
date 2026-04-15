-- 016: 자동만료 시스템
-- 매일 실행하여 날짜 지난 레코드 상태 자동 전환

-- 1. 임대계약 자동만료
CREATE OR REPLACE FUNCTION auto_expire_rentals()
RETURNS void AS $$
BEGIN
  UPDATE farm_rentals
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active'
    AND end_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 멤버십 자동만료
CREATE OR REPLACE FUNCTION auto_expire_memberships()
RETURNS void AS $$
BEGIN
  UPDATE memberships
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active'
    AND end_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 쿠폰 발급 자동만료
CREATE OR REPLACE FUNCTION auto_expire_coupon_issues()
RETURNS void AS $$
BEGIN
  UPDATE coupon_issues ci
  SET status = 'expired'
  WHERE ci.status = 'issued'
    AND EXISTS (
      SELECT 1 FROM coupons c
      WHERE c.id = ci.coupon_id
        AND c.valid_until IS NOT NULL
        AND c.valid_until < CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 쿠폰 자동 비활성화
CREATE OR REPLACE FUNCTION auto_deactivate_coupons()
RETURNS void AS $$
BEGIN
  UPDATE coupons
  SET is_active = false
  WHERE is_active = true
    AND valid_until IS NOT NULL
    AND valid_until < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. BBQ 예약 자동완료 (어제 이전만, 당일 예약 유지)
CREATE OR REPLACE FUNCTION auto_complete_reservations()
RETURNS void AS $$
BEGIN
  UPDATE bbq_reservations
  SET status = 'completed', updated_at = NOW()
  WHERE status = 'confirmed'
    AND reservation_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 통합 실행 함수
CREATE OR REPLACE FUNCTION run_daily_auto_expiry()
RETURNS void AS $$
BEGIN
  PERFORM auto_expire_rentals();
  PERFORM auto_expire_memberships();
  PERFORM auto_expire_coupon_issues();
  PERFORM auto_deactivate_coupons();
  PERFORM auto_complete_reservations();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. change_member_status RPC 업데이트 (expired 멤버십 복원 지원)
CREATE OR REPLACE FUNCTION change_member_status(
  p_member_id UUID,
  p_new_status TEXT,
  p_reason TEXT DEFAULT NULL,
  p_changed_by UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_old_status TEXT;
BEGIN
  SELECT status INTO v_old_status
  FROM members WHERE id = p_member_id
  FOR UPDATE;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'MEMBER_NOT_FOUND';
  END IF;

  IF v_old_status = p_new_status THEN
    RETURN;
  END IF;

  UPDATE members
  SET status = p_new_status, updated_at = NOW()
  WHERE id = p_member_id;

  INSERT INTO member_status_logs (member_id, from_status, to_status, reason, changed_by)
  VALUES (p_member_id, v_old_status, p_new_status, p_reason, p_changed_by);

  IF p_new_status = 'suspended' THEN
    UPDATE bbq_reservations
    SET status = 'cancelled', cancelled_at = NOW()
    WHERE member_id = p_member_id
      AND status = 'confirmed'
      AND reservation_date >= CURRENT_DATE;

    UPDATE memberships
    SET status = 'cancelled', updated_at = NOW()
    WHERE member_id = p_member_id AND status = 'active';
  END IF;

  -- SE-3: expired + cancelled 모두 복원 대상
  IF p_new_status = 'approved' AND v_old_status = 'suspended' THEN
    UPDATE memberships
    SET status = 'active', updated_at = NOW()
    WHERE member_id = p_member_id
      AND status IN ('cancelled', 'expired')
      AND end_date >= CURRENT_DATE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
