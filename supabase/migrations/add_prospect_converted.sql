-- ============================================================
-- Módulo de Prospecção — Fase 2b: Conversão para Atleta
-- Execute no Supabase SQL Editor
-- ============================================================

ALTER TABLE prospects
    ADD COLUMN IF NOT EXISTS converted_athlete_id UUID,
    ADD COLUMN IF NOT EXISTS converted_at         TIMESTAMPTZ;
