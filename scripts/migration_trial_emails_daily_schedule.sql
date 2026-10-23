-- ============================================
-- Daily schedule for the trial lifecycle emails.
--
-- pg_cron can only run SQL, so the HTTP call to the edge function goes through
-- pg_net. The shared token lives in Vault rather than inline in cron.job, so
-- it is not readable from the job listing.
--
-- BEFORE RUNNING: replace the placeholder below with a freshly generated token
-- (`openssl rand -base64 24`), and set the SAME value as the TRIAL_CRON_TOKEN
-- edge function secret. Never commit the real value.
-- Safe to re-run — it rotates the secret and re-schedules the job.
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Store (or rotate) the token the edge function checks.
DO $$
DECLARE
  v_token text := 'REPLACE_WITH_TRIAL_CRON_TOKEN';
BEGIN
  IF v_token = 'REPLACE_WITH_TRIAL_CRON_TOKEN' THEN
    RAISE EXCEPTION 'Set a real token before running this migration';
  END IF;

  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'trial_cron_token') THEN
    PERFORM vault.update_secret(
      (SELECT id FROM vault.secrets WHERE name = 'trial_cron_token'),
      v_token
    );
  ELSE
    PERFORM vault.create_secret(
      v_token,
      'trial_cron_token',
      'Shared token for send-trial-emails; must match the TRIAL_CRON_TOKEN edge function secret.'
    );
  END IF;
END $$;

-- 11:00 UTC = 08:00 in Brasília, so the nudge lands at the start of the
-- recipient's working day rather than overnight.
SELECT cron.unschedule('send-trial-emails-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-trial-emails-daily');

SELECT cron.schedule(
  'send-trial-emails-daily',
  '0 11 * * *',
  $job$
  SELECT net.http_post(
    url     := 'https://wlyvaaxbqxaidvcnjnht.supabase.co/functions/v1/send-trial-emails',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-token',  (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'trial_cron_token')
    ),
    body    := '{}'::jsonb
  );
  $job$
);
