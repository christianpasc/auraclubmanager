-- ============================================
-- Migration: Asaas Fase 1 — payment provider routing
-- Adds tenants.payment_provider ('stripe' | 'asaas').
-- Resolution rule (also mirrored in services/payment/index.ts):
--   explicit column value wins; when NULL, country = Brazil -> 'asaas',
--   anything else -> 'stripe'.
-- Backfill keeps every tenant that already onboarded Stripe Connect on
-- Stripe, even Brazilian ones — we never break an existing payment setup.
-- Safe to re-run.
-- ============================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS payment_provider TEXT CHECK (payment_provider IN ('stripe', 'asaas'));

UPDATE public.tenants SET payment_provider = CASE
  WHEN stripe_connect_account_id IS NOT NULL THEN 'stripe'
  WHEN settings->>'country' = 'Brazil' THEN 'asaas'
  ELSE 'stripe'
END
WHERE payment_provider IS NULL;
