-- 009: 스토어 신청 관리 강화 — 결제 추적 필드 추가
-- 관련: #3 스토어 신청 관리

ALTER TABLE service_orders
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT '계좌이체'
  CHECK (payment_method IN ('계좌이체', '카드', '현금')),
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT '대기'
  CHECK (payment_status IN ('대기', '납부완료', '미납'));
