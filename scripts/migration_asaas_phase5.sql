-- ============================================
-- Migration: Asaas Fase 5 — webhook reconciliation
-- payments.asaas_payment_id lets the subaccount webhook insert a payment row
-- exactly once per Asaas payment (idempotency via a partial unique index).
-- Safe to re-run.
-- ============================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_asaas_payment_uniq
  ON public.payments(asaas_payment_id) WHERE asaas_payment_id IS NOT NULL;
