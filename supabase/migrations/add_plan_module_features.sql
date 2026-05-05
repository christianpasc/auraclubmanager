-- ============================================================
-- Feature Flags por Plano — module_features JSONB
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Add module_features column to stripe_plans
ALTER TABLE stripe_plans
    ADD COLUMN IF NOT EXISTS module_features JSONB NOT NULL DEFAULT '{}';

-- 2. Update admin_update_plan RPC to support module_features
-- Drop and recreate with the new parameter (IF EXISTS handles first run)
CREATE OR REPLACE FUNCTION admin_update_module_features(
    p_id UUID,
    p_module_features JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only super admins can call this
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND is_super_admin = true
    ) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE stripe_plans
    SET
        module_features = p_module_features,
        updated_at = NOW()
    WHERE id = p_id;
END;
$$;
