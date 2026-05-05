-- ============================================================
-- Módulo de Prospecção — Fase 2: Avaliação
-- Execute no Supabase SQL Editor
-- ============================================================

ALTER TABLE prospects
    ADD COLUMN IF NOT EXISTS scores        JSONB     NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS overall_score NUMERIC(4,2);

-- Index for top-prospect queries
CREATE INDEX IF NOT EXISTS prospects_overall_score_idx ON prospects(overall_score DESC NULLS LAST);
