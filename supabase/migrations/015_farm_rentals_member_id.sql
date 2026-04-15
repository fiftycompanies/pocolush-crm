-- 015: farm_rentals에 member_id 직접 FK 추가
-- 기존 phone 매칭 간접 연결의 구조적 취약점 해결

-- 1. member_id 컬럼 추가
ALTER TABLE farm_rentals ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id);

-- 2. 기존 데이터 백필 (customers.phone → members.phone 매칭)
UPDATE farm_rentals fr
SET member_id = sub.mid
FROM (
  SELECT fr2.id AS rid, m.id AS mid
  FROM farm_rentals fr2
  JOIN customers c ON c.id = fr2.customer_id
  JOIN members m ON m.phone = c.phone
) sub
WHERE fr.id = sub.rid AND fr.member_id IS NULL;

-- 3. 멤버십 자동발행 트리거 업데이트 — member_id 우선, phone 폴백
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

    -- member_id 직접 사용 (있으면), 없으면 phone 폴백
    IF NEW.member_id IS NOT NULL THEN
      v_member_id := NEW.member_id;
    ELSE
      SELECT m.id INTO v_member_id
      FROM members m
      JOIN customers c ON m.phone = c.phone
      WHERE c.id = NEW.customer_id
      LIMIT 1;
    END IF;

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
