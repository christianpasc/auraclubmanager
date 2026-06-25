-- ============================================
-- Migration: Admin Panel — Phase 2 (Stripe overview RPC)
-- Apply manually via Supabase Studio SQL editor.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_admin_stripe_overview()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_connect_active INT;
  v_connect_total INT;
  v_saas_active INT;
  v_saas_trial INT;
  v_saas_past_due INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a super admin';
  END IF;

  SELECT
    count(*) FILTER (WHERE stripe_connect_charges_enabled = true),
    count(*) FILTER (WHERE stripe_connect_account_id IS NOT NULL),
    count(*) FILTER (WHERE subscription_status = 'active'),
    count(*) FILTER (WHERE subscription_status = 'trial'),
    count(*) FILTER (WHERE subscription_status = 'past_due')
  INTO v_connect_active, v_connect_total, v_saas_active, v_saas_trial, v_saas_past_due
  FROM public.tenants;

  RETURN json_build_object(
    'connect_active', v_connect_active,
    'connect_total', v_connect_total,
    'saas_active', v_saas_active,
    'saas_trial', v_saas_trial,
    'saas_past_due', v_saas_past_due
  );
END;
$$;
