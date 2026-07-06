-- ============================================
-- Migration: Privacy-policy compliance (LGPD/GDPR)
-- 1. profiles.privacy_accepted_at — records ToS/Privacy acceptance at signup
-- 2. athletes guardian-consent columns — mirrors the videos consent pattern
-- 3. deletion_requests — "request + admin executes" erasure flow
-- 4. pg_cron retention jobs — video_access_logs (13m), audit_log (24m),
--    and auto-queueing tenants closed for 90+ days for admin deletion
-- Safe to re-run (IF NOT EXISTS / conditional guards).
-- ============================================

-- ============================================
-- 1. Terms/Privacy acceptance
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;

-- Copy the acceptance timestamp from the signup metadata into the profile row
-- created by the existing on-signup trigger.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, language, privacy_accepted_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'language', 'pt-BR'),
    NULLIF(NEW.raw_user_meta_data->>'privacy_accepted_at', '')::timestamptz
  );
  RETURN NEW;
END;
$function$;

-- ============================================
-- 2. Guardian consent for minor athletes
-- ============================================

ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS guardian_consent_given BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guardian_consent_by UUID,
  ADD COLUMN IF NOT EXISTS guardian_consent_at TIMESTAMPTZ;

-- ============================================
-- 3. deletion_requests
-- ============================================

CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  requested_by UUID,                       -- NULL = queued automatically by the retention job
  request_type TEXT NOT NULL CHECK (request_type IN ('account', 'tenant')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID
);

-- SET NULL (not CASCADE): the request row must survive the tenant deletion it
-- documents, as the LGPD/GDPR audit trail of the erasure itself.
ALTER TABLE public.deletion_requests
  DROP CONSTRAINT IF EXISTS deletion_requests_tenant_id_fkey,
  ADD CONSTRAINT deletion_requests_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON public.deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_tenant ON public.deletion_requests(tenant_id);

ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can create deletion requests" ON public.deletion_requests;
CREATE POLICY "Members can create deletion requests"
  ON public.deletion_requests
  FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND (
      tenant_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.tenant_users
        WHERE tenant_users.tenant_id = deletion_requests.tenant_id
          AND tenant_users.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Members can read own tenant deletion requests" ON public.deletion_requests;
CREATE POLICY "Members can read own tenant deletion requests"
  ON public.deletion_requests
  FOR SELECT
  USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = deletion_requests.tenant_id
        AND tenant_users.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Super admins manage deletion requests" ON public.deletion_requests;
CREATE POLICY "Super admins manage deletion requests"
  ON public.deletion_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_super_admin = true
    )
  );

-- Marks a request processed (completed/cancelled). The actual data wipe is done
-- by the admin-delete-tenant edge function (service role); this RPC only
-- transitions the request record with the standard super-admin guard.
CREATE OR REPLACE FUNCTION public.admin_process_deletion_request(
  p_id UUID,
  p_status TEXT
)
RETURNS public.deletion_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.deletion_requests;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a super admin';
  END IF;

  IF p_status NOT IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.deletion_requests SET
    status = p_status,
    processed_at = now(),
    processed_by = auth.uid()
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Deletion request not found';
  END IF;

  RETURN v_row;
END;
$$;

-- ============================================
-- 4. Retention jobs (pg_cron)
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Re-schedule idempotently: unschedule existing jobs with our names first.
DO $$
DECLARE
  v_job RECORD;
BEGIN
  FOR v_job IN
    SELECT jobid FROM cron.job
    WHERE jobname IN ('purge_video_access_logs', 'purge_audit_log', 'queue_expired_tenant_deletions')
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;
END;
$$;

-- Video access logs: policy retention 13 months (monthly, 1st day 03:00 UTC)
SELECT cron.schedule(
  'purge_video_access_logs',
  '0 3 1 * *',
  $$DELETE FROM public.video_access_logs WHERE accessed_at < now() - interval '13 months'$$
);

-- Admin audit log: 24 months (monthly, 1st day 03:10 UTC)
SELECT cron.schedule(
  'purge_audit_log',
  '10 3 1 * *',
  $$DELETE FROM public.audit_log WHERE created_at < now() - interval '24 months'$$
);

-- Surfaces the scheduled retention jobs in the admin "Saúde & Jobs" page.
CREATE OR REPLACE FUNCTION public.admin_get_cron_jobs()
RETURNS TABLE (
  jobname TEXT,
  schedule TEXT,
  active BOOLEAN,
  last_run_started_at TIMESTAMPTZ,
  last_run_status TEXT
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
  SELECT j.jobname::text, j.schedule::text, j.active,
         d.start_time, d.status::text
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT jrd.start_time, jrd.status
    FROM cron.job_run_details jrd
    WHERE jrd.jobid = j.jobid
    ORDER BY jrd.start_time DESC
    LIMIT 1
  ) d ON true
  ORDER BY j.jobname;
END;
$$;

-- Tenants closed (expired/canceled) for 90+ days: queue a system deletion
-- request for the super admin to execute — never deletes on its own.
-- (daily 03:20 UTC)
SELECT cron.schedule(
  'queue_expired_tenant_deletions',
  '20 3 * * *',
  $$
  INSERT INTO public.deletion_requests (tenant_id, requested_by, request_type, reason, status)
  SELECT t.id, NULL, 'tenant',
         'Automático: assinatura encerrada há mais de 90 dias (política de retenção)',
         'pending'
  FROM public.tenants t
  WHERE t.subscription_status IN ('expired', 'canceled')
    AND t.updated_at < now() - interval '90 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.deletion_requests dr
      WHERE dr.tenant_id = t.id AND dr.request_type = 'tenant' AND dr.status IN ('pending', 'completed')
    )
  $$
);
