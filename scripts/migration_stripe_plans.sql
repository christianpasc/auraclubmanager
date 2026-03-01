-- ============================================
-- Migration: Create stripe_plans table
-- ============================================

-- Tabela de planos gerenciados pelo admin
CREATE TABLE IF NOT EXISTS public.stripe_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  stripe_price_id_test TEXT,        -- Stripe Price ID para modo teste (pk_test_...)
  stripe_price_id_live TEXT,        -- Stripe Price ID para modo produção (pk_live_...)
  interval TEXT NOT NULL CHECK (interval IN ('monthly', 'quarterly', 'yearly', 'lifetime')),
  price NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'brl',
  is_active BOOLEAN DEFAULT true,
  features JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER DEFAULT 0,
  is_popular BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.stripe_plans ENABLE ROW LEVEL SECURITY;

-- Policy: qualquer um pode ler planos ativos (para a página de planos)
CREATE POLICY "Anyone can read active plans"
  ON public.stripe_plans
  FOR SELECT
  USING (is_active = true);

-- Policy: super admins podem fazer tudo
CREATE POLICY "Super admins can manage plans"
  ON public.stripe_plans
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

-- ============================================
-- Migration: Add subscription fields to tenants
-- ============================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_plan_id UUID REFERENCES public.stripe_plans(id),
  ADD COLUMN IF NOT EXISTS subscription_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

-- ============================================
-- RPC: Admin - Get all plans (bypass RLS)
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_get_all_plans()
RETURNS SETOF public.stripe_plans
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.stripe_plans ORDER BY sort_order ASC, created_at ASC;
$$;

-- ============================================
-- RPC: Public - Get active plans
-- ============================================

CREATE OR REPLACE FUNCTION public.get_active_plans()
RETURNS SETOF public.stripe_plans
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.stripe_plans WHERE is_active = true ORDER BY sort_order ASC, created_at ASC;
$$;

-- ============================================
-- RPC: Admin - Create plan
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
  p_is_popular BOOLEAN DEFAULT false
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
    interval, price, currency, is_active, features, sort_order, is_popular
  ) VALUES (
    p_name, p_description, p_stripe_price_id_test, p_stripe_price_id_live,
    p_interval, p_price, p_currency, p_is_active, p_features, p_sort_order, p_is_popular
  )
  RETURNING * INTO v_plan;

  RETURN v_plan;
END;
$$;

-- ============================================
-- RPC: Admin - Update plan
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
  p_is_popular BOOLEAN DEFAULT NULL
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
-- RPC: Admin - Toggle plan active status
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_toggle_plan(p_id UUID, p_is_active BOOLEAN)
RETURNS public.stripe_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.stripe_plans;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a super admin';
  END IF;

  UPDATE public.stripe_plans
  SET is_active = p_is_active, updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_plan;

  RETURN v_plan;
END;
$$;

-- ============================================
-- RPC: Admin - Delete plan
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_delete_plan(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a super admin';
  END IF;

  DELETE FROM public.stripe_plans WHERE id = p_id;
END;
$$;
