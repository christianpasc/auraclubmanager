-- ============================================
-- Migration: Add max_users and max_athletes to stripe_plans
-- NULL = unlimited
-- ============================================

-- 1. Add new columns
ALTER TABLE public.stripe_plans
  ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_athletes INTEGER DEFAULT NULL;

-- ============================================
-- 2. Update admin_create_plan RPC
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_create_plan(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_stripe_price_id_test TEXT DEFAULT NULL,
  p_stripe_price_id_live TEXT DEFAULT NULL,
  p_interval TEXT DEFAULT 'monthly',
  p_price NUMERIC DEFAULT 0,
  p_currency TEXT DEFAULT 'brl',
  p_is_active BOOLEAN DEFAULT true,
  p_features JSONB DEFAULT '[]'::jsonb,
  p_sort_order INTEGER DEFAULT 0,
  p_is_popular BOOLEAN DEFAULT false,
  p_max_users INTEGER DEFAULT NULL,
  p_max_athletes INTEGER DEFAULT NULL
)
RETURNS public.stripe_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.stripe_plans;
BEGIN
  -- Check if caller is super admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a super admin';
  END IF;

  INSERT INTO public.stripe_plans (
    name, description, stripe_price_id_test, stripe_price_id_live,
    interval, price, currency, is_active, features, sort_order, is_popular,
    max_users, max_athletes
  ) VALUES (
    p_name, p_description, p_stripe_price_id_test, p_stripe_price_id_live,
    p_interval, p_price, p_currency, p_is_active, p_features, p_sort_order, p_is_popular,
    p_max_users, p_max_athletes
  )
  RETURNING * INTO v_plan;

  RETURN v_plan;
END;
$$;

-- ============================================
-- 3. Update admin_update_plan RPC
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_update_plan(
  p_id UUID,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_stripe_price_id_test TEXT DEFAULT NULL,
  p_stripe_price_id_live TEXT DEFAULT NULL,
  p_interval TEXT DEFAULT NULL,
  p_price NUMERIC DEFAULT NULL,
  p_currency TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL,
  p_features JSONB DEFAULT NULL,
  p_sort_order INTEGER DEFAULT NULL,
  p_is_popular BOOLEAN DEFAULT NULL,
  p_max_users INTEGER DEFAULT -1,
  p_max_athletes INTEGER DEFAULT -1
)
RETURNS public.stripe_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.stripe_plans;
BEGIN
  -- Check if caller is super admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
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
    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_plan;

  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;

  RETURN v_plan;
END;
$$;

-- ============================================
-- 4. Create check_plan_limits RPC
-- Returns the current plan limits and usage counts for a tenant
-- ============================================

CREATE OR REPLACE FUNCTION public.check_plan_limits(p_tenant_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id UUID;
  v_max_users INTEGER;
  v_max_athletes INTEGER;
  v_current_users INTEGER;
  v_current_athletes INTEGER;
  v_has_active_subscription BOOLEAN;
  v_subscription_ends_at TIMESTAMPTZ;
BEGIN
  -- Get tenant's active plan
  SELECT subscription_plan_id, subscription_ends_at
  INTO v_plan_id, v_subscription_ends_at
  FROM public.tenants
  WHERE id = p_tenant_id;

  -- Check if subscription is active
  v_has_active_subscription := v_plan_id IS NOT NULL 
    AND v_subscription_ends_at IS NOT NULL 
    AND v_subscription_ends_at > now();

  -- Get plan limits
  IF v_has_active_subscription THEN
    SELECT max_users, max_athletes
    INTO v_max_users, v_max_athletes
    FROM public.stripe_plans
    WHERE id = v_plan_id;
  ELSE
    -- No active subscription: return nulls (will be treated as unlimited during trial)
    v_max_users := NULL;
    v_max_athletes := NULL;
  END IF;

  -- Count current athletes for this tenant
  SELECT COUNT(*)::INTEGER
  INTO v_current_athletes
  FROM public.athletes
  WHERE tenant_id = p_tenant_id;

  -- Count current users for this tenant
  SELECT COUNT(*)::INTEGER
  INTO v_current_users
  FROM public.tenant_users
  WHERE tenant_id = p_tenant_id;

  RETURN json_build_object(
    'max_users', v_max_users,
    'max_athletes', v_max_athletes,
    'current_users', v_current_users,
    'current_athletes', v_current_athletes,
    'has_active_subscription', v_has_active_subscription,
    'can_add_user', CASE 
      WHEN NOT v_has_active_subscription THEN true
      WHEN v_max_users IS NULL THEN true 
      ELSE v_current_users < v_max_users 
    END,
    'can_add_athlete', CASE 
      WHEN NOT v_has_active_subscription THEN true
      WHEN v_max_athletes IS NULL THEN true 
      ELSE v_current_athletes < v_max_athletes 
    END
  );
END;
$$;
