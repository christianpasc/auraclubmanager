-- ============================================
-- Migration: Add separate Stripe customer ID for live mode
-- ============================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id_live TEXT;
