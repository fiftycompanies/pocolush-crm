-- Migration 020: trigger_error_logs table + standardized EXCEPTION
-- Keeps silent-fail observability minimal but sufficient:
--   SELECT * FROM trigger_error_logs ORDER BY created_at DESC LIMIT 10;
-- Idempotent: safe to re-run

-- Step 1: table
CREATE TABLE IF NOT EXISTS public.trigger_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  context JSONB,
  sqlstate TEXT,
  message TEXT,
  detail TEXT,
  hint TEXT,
  exception_context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trigger_error_logs_fn_created
  ON public.trigger_error_logs(function_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trigger_error_logs_created
  ON public.trigger_error_logs(created_at DESC);

ALTER TABLE public.trigger_error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trigger_error_logs_admin_select"
  ON public.trigger_error_logs;

CREATE POLICY "trigger_error_logs_admin_select"
  ON public.trigger_error_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );

-- Step 2: auto_issue_membership with full error capture
CREATE OR REPLACE FUNCTION public.auto_issue_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_member_id UUID;
  v_code TEXT;
  v_plots INT;
  v_attempts INT := 0;
  v_new_id UUID;
  v_sqlstate TEXT;
  v_message TEXT;
  v_detail TEXT;
  v_hint TEXT;
  v_context TEXT;
BEGIN
  IF NEW.payment_status = '납부완료'
     AND (OLD.payment_status IS NULL
          OR OLD.payment_status != '납부완료') THEN

    IF NEW.member_id IS NOT NULL THEN
      v_member_id := NEW.member_id;
    ELSE
      SELECT m.id INTO v_member_id
      FROM public.members m
      JOIN public.customers c ON m.phone = c.phone
      WHERE c.id = NEW.customer_id
      LIMIT 1;
    END IF;

    IF v_member_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.memberships
        WHERE member_id = v_member_id
          AND farm_id = NEW.farm_id
          AND status = 'active'
      ) THEN
        BEGIN
          LOOP
            v_code := 'poco-'
              || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
            v_attempts := v_attempts + 1;
            EXIT WHEN NOT EXISTS (
              SELECT 1 FROM public.memberships
              WHERE membership_code = v_code
            ) OR v_attempts >= 20;
          END LOOP;

          SELECT plots INTO v_plots
          FROM public.plans
          WHERE name = NEW.plan
          LIMIT 1;

          IF v_plots IS NULL THEN
            v_plots := CASE NEW.plan
              WHEN '씨앗' THEN 1
              WHEN '새싹' THEN 2
              WHEN '자람' THEN 3
              ELSE 1
            END;
          END IF;

          INSERT INTO public.memberships (
            member_id,
            membership_code,
            farm_id,
            plots,
            start_date,
            end_date,
            status,
            benefits
          ) VALUES (
            v_member_id,
            v_code,
            NEW.farm_id,
            v_plots,
            COALESCE(NEW.start_date, CURRENT_DATE),
            COALESCE(
              NEW.end_date,
              CURRENT_DATE + INTERVAL '1 year'
            ),
            'active',
            jsonb_build_array(
              '에어바운스 / 키즈놀이터 / 모래놀이터 무료 이용',
              '동물 먹이주기 체험 무료',
              '하계철 수영장 무료 이용',
              '동계철 눈썰매장 할인권 제공',
              '전기 수도 농기구 무상 이용',
              '포코러쉬 풀빌라 할인권 제공'
            )
          )
          RETURNING id INTO v_new_id;

          INSERT INTO public.membership_logs (
            membership_id,
            action,
            to_status,
            to_start,
            to_end
          ) VALUES (
            v_new_id,
            'issued',
            'active',
            NEW.start_date,
            NEW.end_date
          );

        EXCEPTION WHEN OTHERS THEN
          GET STACKED DIAGNOSTICS
            v_sqlstate = RETURNED_SQLSTATE,
            v_message  = MESSAGE_TEXT,
            v_detail   = PG_EXCEPTION_DETAIL,
            v_hint     = PG_EXCEPTION_HINT,
            v_context  = PG_EXCEPTION_CONTEXT;

          BEGIN
            INSERT INTO public.trigger_error_logs (
              function_name,
              context,
              sqlstate,
              message,
              detail,
              hint,
              exception_context
            ) VALUES (
              'auto_issue_membership',
              jsonb_build_object(
                'rental_id', NEW.id,
                'payment_status', NEW.payment_status,
                'member_id', NEW.member_id,
                'farm_id', NEW.farm_id,
                'plan', NEW.plan,
                'customer_id', NEW.customer_id
              ),
              v_sqlstate,
              v_message,
              v_detail,
              v_hint,
              v_context
            );
          EXCEPTION WHEN OTHERS THEN
            -- logging failed too; do not propagate
            NULL;
          END;

          RAISE WARNING
            'auto_issue_membership failed rental=% sqlstate=% msg=%',
            NEW.id, v_sqlstate, v_message;
        END;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;
