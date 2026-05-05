-- ============================================================
-- Módulo de Prospecção e Scout — Fase 1
-- Execute no Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS prospects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    full_name       TEXT NOT NULL,
    birth_date      DATE,
    position        TEXT,
    preferred_foot  TEXT,               -- right | left | both
    height_cm       NUMERIC(5,1),
    weight_kg       NUMERIC(5,1),
    city            TEXT,
    state           TEXT,
    current_club    TEXT,
    contact_name    TEXT,
    contact_phone   TEXT,
    contact_email   TEXT,
    source          TEXT DEFAULT 'other',
    -- indication | event | social | game | other
    status          TEXT NOT NULL DEFAULT 'observation',
    -- observation | registered | technical_eval | approved | rejected | monitoring
    priority        TEXT NOT NULL DEFAULT 'normal',
    -- low | normal | high | urgent
    photo_url       TEXT,
    video_url       TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS prospects_tenant_id_idx ON prospects(tenant_id);
CREATE INDEX IF NOT EXISTS prospects_status_idx     ON prospects(status);
CREATE INDEX IF NOT EXISTS prospects_position_idx   ON prospects(position);

-- Row Level Security
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospects_tenant_isolation" ON prospects
    USING (tenant_id = (
        SELECT tenant_id FROM tenant_users
        WHERE user_id = auth.uid()
        LIMIT 1
    ));
