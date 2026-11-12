-- ============================================
-- Aura owns its own authentication emails.
--
-- Until now the signup confirmation and the password reset were sent by
-- Supabase Auth: its branding, its subject lines, one language only, and
-- through the built-in email service, which is capped at a handful of messages
-- per hour and is not meant for production. Two signups in auth.users never
-- confirmed at all.
--
-- Supabase's "Confirm email" setting gets turned off so a new club lands
-- straight inside the app. That has a consequence this migration exists to
-- absorb: with the setting off, GoTrue stamps auth.users.email_confirmed_at at
-- signup, so that column stops meaning "this person proved they own the
-- address". We therefore keep our own flag.
--
-- Safe to re-run.
-- ============================================

-- ---------------------------------------------------------------
-- 1. The new source of truth for "this address was proven".
-- ---------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.email_verified_at IS
  'When the user proved ownership of their email by clicking our verification link. Set by the verify-email function. NOT auth.users.email_confirmed_at, which GoTrue fills in automatically once "Confirm email" is off.';

-- Backfill from the Supabase flag BEFORE the setting is turned off, while it
-- still carries meaning. Without this every existing user would be shown the
-- "confirm your email" notice despite having confirmed long ago.
UPDATE public.profiles p
SET email_verified_at = u.email_confirmed_at
FROM auth.users u
WHERE u.id = p.id
  AND u.email_confirmed_at IS NOT NULL
  AND p.email_verified_at IS NULL;

-- ---------------------------------------------------------------
-- 2. Verification tokens.
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.auth_email_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose     TEXT NOT NULL CHECK (purpose IN ('email_verification')),
  -- Only the SHA-256 of the token is stored. A dump of this table yields
  -- nothing usable: the token itself exists solely inside the email.
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.auth_email_tokens IS
  'Single-use, expiring tokens for Aura-sent authentication emails. Stores a SHA-256 hash, never the token. Service role only.';

CREATE INDEX IF NOT EXISTS auth_email_tokens_user_purpose_idx
  ON public.auth_email_tokens (user_id, purpose, created_at DESC);

ALTER TABLE public.auth_email_tokens ENABLE ROW LEVEL SECURITY;

-- Deliberately no policies. RLS enabled with zero policies denies every
-- anon/authenticated request; the edge functions reach it as service role,
-- which bypasses RLS. A token must never be readable by a client.

-- ---------------------------------------------------------------
-- 3. Send throttle.
-- ---------------------------------------------------------------
-- send-password-reset has to be callable without a session, so it is a public
-- endpoint that sends mail to an address chosen by the caller. Unthrottled,
-- that is an open email relay pointed at anyone. Keyed by email rather than
-- user id because the reset path must not reveal whether the account exists.

CREATE TABLE IF NOT EXISTS public.auth_email_throttle (
  id      BIGSERIAL PRIMARY KEY,
  email   TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('email_verification', 'password_reset')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.auth_email_throttle IS
  'One row per authentication email dispatched, used to rate-limit the public send endpoints. Service role only.';

-- Addresses are lowercased before insert, and the functions look them up the
-- same way, so a plain column index is what the planner can actually use —
-- an expression index on lower(email) would be ignored by `email = $1`.
CREATE INDEX IF NOT EXISTS auth_email_throttle_lookup_idx
  ON public.auth_email_throttle (email, purpose, sent_at DESC);

ALTER TABLE public.auth_email_throttle ENABLE ROW LEVEL SECURITY;
-- No policies, same reasoning as above.

-- ---------------------------------------------------------------
-- 4. Housekeeping.
-- ---------------------------------------------------------------
-- Both tables are append-only and would otherwise grow without bound. Spent
-- tokens and old throttle rows have no value once past their window.

CREATE OR REPLACE FUNCTION public.purge_auth_email_records()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.auth_email_tokens
  WHERE expires_at < now() - INTERVAL '7 days';

  DELETE FROM public.auth_email_throttle
  WHERE sent_at < now() - INTERVAL '7 days';
$$;

COMMENT ON FUNCTION public.purge_auth_email_records() IS
  'Drops expired verification tokens and stale throttle rows. Call from pg_cron.';

REVOKE ALL ON FUNCTION public.purge_auth_email_records() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_auth_email_records() FROM anon, authenticated;
