-- 036_service_order_photos.sql
-- 고객 서비스 주문(잡초뽑기/물주기) 결과물 사진 저장 + RLS
-- hard CASCADE: service_orders 삭제 시 photos 행 자동 삭제
-- Storage object 삭제는 클라이언트(lib/upload-service-photo.ts)에서 동시 호출

CREATE TABLE IF NOT EXISTS public.service_order_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  display_url TEXT NOT NULL,
  caption TEXT,
  display_order INT DEFAULT 0,
  file_size_bytes INTEGER,
  mime_type TEXT CHECK (mime_type IS NULL OR mime_type LIKE 'image/%'),
  width INTEGER,
  height INTEGER,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sop_order ON public.service_order_photos(service_order_id, display_order);

-- display_order 자동 증가 (race condition 방지) + updated_at 자동 갱신
DROP TRIGGER IF EXISTS trg_sop_display_order ON public.service_order_photos;
DROP FUNCTION IF EXISTS public.set_service_order_photo_order();

CREATE FUNCTION public.set_service_order_photo_order() RETURNS TRIGGER LANGUAGE plpgsql AS $fn_036_order$ BEGIN IF TG_OP = 'INSERT' AND (NEW.display_order IS NULL OR NEW.display_order = 0) THEN NEW.display_order := COALESCE((SELECT MAX(display_order) + 1 FROM public.service_order_photos WHERE service_order_id = NEW.service_order_id), 0); END IF; NEW.updated_at := NOW(); RETURN NEW; END; $fn_036_order$;

CREATE TRIGGER trg_sop_display_order BEFORE INSERT OR UPDATE ON public.service_order_photos FOR EACH ROW EXECUTE FUNCTION public.set_service_order_photo_order();

-- RLS
ALTER TABLE public.service_order_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sop_read ON public.service_order_photos;
CREATE POLICY sop_read ON public.service_order_photos FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.service_orders so
          JOIN public.members m ON m.id = so.member_id
          WHERE so.id = service_order_id AND m.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS sop_admin_write ON public.service_order_photos;
CREATE POLICY sop_admin_write ON public.service_order_photos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
