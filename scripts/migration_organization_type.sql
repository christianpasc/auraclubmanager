-- ============================================
-- Migration: Add organization_type to tenants
-- and features_school/features_club to stripe_plans
-- ============================================

-- 1. Add organization_type column to tenants
-- 'school' = Escolinha de Futebol, 'club' = Clube de Futebol
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS organization_type TEXT DEFAULT 'school'
  CHECK (organization_type IN ('school', 'club'));

-- 2. Add features_school and features_club to stripe_plans
ALTER TABLE public.stripe_plans
  ADD COLUMN IF NOT EXISTS features_school JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS features_club JSONB DEFAULT '[]'::jsonb;

-- ============================================
-- 3. Update create_own_tenant to accept organization_type
-- ============================================

CREATE OR REPLACE FUNCTION public.create_own_tenant(
  p_name TEXT,
  p_slug TEXT,
  p_organization_type TEXT DEFAULT 'school'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create the tenant
  INSERT INTO public.tenants (name, slug, organization_type)
  VALUES (p_name, p_slug, COALESCE(p_organization_type, 'school'))
  RETURNING id INTO v_tenant_id;

  -- Add user as owner
  INSERT INTO public.tenant_users (tenant_id, user_id, role, is_owner)
  VALUES (v_tenant_id, v_user_id, 'owner', true);

  -- Set as current tenant
  UPDATE public.profiles
  SET current_tenant_id = v_tenant_id
  WHERE id = v_user_id;

  RETURN json_build_object('id', v_tenant_id, 'name', p_name, 'slug', p_slug);
END;
$$;

-- ============================================
-- 4. Update admin_create_plan to include features_school and features_club
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
  p_max_athletes INTEGER DEFAULT NULL,
  p_features_school JSONB DEFAULT '[]'::jsonb,
  p_features_club JSONB DEFAULT '[]'::jsonb
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
    max_users, max_athletes, features_school, features_club
  ) VALUES (
    p_name, p_description, p_stripe_price_id_test, p_stripe_price_id_live,
    p_interval, p_price, p_currency, p_is_active, p_features, p_sort_order, p_is_popular,
    p_max_users, p_max_athletes, p_features_school, p_features_club
  )
  RETURNING * INTO v_plan;

  RETURN v_plan;
END;
$$;

-- ============================================
-- 5. Update admin_update_plan to include features_school and features_club
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
  p_max_athletes INTEGER DEFAULT -1,
  p_features_school JSONB DEFAULT NULL,
  p_features_club JSONB DEFAULT NULL
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
    features_school = COALESCE(p_features_school, features_school),
    features_club = COALESCE(p_features_club, features_club),
    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_plan;

  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;

  RETURN v_plan;
END;
$$;
