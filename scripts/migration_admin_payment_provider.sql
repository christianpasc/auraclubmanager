-- ============================================
-- Let a super admin move a club between payment rails, and show which rail
-- each club is on.
--
-- tenants.payment_provider wins over the country when it is set, which is what
-- keeps a club with a live Stripe setup from being yanked onto Asaas by a
-- stray country edit. The cost was that nothing in the UI could change it: an
-- owner switching their country to Brazil saw no effect and no explanation.
--
-- Passing 'auto' clears the column so the country decides again.
-- Safe to re-run.
-- ============================================

-- Adding the parameter creates an overload rather than replacing the function,
-- and a 5-argument call would silently hit the old body and ignore the
-- provider. Drop the legacy signature first.
DROP FUNCTION IF EXISTS public.admin_update_tenant(
  uuid, timestamp with time zone, text, text, text
);

CREATE OR REPLACE FUNCTION public.admin_update_tenant(
  p_tenant_id uuid,
  p_trial_ends_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_subscription_status text DEFAULT NULL::text,
  p_country text DEFAULT NULL::text,
  p_name text DEFAULT NULL::text,
  p_payment_provider text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_payment_provider IS NOT NULL
     AND p_payment_provider NOT IN ('stripe', 'asaas', 'auto') THEN
    RAISE EXCEPTION 'Invalid payment provider: %', p_payment_provider;
  END IF;

  UPDATE public.tenants
  SET
    trial_ends_at       = COALESCE(p_trial_ends_at, trial_ends_at),
    subscription_status = COALESCE(p_subscription_status, subscription_status),
    country             = COALESCE(p_country, country),
    name                = COALESCE(p_name, name),
    -- 'auto' means "no explicit choice": NULL hands the decision back to the
    -- country rule. NULL here means "leave it as it is".
    payment_provider    = CASE
                            WHEN p_payment_provider IS NULL  THEN payment_provider
                            WHEN p_payment_provider = 'auto' THEN NULL
                            ELSE p_payment_provider
                          END,
    updated_at = now()
  WHERE id = p_tenant_id;
END;
$function$;

-- ────────────────────────────────────────────
-- Surface the rail in the admin listing. Without it the admin screen could not
-- show, or edit, which provider a club bills through — so a club stuck on the
-- wrong rail was invisible. NULL means "decided by country".
-- ────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_admin_tenants();

CREATE OR REPLACE FUNCTION public.get_admin_tenants()
RETURNS TABLE(
  tenant_id uuid, tenant_name text, subscription_status text, subscription_plan text,
  created_at timestamp with time zone, trial_ends_at timestamp with time zone,
  owner_name text, owner_email character varying, owner_last_login timestamp with time zone,
  country text, payment_provider text, settings jsonb,
  athletes_count bigint, games_count bigint, trainings_count bigint,
  competitions_count bigint, total_activities bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    COALESCE(t.subscription_status, 'trial'),
    t.subscription_plan,
    t.created_at,
    t.trial_ends_at,
    p.full_name,
    u.email::VARCHAR,
    u.last_sign_in_at,
    COALESCE(t.country, 'BR'),
    t.payment_provider,
    COALESCE(t.settings, '{}'::jsonb),
    COUNT(DISTINCT a.id),
    COUNT(DISTINCT g.id),
    COUNT(DISTINCT tr.id),
    COUNT(DISTINCT c.id),
    COUNT(DISTINCT a.id) + COUNT(DISTINCT g.id) + COUNT(DISTINCT tr.id) + COUNT(DISTINCT c.id)
  FROM tenants t
  LEFT JOIN tenant_users tu ON t.id = tu.tenant_id AND tu.is_owner = true
  LEFT JOIN profiles p ON tu.user_id = p.id
  LEFT JOIN auth.users u ON p.id = u.id
  LEFT JOIN athletes a ON a.tenant_id = t.id
  LEFT JOIN games g ON g.tenant_id = t.id
  LEFT JOIN trainings tr ON tr.tenant_id = t.id
  LEFT JOIN competitions c ON c.tenant_id = t.id
  GROUP BY t.id, t.name, t.subscription_status, t.subscription_plan, t.created_at,
           t.trial_ends_at, p.full_name, u.email, u.last_sign_in_at, t.country,
           t.payment_provider, t.settings
  ORDER BY t.created_at DESC;
END;
$function$;
