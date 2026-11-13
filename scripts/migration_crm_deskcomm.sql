-- ============================================
-- Aura -> DeskcommCRM: trial leads, by webhook.
--
-- Leads sign up, the 7-day trial runs, the dunning emails go out -- and none
-- of it shows up anywhere a salesperson can work it. This sends each lead to
-- the CRM at three points in the life of the trial, and only when the person
-- consented to WhatsApp contact.
--
-- Nothing here touches access to the app. Signing up still returns a session
-- and drops the club straight into the onboarding wizard; the only thing that
-- happens for the CRM is one row in a queue, drained by a separate process.
--
-- Safe to re-run.
-- ============================================

-- ---------------------------------------------------------------
-- 1. Consent, and where the lead came from.
-- ---------------------------------------------------------------
-- Consent is personal, not the club's, so it lives on the profile. phone
-- already exists here and is reused.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_contact_consent_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_contact_consent_version TEXT,
  ADD COLUMN IF NOT EXISTS signup_utm                 JSONB;

COMMENT ON COLUMN public.profiles.ai_contact_consent_at IS
  'When the person agreed to be contacted on WhatsApp about their trial, including by a virtual assistant. NULL means no consent: the lead is never sent to the CRM.';
COMMENT ON COLUMN public.profiles.ai_contact_consent_version IS
  'Identifier of the consent wording that was actually shown and accepted, e.g. aura-trial-2026-11. Kept so a later rewording does not rewrite history.';
COMMENT ON COLUMN public.profiles.signup_utm IS
  'First-touch utm_source/utm_medium/utm_campaign captured from the URL at signup. Nothing captured these before.';

-- ---------------------------------------------------------------
-- 2. Carry the new fields in from signup metadata.
-- ---------------------------------------------------------------
-- Also pins search_path, which this function was missing (it shows up in the
-- Supabase security advisor as function_search_path_mutable).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, full_name, language, privacy_accepted_at,
    phone, ai_contact_consent_at, ai_contact_consent_version, signup_utm
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'language', 'pt-BR'),
    NULLIF(NEW.raw_user_meta_data->>'privacy_accepted_at', '')::timestamptz,
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'ai_contact_consent_at', '')::timestamptz,
    NULLIF(NEW.raw_user_meta_data->>'ai_contact_consent_version', ''),
    CASE
      WHEN jsonb_typeof(NEW.raw_user_meta_data->'signup_utm') = 'object'
      THEN NEW.raw_user_meta_data->'signup_utm'
    END
  );
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------
-- 3. The queue.
-- ---------------------------------------------------------------
-- A row records only WHAT HAPPENED, never the body that will be sent. The body
-- is built at send time from the lead's current name, phone and email, which is
-- what the CRM wants and what keeps the building logic testable outside the
-- database.

CREATE TABLE IF NOT EXISTS public.crm_outbox (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- No club exists yet at signup, so this is null for the first stage.
  tenant_id       UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  stage           TEXT NOT NULL CHECK (stage IN ('Em teste', 'Assinou', 'Teste encerrado')),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts        INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error      TEXT,
  response_status INT,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Each stage reaches the CRM at most once per lead, without relying on the
  -- CRM's own deduplication. It also caps the table at 3 rows per lead, which
  -- is why there is no purge job for it.
  CONSTRAINT crm_outbox_user_stage_key UNIQUE (user_id, stage)
);

COMMENT ON TABLE public.crm_outbox IS
  'Queue of trial lifecycle events owed to DeskcommCRM. Drained by the crm-outbox-drain edge function. Service role only.';

CREATE INDEX IF NOT EXISTS crm_outbox_due_idx
  ON public.crm_outbox (next_attempt_at)
  WHERE status = 'pending';

ALTER TABLE public.crm_outbox ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies: RLS with zero policies denies anon and
-- authenticated outright, and the edge function reaches it as service role.
-- Same shape as auth_email_tokens and trial_emails.

-- ---------------------------------------------------------------
-- 4. Enqueueing.
-- ---------------------------------------------------------------
-- Consent and a reachable number are the whole point of the integration:
-- without either there is nothing the CRM can do with the lead, and reaching
-- out would be wrong. This is the first of two places that check.

CREATE OR REPLACE FUNCTION public.enqueue_crm_event(
  p_user_id   UUID,
  p_tenant_id UUID,
  p_stage     TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inserted BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id
      AND ai_contact_consent_at IS NOT NULL
      AND NULLIF(btrim(COALESCE(phone, '')), '') IS NOT NULL
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.crm_outbox (user_id, tenant_id, stage)
  VALUES (p_user_id, p_tenant_id, p_stage)
  ON CONFLICT (user_id, stage) DO NOTHING
  RETURNING id INTO v_inserted;

  RETURN v_inserted IS NOT NULL;
END;
$$;

COMMENT ON FUNCTION public.enqueue_crm_event(UUID, UUID, TEXT) IS
  'Queues one CRM stage for a lead. Does nothing without consent, without a phone, or when that stage was already queued.';

-- ---------------------------------------------------------------
-- 5. Stage 1 -- the person signed up for the trial.
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.crm_enqueue_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.ai_contact_consent_at IS NOT NULL THEN
    BEGIN
      PERFORM public.enqueue_crm_event(NEW.id, NULL, 'Em teste');
    EXCEPTION WHEN OTHERS THEN
      -- This runs inside the transaction that creates the account. An account
      -- is worth more than a lead, so a problem here must never cost someone
      -- their signup.
      RAISE WARNING 'crm_enqueue_on_signup failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_enqueue_on_signup_trigger ON public.profiles;

CREATE TRIGGER crm_enqueue_on_signup_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_enqueue_on_signup();

-- ---------------------------------------------------------------
-- 6. Stages 2 and 3 -- subscribed, or cancelled.
-- ---------------------------------------------------------------
-- Both payment rails write tenants.subscription_status: stripe-webhook and
-- asaas-webhook. Watching the column catches both without either function
-- knowing the CRM exists.

CREATE OR REPLACE FUNCTION public.crm_enqueue_on_subscription_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner UUID;
  v_stage TEXT;
BEGIN
  v_stage := CASE NEW.subscription_status
               WHEN 'active'   THEN 'Assinou'
               WHEN 'canceled' THEN 'Teste encerrado'
             END;
  IF v_stage IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tu.user_id INTO v_owner
  FROM public.tenant_users tu
  WHERE tu.tenant_id = NEW.id AND tu.is_owner
  ORDER BY tu.created_at
  LIMIT 1;

  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.enqueue_crm_event(v_owner, NEW.id, v_stage);
  EXCEPTION WHEN OTHERS THEN
    -- Fires from inside a payment webhook. Losing the lead update is bad;
    -- losing the payment record is far worse.
    RAISE WARNING 'crm_enqueue_on_subscription_change failed for tenant %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_enqueue_on_subscription_change_trigger ON public.tenants;

CREATE TRIGGER crm_enqueue_on_subscription_change_trigger
  AFTER UPDATE OF subscription_status ON public.tenants
  FOR EACH ROW
  WHEN (OLD.subscription_status IS DISTINCT FROM NEW.subscription_status)
  EXECUTE FUNCTION public.crm_enqueue_on_subscription_change();

-- ---------------------------------------------------------------
-- 7. Stage 3, the time-based half -- the trial simply ran out.
-- ---------------------------------------------------------------
-- Nothing in the database changes when a trial expires, so this is a sweep.
-- Enqueueing is idempotent, so running it repeatedly is harmless.

CREATE OR REPLACE FUNCTION public.enqueue_crm_trial_endings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_queued INTEGER := 0;
  r        RECORD;
BEGIN
  -- Trial ran out without a subscription.
  FOR r IN
    SELECT tu.user_id, t.id AS tenant_id
    FROM public.tenants t
    JOIN public.tenant_users tu ON tu.tenant_id = t.id AND tu.is_owner
    WHERE t.trial_ends_at IS NOT NULL
      AND t.trial_ends_at < now()
      AND COALESCE(t.subscription_status, 'trial') NOT IN ('active', 'canceled')
  LOOP
    IF public.enqueue_crm_event(r.user_id, r.tenant_id, 'Teste encerrado') THEN
      v_queued := v_queued + 1;
    END IF;
  END LOOP;

  -- Signed up and never created a club. Both tenant-level exits are
  -- unreachable for these leads, so without this they would sit in "Em teste"
  -- forever. Closed after the same 7 days the trial would have lasted.
  FOR r IN
    SELECT p.id AS user_id
    FROM public.profiles p
    WHERE p.ai_contact_consent_at IS NOT NULL
      AND p.created_at < now() - INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.tenant_users tu WHERE tu.user_id = p.id
      )
  LOOP
    IF public.enqueue_crm_event(r.user_id, NULL, 'Teste encerrado') THEN
      v_queued := v_queued + 1;
    END IF;
  END LOOP;

  RETURN v_queued;
END;
$$;

COMMENT ON FUNCTION public.enqueue_crm_trial_endings() IS
  'Daily sweep: queues "Teste encerrado" for expired trials and for consented signups that never created a club. Called from pg_cron.';

-- ---------------------------------------------------------------
-- 8. What the drain reads.
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_crm_outbox(p_limit INTEGER DEFAULT 40)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH due AS (
    SELECT o.id
    FROM public.crm_outbox o
    WHERE o.status = 'pending'
      AND o.next_attempt_at <= now()
    ORDER BY o.next_attempt_at
    -- Two overlapping runs must never claim the same row and send twice.
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ),
  claimed AS (
    UPDATE public.crm_outbox o
    SET attempts        = o.attempts + 1,
        -- Pushed out before the request leaves, so a run that crashes
        -- mid-flight does not hand the row straight back to the next one.
        next_attempt_at = now() + INTERVAL '5 minutes',
        updated_at      = now()
    WHERE o.id IN (SELECT id FROM due)
    RETURNING o.id, o.user_id, o.tenant_id, o.stage, o.attempts
  )
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'id',        c.id,
      'user_id',   c.user_id,
      'tenant_id', c.tenant_id,
      'stage',     c.stage,
      'attempts',  c.attempts
    )),
    '[]'::jsonb
  )
  FROM claimed c;
$$;

COMMENT ON FUNCTION public.claim_crm_outbox(INTEGER) IS
  'Atomically claims up to p_limit due queue rows, bumping attempts and deferring them. Returns a JSON array for the drain function.';

CREATE OR REPLACE FUNCTION public.get_crm_lead(p_user_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  SELECT jsonb_build_object(
    'user_id',         p.id,
    'name',            COALESCE(NULLIF(btrim(p.full_name), ''), ''),
    'email',           u.email,
    'phone',           NULLIF(btrim(COALESCE(p.phone, '')), ''),
    'consent_at',      p.ai_contact_consent_at,
    'consent_version', p.ai_contact_consent_version,
    'utm',             p.signup_utm
  )
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = p_user_id;
$$;

COMMENT ON FUNCTION public.get_crm_lead(UUID) IS
  'The lead as the CRM should see it right now. Read by crm-outbox-drain, which re-checks consent before sending.';

-- ---------------------------------------------------------------
-- 9. Nothing here is for clients.
-- ---------------------------------------------------------------
-- These run as SECURITY DEFINER and would otherwise be callable over the API
-- by any logged-in user.

REVOKE ALL ON FUNCTION public.enqueue_crm_event(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_crm_trial_endings()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_crm_outbox(INTEGER)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_crm_lead(UUID)                   FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------
-- 10. Schedules.
-- ---------------------------------------------------------------
-- Same shape as the existing send-trial-emails-daily job: pg_net posting to
-- the edge function with the cron token out of the Vault. The token is reused
-- on purpose -- a missing secret is what kept the dunning rail silent for
-- weeks, and this adds no new one.

DO $$
BEGIN
  PERFORM cron.unschedule('crm-outbox-drain');
EXCEPTION WHEN OTHERS THEN
  NULL;  -- Not scheduled yet.
END
$$;

-- The WHERE EXISTS matters: a queue that is empty -- which is most minutes --
-- costs no function invocation and writes no log line. It also keeps the
-- schedule quiet while DESKCOMM_WEBHOOK_URL is still unset, instead of a 503
-- every sixty seconds.

SELECT cron.schedule(
  'crm-outbox-drain',
  '* * * * *',
  $cmd$
  SELECT net.http_post(
    url     := 'https://wlyvaaxbqxaidvcnjnht.supabase.co/functions/v1/crm-outbox-drain',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-token',  (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'trial_cron_token')
    ),
    body    := '{}'::jsonb
  )
  WHERE EXISTS (
    SELECT 1 FROM public.crm_outbox
    WHERE status = 'pending' AND next_attempt_at <= now()
  );
  $cmd$
);

-- The sweep is plain SQL, so cron calls it directly -- no HTTP, no token.
-- Five minutes after the dunning email job, so the two never interleave.

DO $$
BEGIN
  PERFORM cron.unschedule('crm-trial-endings-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END
$$;

SELECT cron.schedule(
  'crm-trial-endings-daily',
  '5 11 * * *',
  $cmd$ SELECT public.enqueue_crm_trial_endings(); $cmd$
);
