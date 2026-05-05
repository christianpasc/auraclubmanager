-- ============================================================
-- Planos "Em Breve" — adiciona flag is_coming_soon
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Coluna na tabela
ALTER TABLE stripe_plans
    ADD COLUMN IF NOT EXISTS is_coming_soon BOOLEAN NOT NULL DEFAULT false;

-- 2. RPC para salvar o campo (bypassa RLS)
CREATE OR REPLACE FUNCTION admin_update_coming_soon(
    p_id            UUID,
    p_is_coming_soon BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND is_super_admin = true
    ) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE stripe_plans
    SET
        is_coming_soon = p_is_coming_soon,
        updated_at     = NOW()
    WHERE id = p_id;
END;
$$;
