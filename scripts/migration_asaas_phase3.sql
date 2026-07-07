-- ============================================
-- Migration: Asaas Fase 3 — per-club subaccount (subconta padrão)
-- Each Brazilian club gets its own Asaas subaccount so member payments settle
-- directly in the club's account (never the root account). We store the
-- subaccount id, its walletId (for future split/transfers), and its API key
-- ENCRYPTED (AES-256-GCM) — the plaintext key never touches the DB, logs or
-- the client. asaas_charges_enabled gates member charging (Fase 4).
--
-- The RLS "tenants_own_access" SELECT policy already lets club members read
-- their own tenant row; asaas_subaccount_api_key_encrypted is only ever
-- decrypted server-side inside edge functions with ASAAS_ENCRYPTION_KEY, so
-- exposure of the ciphertext column to members is not a usable secret.
-- Safe to re-run.
-- ============================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS asaas_subaccount_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_wallet_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subaccount_api_key_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS asaas_charges_enabled BOOLEAN NOT NULL DEFAULT false;
