-- ============================================
-- Migration: Asaas Fase 6 — NFS-e feature flag (off by default)
-- The NFS-e issuing point (asaas-nfse edge function) is gated by the
-- platform_settings 'asaas_nfse' flag. Absent row = disabled, so no DDL is
-- strictly required — this seed just makes the flag explicit/visible.
-- The admin toggle (Integrações) writes this same key via admin_set_platform_setting.
-- Safe to re-run.
-- ============================================

INSERT INTO public.platform_settings (key, value)
VALUES ('asaas_nfse', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
