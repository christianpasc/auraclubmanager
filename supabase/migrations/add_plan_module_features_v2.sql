-- ============================================================
-- Feature Flags por Plano — separado por tipo de organização
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Renomeia module_features → module_features_club (se existir)
--    ou cria do zero se ainda não existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'stripe_plans' AND column_name = 'module_features'
    ) THEN
        ALTER TABLE stripe_plans RENAME COLUMN module_features TO module_features_club;
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'stripe_plans' AND column_name = 'module_features_club'
    ) THEN
        ALTER TABLE stripe_plans ADD COLUMN module_features_club JSONB NOT NULL DEFAULT '{}';
    END IF;
END $$;

-- 2. Adiciona coluna para escolinha
ALTER TABLE stripe_plans
    ADD COLUMN IF NOT EXISTS module_features_school JSONB NOT NULL DEFAULT '{}';

-- 3. Recria o RPC com suporte aos dois tipos
CREATE OR REPLACE FUNCTION admin_update_module_features(
    p_id                   UUID,
    p_module_features_school JSONB,
    p_module_features_club   JSONB
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
        module_features_school = p_module_features_school,
        module_features_club   = p_module_features_club,
        updated_at             = NOW()
    WHERE id = p_id;
END;
$$;
