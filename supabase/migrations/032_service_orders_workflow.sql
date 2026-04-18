-- 032_service_orders_workflow.sql
-- R3: service_orders 상태를 결제필요/대기/완료/취소 3단계+α로
-- + settings 테이블 신설 (계좌번호 저장)

-- (1) settings 테이블
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS settings_admin_all ON public.settings;
CREATE POLICY settings_admin_all ON public.settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

INSERT INTO public.settings(key, value, description) VALUES
  ('bank_name', '기업은행', '스토어 주문 무통장 은행명'),
  ('bank_account', '505-070795-01-014', '계좌번호'),
  ('bank_holder', '와이드와일드', '예금주'),
  ('bank_note', '회원권과 동일한 예금주로 입금해주시면 순차적으로 확인해드립니다', '고객 안내 문구')
ON CONFLICT (key) DO NOTHING;

-- (2) service_orders.status: pending → payment_pending
ALTER TABLE public.service_orders DROP CONSTRAINT IF EXISTS service_orders_status_check;

UPDATE public.service_orders SET status = 'payment_pending' WHERE status = 'pending';

ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_status_check
  CHECK (status IN ('payment_pending', 'processing', 'completed', 'cancelled'));
