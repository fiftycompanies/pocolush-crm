-- Migration 017: membership issue / suspend / resume / period-update
-- Idempotent: safe to re-run
-- Paste the whole file into Supabase SQL Editor, then Run

-- Step 1: membership_logs table
CREATE TABLE IF NOT EXISTS public.membership_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NOT NULL
    REFERENCES public.memberships(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'issued',
    'suspended',
    'resumed',
    'period_updated',
    'expired',
    'manual_issue'
  )),
  from_status TEXT,
  to_status TEXT,
  from_start DATE,
  to_start DATE,
  from_end DATE,
  to_end DATE,
  reason TEXT,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_membership_logs_membership_id
  ON public.membership_logs(membership_id);

CREATE INDEX IF NOT EXISTS idx_membership_logs_created_at
  ON public.membership_logs(created_at DESC);

ALTER TABLE public.membership_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "membership_logs_admin_all"
  ON public.membership_logs;

CREATE POLICY "membership_logs_admin_all"
  ON public.membership_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );

-- Step 2: Harden memberships RLS
DROP POLICY IF EXISTS "memberships_admin_all"
  ON public.memberships;

CREATE POLICY "memberships_admin_all"
  ON public.memberships
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );

-- Step 3: auto_issue_membership v2
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
            ARRAY[
              '에어바운스 / 키즈놀이터 / 모래놀이터 무료 이용',
              '동물 먹이주기 체험 무료',
              '하계철 수영장 무료 이용',
              '동계철 눈썰매장 할인권 제공',
              '전기 수도 농기구 무상 이용',
              '포코러쉬 풀빌라 할인권 제공'
            ]
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
          RAISE WARNING
            'auto_issue_membership failed for rental %: %',
            NEW.id,
            SQLERRM;
        END;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

-- Step 4: suspend_membership
CREATE OR REPLACE FUNCTION public.suspend_membership(
  p_membership_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_uid UUID;
  v_old_status TEXT;
BEGIN
  v_uid := auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT status INTO v_old_status
  FROM public.memberships
  WHERE id = p_membership_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND';
  END IF;

  IF v_old_status = 'cancelled' THEN
    RETURN;
  END IF;

  UPDATE public.memberships
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = p_membership_id;

  INSERT INTO public.membership_logs (
    membership_id,
    action,
    from_status,
    to_status,
    reason,
    changed_by
  ) VALUES (
    p_membership_id,
    'suspended',
    v_old_status,
    'cancelled',
    p_reason,
    v_uid
  );
END;
$func$;

-- Step 5: resume_membership
CREATE OR REPLACE FUNCTION public.resume_membership(
  p_membership_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_uid UUID;
  v_old_status TEXT;
  v_end_date DATE;
BEGIN
  v_uid := auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT status, end_date
    INTO v_old_status, v_end_date
  FROM public.memberships
  WHERE id = p_membership_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND';
  END IF;

  IF v_old_status = 'active' THEN
    RETURN;
  END IF;

  IF v_end_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'MEMBERSHIP_EXPIRED';
  END IF;

  UPDATE public.memberships
  SET status = 'active',
      updated_at = NOW()
  WHERE id = p_membership_id;

  INSERT INTO public.membership_logs (
    membership_id,
    action,
    from_status,
    to_status,
    changed_by
  ) VALUES (
    p_membership_id,
    'resumed',
    v_old_status,
    'active',
    v_uid
  );
END;
$func$;

-- Step 6: update_membership_period
CREATE OR REPLACE FUNCTION public.update_membership_period(
  p_membership_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_uid UUID;
  v_old_start DATE;
  v_old_end DATE;
BEGIN
  v_uid := auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_end_date <= p_start_date THEN
    RAISE EXCEPTION 'INVALID_PERIOD';
  END IF;

  SELECT start_date, end_date
    INTO v_old_start, v_old_end
  FROM public.memberships
  WHERE id = p_membership_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND';
  END IF;

  UPDATE public.memberships
  SET start_date = p_start_date,
      end_date = p_end_date,
      updated_at = NOW()
  WHERE id = p_membership_id;

  INSERT INTO public.membership_logs (
    membership_id,
    action,
    from_start,
    to_start,
    from_end,
    to_end,
    changed_by
  ) VALUES (
    p_membership_id,
    'period_updated',
    v_old_start,
    p_start_date,
    v_old_end,
    p_end_date,
    v_uid
  );
END;
$func$;

-- Step 7: issue_membership (manual)
CREATE OR REPLACE FUNCTION public.issue_membership(
  p_rental_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_uid UUID;
  v_farm_id UUID;
  v_customer_id UUID;
  v_rental_member_id UUID;
  v_plan TEXT;
  v_start_date DATE;
  v_end_date DATE;
  v_member_id UUID;
  v_code TEXT;
  v_plots INT;
  v_attempts INT := 0;
  v_new_id UUID;
BEGIN
  v_uid := auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT
    farm_id,
    customer_id,
    member_id,
    plan,
    start_date,
    end_date
  INTO
    v_farm_id,
    v_customer_id,
    v_rental_member_id,
    v_plan,
    v_start_date,
    v_end_date
  FROM public.farm_rentals
  WHERE id = p_rental_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RENTAL_NOT_FOUND';
  END IF;

  IF v_rental_member_id IS NOT NULL THEN
    v_member_id := v_rental_member_id;
  ELSE
    SELECT m.id INTO v_member_id
    FROM public.members m
    JOIN public.customers c ON m.phone = c.phone
    WHERE c.id = v_customer_id
    LIMIT 1;
  END IF;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'MEMBER_NOT_LINKED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.memberships
    WHERE member_id = v_member_id
      AND farm_id = v_farm_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'ALREADY_ISSUED';
  END IF;

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
  WHERE name = v_plan
  LIMIT 1;

  IF v_plots IS NULL THEN
    v_plots := CASE v_plan
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
    v_farm_id,
    v_plots,
    COALESCE(v_start_date, CURRENT_DATE),
    COALESCE(
      v_end_date,
      CURRENT_DATE + INTERVAL '1 year'
    ),
    'active',
    ARRAY[
      '에어바운스 / 키즈놀이터 / 모래놀이터 무료 이용',
      '동물 먹이주기 체험 무료',
      '하계철 수영장 무료 이용',
      '동계철 눈썰매장 할인권 제공',
      '전기 수도 농기구 무상 이용',
      '포코러쉬 풀빌라 할인권 제공'
    ]
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.membership_logs (
    membership_id,
    action,
    to_status,
    to_start,
    to_end,
    changed_by
  ) VALUES (
    v_new_id,
    'manual_issue',
    'active',
    v_start_date,
    v_end_date,
    v_uid
  );

  RETURN v_new_id;
END;
$func$;
