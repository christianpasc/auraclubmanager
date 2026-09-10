-- Onboarding: backfill existing tenants as already onboarded.
--
-- The onboarding gate (App.tsx > OnboardingGate) sends any tenant without
-- settings.onboarding.completed_at through the setup wizard. Every organization
-- that existed before the wizard shipped has already been set up by hand, so
-- without this backfill they would all be interrupted on their next login.
--
-- RUN THIS BEFORE DEPLOYING the new gate. It is idempotent: rows that already
-- carry a completed_at are left untouched.

UPDATE public.tenants
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
        'onboarding', jsonb_build_object(
            'version',             1,
            'current_step',        5,          -- index of the last step ('how-it-works')
            'completed_at',        to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'skipped_steps',       '[]'::jsonb,
            'checklist_dismissed', false       -- the checklist still greets them; it is not blocking
        )
    )
WHERE settings -> 'onboarding' ->> 'completed_at' IS NULL;

-- Verification: expect 0 rows still pending.
SELECT count(*) AS tenants_still_pending_onboarding
FROM public.tenants
WHERE settings -> 'onboarding' ->> 'completed_at' IS NULL;
