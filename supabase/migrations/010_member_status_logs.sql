-- 010: 회원 상태 변경 로그 + RPC 함수
-- 관련: #4 회원 상태값 변경 [Q2 트랜잭션 보장] [Q4 정지정책]

CREATE TABLE IF NOT EXISTS member_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  reason TEXT,
  changed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE member_status_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access" ON member_status_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
  );

-- [Q2] 원자적 상태 변경 RPC (트랜잭션 보장)
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

  -- [Q4] 정지 시 관련 데이터 처리
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

  IF p_new_status = 'approved' AND v_old_status = 'suspended' THEN
    UPDATE memberships
    SET status = 'active', updated_at = NOW()
    WHERE member_id = p_member_id
      AND status = 'cancelled'
      AND end_date >= CURRENT_DATE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
