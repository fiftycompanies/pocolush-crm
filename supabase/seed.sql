-- ============================================
-- POCOLUSH CRM — 목업 데이터 시드
-- Supabase SQL Editor에서 실행하세요.
-- 재실행해도 안전하도록 DELETE 후 INSERT 합니다.
-- ============================================

-- ────────────────────────────────────────
-- 0. 기존 목업 데이터 초기화 (재실행 안전)
-- ────────────────────────────────────────
DELETE FROM notifications;
DELETE FROM inquiry_notes;
DELETE FROM farm_rentals;
DELETE FROM inquiries;
DELETE FROM customers;
-- farms는 002_farms에서 이미 10개 생성됨, 면적만 업데이트

-- ────────────────────────────────────────
-- 1. 농장 면적 업데이트 (각각 다른 면적)
-- ────────────────────────────────────────
UPDATE farms SET area_pyeong = 3.0 WHERE number = 1;
UPDATE farms SET area_pyeong = 2.5 WHERE number = 2;
UPDATE farms SET area_pyeong = 4.0 WHERE number = 3;
UPDATE farms SET area_pyeong = 2.0 WHERE number = 4;
UPDATE farms SET area_pyeong = 3.5 WHERE number = 5;
UPDATE farms SET area_pyeong = 5.0 WHERE number = 6;
UPDATE farms SET area_pyeong = 2.5 WHERE number = 7;
UPDATE farms SET area_pyeong = 3.0 WHERE number = 8;
UPDATE farms SET area_pyeong = 2.0 WHERE number = 9;
UPDATE farms SET area_pyeong = 4.5 WHERE number = 10;

-- 10번 농장을 관리중으로 설정
UPDATE farms SET status = 'maintenance' WHERE number = 10;

-- ────────────────────────────────────────
-- 2. 고객 12명
-- ────────────────────────────────────────
INSERT INTO customers (id, name, phone, created_at) VALUES
  ('10000000-0000-4000-a000-000000000001', '김민준', '010-1234-5678', NOW() - INTERVAL '120 days'),
  ('10000000-0000-4000-a000-000000000002', '이서연', '010-2345-6789', NOW() - INTERVAL '100 days'),
  ('10000000-0000-4000-a000-000000000003', '박지훈', '010-3456-7890', NOW() - INTERVAL '90 days'),
  ('10000000-0000-4000-a000-000000000004', '최수아', '010-4567-8901', NOW() - INTERVAL '80 days'),
  ('10000000-0000-4000-a000-000000000005', '정우진', '010-5678-9012', NOW() - INTERVAL '75 days'),
  ('10000000-0000-4000-a000-000000000006', '강예린', '010-6789-0123', NOW() - INTERVAL '60 days'),
  ('10000000-0000-4000-a000-000000000007', '윤도현', '010-7890-1234', NOW() - INTERVAL '45 days'),
  ('10000000-0000-4000-a000-000000000008', '장하늘', '010-8901-2345', NOW() - INTERVAL '30 days'),
  ('10000000-0000-4000-a000-000000000009', '임소희', '010-9012-3456', NOW() - INTERVAL '20 days'),
  ('10000000-0000-4000-a000-000000000010', '한재원', '010-0123-4567', NOW() - INTERVAL '14 days'),
  ('10000000-0000-4000-a000-000000000011', '오지은', '010-1357-2468', NOW() - INTERVAL '7 days'),
  ('10000000-0000-4000-a000-000000000012', '신현우', '010-2468-1357', NOW() - INTERVAL '2 days');

-- ────────────────────────────────────────
-- 3. 문의 18건 (4가지 유형 골고루)
-- ────────────────────────────────────────

-- 알림 트리거 임시 비활성화 (대량 INSERT 시 불필요한 알림 방지)
ALTER TABLE inquiries DISABLE TRIGGER on_new_inquiry;

INSERT INTO inquiries (id, customer_id, type, status, data, created_at) VALUES

-- 자람터 분양 문의 (8건)
('20000000-0000-4000-a000-000000000001',
  '10000000-0000-4000-a000-000000000001', 'jaramter_inquiry', 'converted',
  '{"plan":"새싹","message":"아이 둘이라 2평 희망합니다"}',
  NOW() - INTERVAL '115 days'),

('20000000-0000-4000-a000-000000000002',
  '10000000-0000-4000-a000-000000000002', 'jaramter_inquiry', 'converted',
  '{"plan":"자람","message":"3평으로 넉넉하게 하고 싶어요"}',
  NOW() - INTERVAL '95 days'),

('20000000-0000-4000-a000-000000000003',
  '10000000-0000-4000-a000-000000000003', 'jaramter_inquiry', 'consulted',
  '{"plan":"씨앗","message":"처음 해보는 거라 작게 시작하려고요"}',
  NOW() - INTERVAL '85 days'),

('20000000-0000-4000-a000-000000000004',
  '10000000-0000-4000-a000-000000000005', 'jaramter_inquiry', 'contacted',
  '{"plan":"새싹","message":"주말에만 관리 가능한데 괜찮은가요?"}',
  NOW() - INTERVAL '70 days'),

('20000000-0000-4000-a000-000000000005',
  '10000000-0000-4000-a000-000000000007', 'jaramter_inquiry', 'new',
  '{"plan":"새싹","message":"분양 가능한 자리 남아있나요?"}',
  NOW() - INTERVAL '3 days'),

('20000000-0000-4000-a000-000000000006',
  '10000000-0000-4000-a000-000000000010', 'jaramter_inquiry', 'new',
  '{"plan":"자람","message":"가족이 4명인데 3평이면 충분할까요?"}',
  NOW() - INTERVAL '10 days'),

('20000000-0000-4000-a000-000000000007',
  '10000000-0000-4000-a000-000000000011', 'jaramter_inquiry', 'new',
  '{"plan":"씨앗","message":"체험 프로그램도 같이 신청 가능한가요?"}',
  NOW() - INTERVAL '5 days'),

('20000000-0000-4000-a000-000000000008',
  '10000000-0000-4000-a000-000000000012', 'jaramter_inquiry', 'new',
  '{"plan":"새싹","message":"빠른 연락 부탁드립니다"}',
  NOW() - INTERVAL '1 day'),

-- 잔치마루 상담 문의 (4건)
('20000000-0000-4000-a000-000000000009',
  '10000000-0000-4000-a000-000000000004', 'janchimaru_consult', 'consulted',
  '{"eventType":"칠순잔치","message":"어머니 칠순이라 야외에서 하고 싶어요. 약 50명 규모입니다."}',
  NOW() - INTERVAL '78 days'),

('20000000-0000-4000-a000-000000000010',
  '10000000-0000-4000-a000-000000000006', 'janchimaru_consult', 'contacted',
  '{"eventType":"야외 결혼식","message":"내년 봄 야외 결혼식 공간 문의드립니다. 80명 규모로 계획 중입니다."}',
  NOW() - INTERVAL '55 days'),

('20000000-0000-4000-a000-000000000011',
  '10000000-0000-4000-a000-000000000009', 'janchimaru_consult', 'new',
  '{"eventType":"회갑연","message":"아버지 환갑잔치입니다. 가능한 날짜 알려주세요."}',
  NOW() - INTERVAL '18 days'),

('20000000-0000-4000-a000-000000000012',
  '10000000-0000-4000-a000-000000000012', 'janchimaru_consult', 'new',
  '{"eventType":"돌잔치","message":"야외 돌잔치 가능한지 문의드립니다"}',
  NOW() - INTERVAL '1 day'),

-- 캠프닉 사전 알림 (3건)
('20000000-0000-4000-a000-000000000013',
  '10000000-0000-4000-a000-000000000008', 'campnic_notify', 'new',
  '{}',
  NOW() - INTERVAL '25 days'),

('20000000-0000-4000-a000-000000000014',
  '10000000-0000-4000-a000-000000000010', 'campnic_notify', 'new',
  '{}',
  NOW() - INTERVAL '12 days'),

('20000000-0000-4000-a000-000000000015',
  '10000000-0000-4000-a000-000000000011', 'campnic_notify', 'new',
  '{}',
  NOW() - INTERVAL '6 days'),

-- 어린이놀이터 사전 알림 (3건)
('20000000-0000-4000-a000-000000000016',
  '10000000-0000-4000-a000-000000000007', 'kids_notify', 'new',
  '{}',
  NOW() - INTERVAL '40 days'),

('20000000-0000-4000-a000-000000000017',
  '10000000-0000-4000-a000-000000000009', 'kids_notify', 'new',
  '{}',
  NOW() - INTERVAL '15 days'),

('20000000-0000-4000-a000-000000000018',
  '10000000-0000-4000-a000-000000000012', 'kids_notify', 'new',
  '{}',
  NOW() - INTERVAL '2 days');

-- 알림 트리거 다시 활성화
ALTER TABLE inquiries ENABLE TRIGGER on_new_inquiry;

-- ────────────────────────────────────────
-- 4. 문의 메모/히스토리 (주요 문의에)
-- ────────────────────────────────────────
INSERT INTO inquiry_notes (inquiry_id, content, note_type, created_at) VALUES
('20000000-0000-4000-a000-000000000001', '전화 통화 완료. 새싹 플랜 2평 확정. 3번 농장 배정 예정.', 'call', NOW() - INTERVAL '113 days'),
('20000000-0000-4000-a000-000000000001', '계약서 작성 완료. 첫 달 결제 확인.', 'memo', NOW() - INTERVAL '112 days'),

('20000000-0000-4000-a000-000000000002', '자람 플랜 상담 완료. 6번 농장 (5평) 희망했으나 3평 자람 플랜으로 조율.', 'call', NOW() - INTERVAL '93 days'),
('20000000-0000-4000-a000-000000000002', '계약 완료. 2번 농장 배정.', 'memo', NOW() - INTERVAL '92 days'),

('20000000-0000-4000-a000-000000000003', '씨앗 플랜 상세 안내 문자 발송.', 'memo', NOW() - INTERVAL '83 days'),
('20000000-0000-4000-a000-000000000003', '재통화. 다음 달 시작 원함.', 'call', NOW() - INTERVAL '80 days'),

('20000000-0000-4000-a000-000000000004', '주말 관리 가능 여부 확인 완료. 주 1회 방문으로 충분하다고 안내.', 'call', NOW() - INTERVAL '68 days'),

('20000000-0000-4000-a000-000000000009', '칠순잔치 공간 안내. 오픈 예정일 2026년 설명.', 'memo', NOW() - INTERVAL '76 days'),
('20000000-0000-4000-a000-000000000009', '사전 예약 의향 있음. 연락처 재확인 완료.', 'call', NOW() - INTERVAL '74 days'),

('20000000-0000-4000-a000-000000000010', '봄 야외 결혼식 상담. 4월~5월 날짜 협의 중.', 'memo', NOW() - INTERVAL '53 days');

-- ────────────────────────────────────────
-- 5. 임대 계약 (현재 7개 농장 임대중 + 만료 2개)
-- ────────────────────────────────────────
INSERT INTO farm_rentals (farm_id, customer_id, start_date, end_date, plan, monthly_fee, payment_method, payment_status, status, notes) VALUES

-- 활성 계약 7개
((SELECT id FROM farms WHERE number = 1), '10000000-0000-4000-a000-000000000001', '2024-10-01', '2025-09-30', '새싹', 119000, '계좌이체', '납부완료', 'active', '매달 1일 자동이체'),
((SELECT id FROM farms WHERE number = 2), '10000000-0000-4000-a000-000000000002', '2024-11-01', '2025-10-31', '자람', 179000, '카드', '납부완료', 'active', ''),
((SELECT id FROM farms WHERE number = 3), '10000000-0000-4000-a000-000000000003', '2024-12-01', '2025-11-30', '씨앗', 79000, '현금', '납부완료', 'active', '매달 초 직접 방문 납부'),
((SELECT id FROM farms WHERE number = 5), '10000000-0000-4000-a000-000000000005', '2025-01-01', '2025-03-15', '새싹', 119000, '계좌이체', '납부완료', 'active', '만료 임박 주의'),
((SELECT id FROM farms WHERE number = 6), '10000000-0000-4000-a000-000000000006', '2025-01-15', '2025-03-20', '자람', 179000, '카드', '미납', 'active', '이번달 미납 확인 필요'),
((SELECT id FROM farms WHERE number = 8), '10000000-0000-4000-a000-000000000007', '2025-02-01', '2026-01-31', '씨앗', 79000, '계좌이체', '납부완료', 'active', ''),
((SELECT id FROM farms WHERE number = 9), '10000000-0000-4000-a000-000000000008', '2025-02-15', '2025-08-14', '새싹', 119000, '현금', '납부완료', 'active', ''),

-- 만료된 계약 2개 (이력용)
((SELECT id FROM farms WHERE number = 4), '10000000-0000-4000-a000-000000000004', '2024-06-01', '2024-11-30', '씨앗', 79000, '계좌이체', '납부완료', 'expired', '기간 만료 후 재계약 안 함'),
((SELECT id FROM farms WHERE number = 7), '10000000-0000-4000-a000-000000000005', '2024-07-01', '2024-12-31', '새싹', 119000, '카드', '납부완료', 'expired', '');

-- ────────────────────────────────────────
-- 완료! 아래 쿼리로 데이터 확인:
-- ────────────────────────────────────────
-- SELECT COUNT(*) AS customers FROM customers;
-- SELECT COUNT(*) AS inquiries FROM inquiries;
-- SELECT COUNT(*) AS notes FROM inquiry_notes;
-- SELECT COUNT(*) AS rentals FROM farm_rentals;
-- SELECT number, area_pyeong, status FROM farms ORDER BY number;
