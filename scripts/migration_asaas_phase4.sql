-- ============================================
-- Migration: Asaas Fase 4 — member charges on the club subaccount
-- Member fees flow through the same `invoices` rail as Stripe, with Asaas ids
-- stored alongside the stripe_* ones:
--   invoices.asaas_payment_id       — one-off charge id (or first cycle's payment)
--   invoices.asaas_subscription_id  — recurring subscription id
--   invoices.asaas_invoice_url      — Asaas-hosted payment page (PIX/boleto/card)
--   athletes.asaas_customer_id      — reusable Asaas customer (in the subaccount)
-- Safe to re-run.
-- ============================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_invoice_url TEXT;

ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_invoices_asaas_payment ON public.invoices(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_asaas_subscription ON public.invoices(asaas_subscription_id);
