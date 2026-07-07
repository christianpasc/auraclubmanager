-- ============================================
-- Migration: Asaas Fase 2 — Aura plan billing via the root account
-- - tenants.asaas_customer_id / asaas_subscription_id: the club's customer &
--   subscription in the Asaas ROOT account (Aura charging the club its plan)
-- - stripe_plans.price_brl: BRL price used for the Asaas rail (the existing
--   `price` column is USD for the Stripe/international rail). Asaas charges in
--   BRL only, so a plan without price_brl cannot be billed via Asaas.
-- - admin_create_plan / admin_update_plan gain p_price_brl (added last).
-- Safe to re-run.
-- ============================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT;

ALTER TABLE public.stripe_plans
  ADD COLUMN IF NOT EXISTS price_brl NUMERIC;

-- Recreate the admin RPCs with a trailing p_price_brl parameter.
DROP FUNCTION IF EXISTS public.admin_create_plan(text, text, text, text, text, numeric, text, boolean, jsonb, integer, boolean, integer, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.admin_update_plan(uuid, text, text, text, text, text, numeric, text, boolean, jsonb, integer, boolean, integer, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.admin_create_plan(
  p_name text,
  p_description text DEFAULT NULL,
  p_stripe_price_id_test text DEFAULT NULL,
  p_stripe_price_id_live text DEFAULT NULL,
  p_interval text DEFAULT 'monthly',
  p_price numeric DEFAULT 0,
  p_currency text DEFAULT 'brl',
  p_is_active boolean DEFAULT true,
  p_features jsonb DEFAULT '[]'::jsonb,
  p_sort_order integer DEFAULT 0,
  p_is_popular boolean DEFAULT false,
  p_max_users integer DEFAULT NULL,
  p_max_athletes integer DEFAULT NULL,
  p_features_school jsonb DEFAULT '[]'::jsonb,
  p_features_club jsonb DEFAULT '[]'::jsonb,
  p_name_i18n jsonb DEFAULT '{}'::jsonb,
  p_description_i18n jsonb DEFAULT '{}'::jsonb,
  p_features_i18n jsonb DEFAULT '{}'::jsonb,
  p_features_school_i18n jsonb DEFAULT '{}'::jsonb,
  p_features_club_i18n jsonb DEFAULT '{}'::jsonb,
  p_price_brl numeric DEFAULT NULL
)
RETURNS public.stripe_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan public.stripe_plans;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized: not a super admin';
  END IF;

  INSERT INTO public.stripe_plans (
    name, description, stripe_price_id_test, stripe_price_id_live,
    interval, price, currency, is_active, features, sort_order, is_popular,
    max_users, max_athletes, features_school, features_club,
    name_i18n, description_i18n, features_i18n, features_school_i18n, features_club_i18n,
    price_brl
  ) VALUES (
    p_name, p_description, p_stripe_price_id_test, p_stripe_price_id_live,
    p_interval, p_price, p_currency, p_is_active, p_features, p_sort_order, p_is_popular,
    p_max_users, p_max_athletes, p_features_school, p_features_club,
    p_name_i18n, p_description_i18n, p_features_i18n, p_features_school_i18n, p_features_club_i18n,
    p_price_brl
  )
  RETURNING * INTO v_plan;

  RETURN v_plan;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_plan(
  p_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_stripe_price_id_test text DEFAULT NULL,
  p_stripe_price_id_live text DEFAULT NULL,
  p_interval text DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_is_active boolean DEFAULT NULL,
  p_features jsonb DEFAULT NULL,
  p_sort_order integer DEFAULT NULL,
  p_is_popular boolean DEFAULT NULL,
  p_max_users integer DEFAULT -1,
  p_max_athletes integer DEFAULT -1,
  p_features_school jsonb DEFAULT NULL,
  p_features_club jsonb DEFAULT NULL,
  p_name_i18n jsonb DEFAULT NULL,
  p_description_i18n jsonb DEFAULT NULL,
  p_features_i18n jsonb DEFAULT NULL,
  p_features_school_i18n jsonb DEFAULT NULL,
  p_features_club_i18n jsonb DEFAULT NULL,
  p_price_brl numeric DEFAULT -1
)
RETURNS public.stripe_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan public.stripe_plans;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized: not a super admin';
  END IF;

  UPDATE public.stripe_plans SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    stripe_price_id_test = COALESCE(p_stripe_price_id_test, stripe_price_id_test),
    stripe_price_id_live = COALESCE(p_stripe_price_id_live, stripe_price_id_live),
    interval = COALESCE(p_interval, interval),
    price = COALESCE(p_price, price),
    currency = COALESCE(p_currency, currency),
    is_active = COALESCE(p_is_active, is_active),
    features = COALESCE(p_features, features),
    sort_order = COALESCE(p_sort_order, sort_order),
    is_popular = COALESCE(p_is_popular, is_popular),
    max_users = CASE WHEN p_max_users = -1 THEN max_users ELSE p_max_users END,
    max_athletes = CASE WHEN p_max_athletes = -1 THEN max_athletes ELSE p_max_athletes END,
    features_school = COALESCE(p_features_school, features_school),
    features_club = COALESCE(p_features_club, features_club),
    name_i18n = COALESCE(p_name_i18n, name_i18n),
    description_i18n = COALESCE(p_description_i18n, description_i18n),
    features_i18n = COALESCE(p_features_i18n, features_i18n),
    features_school_i18n = COALESCE(p_features_school_i18n, features_school_i18n),
    features_club_i18n = COALESCE(p_features_club_i18n, features_club_i18n),
    price_brl = CASE WHEN p_price_brl = -1 THEN price_brl ELSE p_price_brl END,
    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_plan;

  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;

  RETURN v_plan;
END;
$function$;
