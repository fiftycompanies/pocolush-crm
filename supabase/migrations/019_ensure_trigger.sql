-- Migration 019: ensure trg_auto_issue_membership exists
-- The trigger was dropped/missing in the deployed DB despite migration 015 defining it.
-- This migration re-creates it idempotently.

DROP TRIGGER IF EXISTS trg_auto_issue_membership ON public.farm_rentals;

CREATE TRIGGER trg_auto_issue_membership
  AFTER UPDATE ON public.farm_rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_issue_membership();
