-- 077: 인덱스 정리 + audit_logs 시간 범위 조회 성능
-- 검수 발견:
--   D2: idx_bbq_reservations_date_slot_facility (072 추가) idx_scan=0 — 동일 컬럼 UNIQUE 인덱스가 흡수 중
--   audit: created_at 단일 인덱스 없음, 시간 범위 조회 시 seq scan 우려

-- (1) Unused partial 인덱스 제거 (UNIQUE 인덱스가 동일 컬럼 set 으로 동작 중)
DROP INDEX IF EXISTS public.idx_bbq_reservations_date_slot_facility;

-- (2) audit_logs created_at 인덱스 (시간 범위 조회 + PIPA 5년 보관 정리)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs (created_at DESC);
