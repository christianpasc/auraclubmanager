-- Migration: Camada 1 / Fase 0 — Seeds demo
-- Popula dados de exemplo para o tenant FC Atlético Meridian

DO $$
DECLARE
    v_tenant  UUID := 'b0000000-0000-0000-0000-000000000001';

    -- seasons
    v_season_2025  UUID := 'd1000000-0000-0000-0000-000000000001';
    v_season_2026  UUID := 'd1000000-0000-0000-0000-000000000002';

    -- age_categories
    v_cat_sub13    UUID := 'd2000000-0000-0000-0000-000000000001';
    v_cat_sub15    UUID := 'd2000000-0000-0000-0000-000000000002';
    v_cat_sub17    UUID := 'd2000000-0000-0000-0000-000000000003';
    v_cat_sub20    UUID := 'd2000000-0000-0000-0000-000000000004';

    -- groups
    v_grp_sub17a   UUID := 'd3000000-0000-0000-0000-000000000001';
    v_grp_sub17b   UUID := 'd3000000-0000-0000-0000-000000000002';
    v_grp_sub20    UUID := 'd3000000-0000-0000-0000-000000000003';

    -- guardians
    v_guardian1    UUID := 'd4000000-0000-0000-0000-000000000001';
    v_guardian2    UUID := 'd4000000-0000-0000-0000-000000000002';
    v_guardian3    UUID := 'd4000000-0000-0000-0000-000000000003';

    -- school_plan
    v_plan1        UUID := 'd5000000-0000-0000-0000-000000000001';

    -- invoices
    v_invoice1     UUID := 'd6000000-0000-0000-0000-000000000001';
    v_invoice2     UUID := 'd6000000-0000-0000-0000-000000000002';

BEGIN

-- ─── SEASONS ───────────────────────────────────────────────────────────────
INSERT INTO public.seasons (id, tenant_id, name, year, start_date, end_date, is_current)
VALUES
    (v_season_2025, v_tenant, 'Temporada 2025', 2025, '2025-01-15', '2025-12-15', false),
    (v_season_2026, v_tenant, 'Temporada 2026', 2026, '2026-01-20', '2026-12-15', true)
ON CONFLICT (id) DO NOTHING;

-- ─── AGE CATEGORIES ────────────────────────────────────────────────────────
INSERT INTO public.age_categories (id, tenant_id, name, min_birth_year, max_birth_year, sort_order)
VALUES
    (v_cat_sub13, v_tenant, 'Sub-13', 2013, 2015, 1),
    (v_cat_sub15, v_tenant, 'Sub-15', 2011, 2012, 2),
    (v_cat_sub17, v_tenant, 'Sub-17', 2007, 2010, 3),
    (v_cat_sub20, v_tenant, 'Sub-20', 2004, 2006, 4)
ON CONFLICT (id) DO NOTHING;

-- ─── GROUPS (turmas) ───────────────────────────────────────────────────────
INSERT INTO public.groups (id, tenant_id, season_id, age_category_id, name, description, is_active)
VALUES
    (v_grp_sub17a, v_tenant, v_season_2026, v_cat_sub17, 'Sub-17 A', 'Turma principal Sub-17', true),
    (v_grp_sub17b, v_tenant, v_season_2026, v_cat_sub17, 'Sub-17 B', 'Turma reserva Sub-17',   true),
    (v_grp_sub20,  v_tenant, v_season_2026, v_cat_sub20, 'Sub-20',   'Turma Sub-20',            true)
ON CONFLICT (id) DO NOTHING;

-- ─── GUARDIANS ─────────────────────────────────────────────────────────────
INSERT INTO public.guardians (id, tenant_id, full_name, phone, email)
VALUES
    (v_guardian1, v_tenant, 'Roberto Santos',  '+55 11 99001-0001', 'roberto.santos@email.com'),
    (v_guardian2, v_tenant, 'Márcia Ferreira', '+55 11 99001-0002', 'marcia.ferreira@email.com'),
    (v_guardian3, v_tenant, 'Paulo Oliveira',  '+55 11 99001-0003', 'paulo.oliveira@email.com')
ON CONFLICT (id) DO NOTHING;

-- ─── ATHLETE ↔ GUARDIAN links ──────────────────────────────────────────────
-- Gabriel Santos (c0000000-...-001) → pai: Roberto Santos
-- Lucas Ferreira (c0000000-...-002) → mãe: Márcia Ferreira
-- Mateus Oliveira(c0000000-...-003) → pai: Paulo Oliveira
-- Márcia também é responsável por André Ferreira (c0000000-...-011)
INSERT INTO public.athlete_guardians (athlete_id, guardian_id, relationship, is_primary)
VALUES
    ('c0000000-0000-0000-0000-000000000001', v_guardian1, 'pai',  true),
    ('c0000000-0000-0000-0000-000000000002', v_guardian2, 'mãe',  true),
    ('c0000000-0000-0000-0000-000000000003', v_guardian3, 'pai',  true),
    ('c0000000-0000-0000-0000-000000000011', v_guardian2, 'mãe',  true)
ON CONFLICT (athlete_id, guardian_id) DO NOTHING;

-- ─── SCHOOL PLAN ───────────────────────────────────────────────────────────
INSERT INTO public.school_plans (id, tenant_id, name, description, interval, amount, currency, is_active)
VALUES
    (v_plan1, v_tenant, 'Mensalidade Padrão',
     'Plano mensal padrão de formação esportiva',
     'monthly', 250.00, 'brl', true)
ON CONFLICT (id) DO NOTHING;

-- ─── INVOICES (demo: 1 paga, 1 pendente) ───────────────────────────────────
INSERT INTO public.invoices
    (id, tenant_id, athlete_id, school_plan_id, description, amount, due_date, status,
     installment_number, total_installments)
VALUES
    (v_invoice1, v_tenant, 'c0000000-0000-0000-0000-000000000001',
     v_plan1, 'Mensalidade Maio/2026 — Gabriel Santos',
     250.00, '2026-05-10', 'paid', 5, 12),

    (v_invoice2, v_tenant, 'c0000000-0000-0000-0000-000000000002',
     v_plan1, 'Mensalidade Junho/2026 — Lucas Ferreira',
     250.00, '2026-06-10', 'pending', 6, 12)
ON CONFLICT (id) DO NOTHING;

-- ─── PAYMENT para a invoice paga ───────────────────────────────────────────
INSERT INTO public.payments (tenant_id, invoice_id, amount, paid_at, method, notes)
SELECT v_tenant, v_invoice1, 250.00, '2026-05-08 10:30:00+00', 'pix', 'Pago via PIX'
WHERE NOT EXISTS (
    SELECT 1 FROM public.payments WHERE invoice_id = v_invoice1
);

-- ─── ANNOUNCEMENT demo ─────────────────────────────────────────────────────
INSERT INTO public.announcements
    (tenant_id, title, body, target_type, published_at)
VALUES
    (v_tenant,
     'Bem-vindo à Temporada 2026!',
     'Prezados atletas e responsáveis, a Temporada 2026 do FC Atlético Meridian começa em 20/01. ' ||
     'Os treinos da Sub-17 serão às terças e quintas, das 16h às 18h. Boa temporada a todos!',
     'all',
     '2026-01-15 08:00:00+00')
ON CONFLICT DO NOTHING;

END $$;
