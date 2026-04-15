-- 011: 멤버십 자동 발행 트리거
-- 관련: #5 회원권 자동 발행 [Q3 에러 핸들링]

CREATE OR REPLACE FUNCTION auto_issue_membership()
RETURNS TRIGGER AS $$
DECLARE
  v_member_id UUID;
  v_code TEXT;
  v_start DATE;
  v_end DATE;
  v_attempts INT := 0;
BEGIN
  IF NEW.payment_status = '납부완료' AND
     (OLD.payment_status IS NULL OR OLD.payment_status != '납부완료') THEN

    SELECT m.id INTO v_member_id
    FROM members m
    JOIN customers c ON m.phone = c.phone
    WHERE c.id = NEW.customer_id
    LIMIT 1;

    IF v_member_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM memberships
        WHERE member_id = v_member_id AND status = 'active'
      ) THEN
        BEGIN
          LOOP
            v_code := 'poco-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
            v_attempts := v_attempts + 1;
            EXIT WHEN NOT EXISTS (
              SELECT 1 FROM memberships WHERE membership_code = v_code
            ) OR v_attempts >= 10;
          END LOOP;

          v_start := CURRENT_DATE;
          v_end := CURRENT_DATE + INTERVAL '1 year';

          INSERT INTO memberships (
            member_id, membership_code, farm_id, plots,
            start_date, end_date, status, benefits
          ) VALUES (
            v_member_id, v_code, NEW.farm_id,
            CASE NEW.plan
              WHEN '씨앗' THEN 1
              WHEN '새싹' THEN 2
              WHEN '자람' THEN 3
              ELSE 1
            END,
            v_start, v_end, 'active',
            ARRAY[
              '에어바운스 / 키즈놀이터 / 모래놀이터 무료 이용',
              '동물 먹이주기 체험 무료',
              '하계철 수영장 무료 이용',
              '동계철 눈썰매장 할인권 제공',
              '전기 수도 농기구 무상 이용',
              '포코러쉬 풀빌라 할인권 제공'
            ]
          );

        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'auto_issue_membership failed for rental %: %', NEW.id, SQLERRM;
        END;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_auto_issue_membership
  AFTER UPDATE ON farm_rentals
  FOR EACH ROW
  EXECUTE FUNCTION auto_issue_membership();
