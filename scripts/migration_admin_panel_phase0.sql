-- ============================================
-- Migration: Admin Panel restructure — Phase 0
-- Adds: color_palettes, webhook_events, platform_settings, audit_log
-- Adds: tenants.palette_id
-- Adds RPCs: admin_create_palette, admin_update_palette, admin_delete_palette,
--            get_platform_setting, admin_set_platform_setting,
--            log_admin_action, admin_get_all_users
-- Apply manually via Supabase Studio SQL editor (or `supabase db push`
-- once the MCP connection is restored). Safe to re-run (IF NOT EXISTS guards).
-- ============================================

-- ============================================
-- 1. color_palettes
-- ============================================

CREATE TABLE IF NOT EXISTS public.color_palettes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  colors JSONB NOT NULL DEFAULT '{}'::jsonb, -- { primary, secondary, accent, ... }
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.color_palettes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active palettes"
  ON public.color_palettes
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Super admins can manage palettes"
  ON public.color_palettes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_super_admin = true
    )
  );

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS palette_id UUID REFERENCES public.color_palettes(id);

CREATE OR REPLACE FUNCTION public.admin_create_palette(
  p_name TEXT,
  p_colors JSONB,
  p_sort_order INTEGER DEFAULT 0
)
RETURNS public.color_palettes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.color_palettes;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a super admin';
  END IF;

  INSERT INTO public.color_palettes (name, colors, sort_order)
  VALUES (p_name, p_colors, p_sort_order)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_palette(
  p_id UUID,
  p_name TEXT DEFAULT NULL,
  p_colors JSONB DEFAULT NULL,
  p_sort_order INTEGER DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS public.color_palettes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.color_palettes;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a super admin';
  END IF;

  UPDATE public.color_palettes SET
    name = COALESCE(p_name, name),
    colors = COALESCE(p_colors, colors),
    sort_order = COALESCE(p_sort_order, sort_order),
    is_active = COALESCE(p_is_active, is_active),
    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Palette not found';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_palette(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a super admin';
  END IF;

  -- Tenants pointing at this palette fall back to no palette rather than failing.
  UPDATE public.tenants SET palette_id = NULL WHERE palette_id = p_id;
  DELETE FROM public.color_palettes WHERE id = p_id;
END;
$$;

-- ============================================
-- 2. webhook_events — feed for "Notificações Stripe"
-- Populated by stripe-webhook / club-webhook edge functions (separate deploy step).
-- ============================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,            -- 'stripe-webhook' | 'club-webhook'
  event_type TEXT NOT NULL,        -- e.g. 'invoice.payment_failed'
  tenant_id UUID REFERENCES public.tenants(id),
  status TEXT NOT NULL DEFAULT 'processed', -- 'processed' | 'failed'
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events (created_at DESC);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read webhook events"
  ON public.webhook_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_super_admin = true
    )
  );

-- Edge functions write via the service role key, which bypasses RLS — no insert policy needed.

-- ============================================
-- 3. platform_settings — key/value store (chat widget, maintenance mode, ...)
-- ============================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- No direct table policies: all access goes through the two RPCs below
-- (get_platform_setting is callable by anon/authenticated; the admin one checks is_super_admin).

CREATE OR REPLACE FUNCTION public.get_platform_setting(p_key TEXT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.platform_settings WHERE key = p_key;
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_setting(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_platform_setting(p_key TEXT, p_value JSONB)
RETURNS public.platform_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.platform_settings;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a super admin';
  END IF;

  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES (p_key, p_value, now())
  ON CONFLICT (key) DO UPDATE SET value = p_value, updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ============================================
-- 4. audit_log
-- ============================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,           -- e.g. 'tenant.update', 'plan.create'
  target_type TEXT,               -- e.g. 'tenant', 'stripe_plan'
  target_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read audit log"
  ON public.audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_super_admin = true
    )
  );

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS public.audit_log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.audit_log;
  v_email TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a super admin';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.audit_log (actor_user_id, actor_email, action, target_type, target_id, details)
  VALUES (auth.uid(), v_email, p_action, p_target_type, p_target_id, p_details)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ============================================
-- 5. admin_get_all_users — platform-wide user directory
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_get_all_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  is_super_admin BOOLEAN,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  memberships JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a super admin';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email,
    p.full_name,
    p.avatar_url,
    COALESCE(p.is_super_admin, false) AS is_super_admin,
    u.last_sign_in_at,
    u.created_at,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'tenant_id', tu.tenant_id,
          'tenant_name', t.name,
          'role', tu.role,
          'is_owner', tu.is_owner
        ))
        FROM public.tenant_users tu
        JOIN public.tenants t ON t.id = tu.tenant_id
        WHERE tu.user_id = u.id
      ),
      '[]'::jsonb
    ) AS memberships
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;
