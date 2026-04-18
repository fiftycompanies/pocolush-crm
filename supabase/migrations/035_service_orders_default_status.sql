-- 035_service_orders_default_status.sql
-- Hotfix: R3 마이그(032)가 CHECK을 payment_pending/processing/completed/cancelled로 교체했으나
-- 005_store.sql의 DEFAULT 'pending' 은 그대로 남아 신규 INSERT 시 CHECK 위반.
-- DEFAULT를 'payment_pending' 으로 변경.

ALTER TABLE public.service_orders ALTER COLUMN status SET DEFAULT 'payment_pending';
