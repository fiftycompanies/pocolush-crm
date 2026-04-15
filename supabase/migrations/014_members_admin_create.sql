-- 014: 회원 관리자 직접 등록 지원
-- 관련: #9 회원 추가 [Q1 조건부 유니크] [Q6 phone UNIQUE]

-- 기존 UNIQUE 제약 삭제 후 조건부 유니크 인덱스
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_user_id_key;
ALTER TABLE members ALTER COLUMN user_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS members_user_id_unique
  ON members (user_id) WHERE user_id IS NOT NULL;

-- [Q6] 전화번호 중복 방지
-- 먼저 중복 전화번호 정리: 같은 phone이 여러 개면 가장 최근 1개만 남기고 삭제
DELETE FROM members
WHERE id NOT IN (
  SELECT DISTINCT ON (phone) id
  FROM members
  ORDER BY phone, created_at DESC
);

CREATE UNIQUE INDEX IF NOT EXISTS members_phone_unique ON members (phone);
