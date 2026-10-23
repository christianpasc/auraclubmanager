-- ============================================
-- Trial lifecycle emails — the dunning rail that was missing.
-- Trials were expiring with no email at all: 6 expired, 0 conversions.
--
-- One row per (tenant, stage) records a send, so the daily job is idempotent
-- and a tenant never gets the same nudge twice. Stages are windows, not exact
-- days, so a skipped run still catches up without double-sending.
-- Safe to re-run.
-- ============================================

CREATE TABLE IF NOT EXISTS public.trial_emails (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stage      text NOT NULL CHECK (stage IN ('d3', 'd1', 'expired', 'winback3', 'winback10')),
  sent_to    text,
  sent_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, stage)
);

ALTER TABLE public.trial_emails ENABLE ROW LEVEL SECURITY;

-- No policies: readable/writable only by the service role (the edge function).
-- Club members have no business reading the platform's own dunning log.

COMMENT ON TABLE public.trial_emails IS
  'Idempotency log for trial lifecycle emails. One row per tenant per stage.';

-- ────────────────────────────────────────────
-- Which clubs are due an email right now.
-- Owner email lives in auth.users, so this has to be SECURITY DEFINER; it is
-- revoked from anon/authenticated below and only the service role may call it.
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_trial_email_targets()
RETURNS TABLE (
  tenant_id      uuid,
  tenant_name    text,
  owner_email    text,
  owner_name     text,
  lang           text,
  trial_ends_at  timestamptz,
  days_left      integer,
  stage          text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH candidate AS (
    SELECT
      t.id,
      t.name,
      u.email::text                                  AS owner_email,
      COALESCE(p.full_name, '')                      AS owner_name,
      COALESCE(t.settings->>'language', p.language, 'pt-BR') AS lang,
      t.trial_ends_at,
      (t.trial_ends_at::date - CURRENT_DATE)         AS days_left
    FROM public.tenants t
    JOIN public.tenant_users tu ON tu.tenant_id = t.id AND tu.is_owner
    JOIN auth.users u           ON u.id = tu.user_id
    LEFT JOIN public.profiles p ON p.id = tu.user_id
    WHERE t.trial_ends_at IS NOT NULL
      -- Still on a trial: anyone who paid or cancelled is out of this rail.
      AND COALESCE(t.subscription_status, 'trial') NOT IN ('active', 'canceled')
      AND u.email IS NOT NULL
      -- Internal/test clubs owned by a platform admin never get dunned.
      AND COALESCE(p.is_super_admin, false) = false
  ),
  staged AS (
    SELECT c.*,
      CASE
        WHEN days_left BETWEEN  2 AND  3  THEN 'd3'
        WHEN days_left BETWEEN  0 AND  1  THEN 'd1'
        WHEN days_left BETWEEN -2 AND -1  THEN 'expired'
        WHEN days_left BETWEEN -7 AND -3  THEN 'winback3'
        WHEN days_left BETWEEN -20 AND -8 THEN 'winback10'
      END AS stage
    FROM candidate c
  )
  SELECT s.id, s.name, s.owner_email, s.owner_name, s.lang,
         s.trial_ends_at, s.days_left, s.stage
  FROM staged s
  WHERE s.stage IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.trial_emails te
      WHERE te.tenant_id = s.id AND te.stage = s.stage
    );
$$;

REVOKE ALL ON FUNCTION public.get_trial_email_targets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_trial_email_targets() TO service_role;
