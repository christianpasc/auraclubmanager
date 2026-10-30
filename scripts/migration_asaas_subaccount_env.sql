-- ============================================
-- Record which Asaas environment a club's subaccount belongs to.
--
-- Sandbox and production share this database, and a subaccount's API key is
-- only valid in the environment that issued it. Without this marker a club
-- that created its account in sandbox would look ready to charge in
-- production, then fail authentication against api.asaas.com with nothing on
-- screen explaining why.
--
-- asaas-club-checkout and public-invoice-pay compare this against the request
-- environment and refuse the charge when they disagree.
--
-- Existing rows are backfilled to 'production': production is the safer
-- assumption for anything created before this column existed.
-- Safe to re-run.
-- ============================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS asaas_subaccount_env TEXT
    CHECK (asaas_subaccount_env IN ('sandbox', 'production'));

COMMENT ON COLUMN public.tenants.asaas_subaccount_env IS
  'Asaas environment that issued asaas_subaccount_api_key_encrypted. Charging refuses to run when it does not match the request environment.';

UPDATE public.tenants
SET asaas_subaccount_env = 'production'
WHERE asaas_subaccount_id IS NOT NULL
  AND asaas_subaccount_env IS NULL;
