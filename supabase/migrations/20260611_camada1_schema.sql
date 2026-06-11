-- Migration: Camada 1 / Fase 0 — Modelo de Dados
-- Cria as tabelas ausentes do modelo Camada 1

-- ─────────────────────────────────────────
-- 1. SEASONS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seasons (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    year        INTEGER NOT NULL,
    start_date  DATE,
    end_date    DATE,
    is_current  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Apenas uma season pode ser 'current' por tenant
CREATE UNIQUE INDEX IF NOT EXISTS seasons_one_current_per_tenant
    ON public.seasons (tenant_id)
    WHERE is_current = true;

CREATE INDEX IF NOT EXISTS seasons_tenant_id_idx ON public.seasons (tenant_id);

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seasons_tenant_isolation" ON public.seasons
    USING (tenant_id = (
        SELECT tu.tenant_id FROM public.tenant_users tu
        WHERE tu.user_id = auth.uid()
        LIMIT 1
    ));

-- ─────────────────────────────────────────
-- 2. AGE_CATEGORIES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.age_categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,          -- ex: Sub-7, Sub-9, Sub-17
    min_birth_year  INTEGER,               -- inclusivo: >= min_birth_year
    max_birth_year  INTEGER,               -- inclusivo: <= max_birth_year
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS age_categories_tenant_id_idx ON public.age_categories (tenant_id);

ALTER TABLE public.age_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "age_categories_tenant_isolation" ON public.age_categories
    USING (tenant_id = (
        SELECT tu.tenant_id FROM public.tenant_users tu
        WHERE tu.user_id = auth.uid()
        LIMIT 1
    ));

-- ─────────────────────────────────────────
-- 3. GROUPS (turmas)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.groups (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    season_id           UUID REFERENCES public.seasons(id) ON DELETE SET NULL,
    age_category_id     UUID REFERENCES public.age_categories(id) ON DELETE SET NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    coach_user_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    max_athletes        INTEGER,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS groups_tenant_id_idx ON public.groups (tenant_id);
CREATE INDEX IF NOT EXISTS groups_season_id_idx ON public.groups (season_id);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups_tenant_isolation" ON public.groups
    USING (tenant_id = (
        SELECT tu.tenant_id FROM public.tenant_users tu
        WHERE tu.user_id = auth.uid()
        LIMIT 1
    ));

-- ─────────────────────────────────────────
-- 4. GUARDIANS (responsáveis standalone)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guardians (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,  -- nullable: pode não ter login
    full_name   TEXT NOT NULL,
    cpf         TEXT,
    rg          TEXT,
    phone       TEXT,
    email       TEXT,
    address     TEXT,
    city        TEXT,
    state       TEXT,
    zip_code    TEXT,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guardians_tenant_id_idx ON public.guardians (tenant_id);
CREATE INDEX IF NOT EXISTS guardians_user_id_idx   ON public.guardians (user_id);

ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guardians_tenant_isolation" ON public.guardians
    USING (tenant_id = (
        SELECT tu.tenant_id FROM public.tenant_users tu
        WHERE tu.user_id = auth.uid()
        LIMIT 1
    ));

-- ─────────────────────────────────────────
-- 5. ATHLETE_GUARDIANS (junction)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.athlete_guardians (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id      UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
    guardian_id     UUID NOT NULL REFERENCES public.guardians(id) ON DELETE CASCADE,
    relationship    TEXT NOT NULL DEFAULT 'responsável',  -- pai/mãe/avó/responsável legal/outro
    is_primary      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (athlete_id, guardian_id)
);

CREATE INDEX IF NOT EXISTS athlete_guardians_athlete_id_idx  ON public.athlete_guardians (athlete_id);
CREATE INDEX IF NOT EXISTS athlete_guardians_guardian_id_idx ON public.athlete_guardians (guardian_id);

ALTER TABLE public.athlete_guardians ENABLE ROW LEVEL SECURITY;

-- Herda isolamento via athlete (que já tem RLS por tenant_id)
CREATE POLICY "athlete_guardians_isolation" ON public.athlete_guardians
    USING (athlete_id IN (
        SELECT a.id FROM public.athletes a
        WHERE a.tenant_id = (
            SELECT tu.tenant_id FROM public.tenant_users tu
            WHERE tu.user_id = auth.uid()
            LIMIT 1
        )
    ));

-- ─────────────────────────────────────────
-- 6. SCHOOL_PLANS (planos de mensalidade da escola)
-- Separado de stripe_plans (que é o SaaS billing)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_plans (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    interval    TEXT NOT NULL DEFAULT 'monthly'
                    CHECK (interval IN ('monthly', 'quarterly', 'semiannual', 'annual')),
    amount      NUMERIC(10,2) NOT NULL,
    currency    TEXT NOT NULL DEFAULT 'brl',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS school_plans_tenant_id_idx ON public.school_plans (tenant_id);

ALTER TABLE public.school_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_plans_tenant_isolation" ON public.school_plans
    USING (tenant_id = (
        SELECT tu.tenant_id FROM public.tenant_users tu
        WHERE tu.user_id = auth.uid()
        LIMIT 1
    ));

-- ─────────────────────────────────────────
-- 7. INVOICES (cobranças formais)
-- monthly_fees existente continua; invoices é a entidade Camada 1.
-- Migração de dados monthly_fees→invoices virá na Fase 3.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    athlete_id          UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
    school_plan_id      UUID REFERENCES public.school_plans(id) ON DELETE SET NULL,
    description         TEXT NOT NULL,
    amount              NUMERIC(10,2) NOT NULL,
    due_date            DATE NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    installment_number  INTEGER,
    total_installments  INTEGER,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_tenant_id_idx   ON public.invoices (tenant_id);
CREATE INDEX IF NOT EXISTS invoices_athlete_id_idx  ON public.invoices (athlete_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx      ON public.invoices (status);
CREATE INDEX IF NOT EXISTS invoices_due_date_idx    ON public.invoices (due_date);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_tenant_isolation" ON public.invoices
    USING (tenant_id = (
        SELECT tu.tenant_id FROM public.tenant_users tu
        WHERE tu.user_id = auth.uid()
        LIMIT 1
    ));

-- ─────────────────────────────────────────
-- 8. PAYMENTS (registros de pagamento)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_id   UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    amount       NUMERIC(10,2) NOT NULL,
    paid_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    method       TEXT NOT NULL DEFAULT 'cash'
                     CHECK (method IN ('cash', 'pix', 'card', 'bank_transfer', 'other')),
    notes        TEXT,
    recorded_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_tenant_id_idx  ON public.payments (tenant_id);
CREATE INDEX IF NOT EXISTS payments_invoice_id_idx ON public.payments (invoice_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_tenant_isolation" ON public.payments
    USING (tenant_id = (
        SELECT tu.tenant_id FROM public.tenant_users tu
        WHERE tu.user_id = auth.uid()
        LIMIT 1
    ));

-- ─────────────────────────────────────────
-- 9. EVENTS (agregador unificado de treinos, jogos e eventos)
-- Na Fase 4, treinos/jogos novos serão criados via events.
-- Por ora, training_id/game_id vinculam aos registros existentes.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    type                TEXT NOT NULL DEFAULT 'event'
                            CHECK (type IN ('training', 'game', 'event')),
    group_id            UUID REFERENCES public.groups(id) ON DELETE SET NULL,
    age_category_id     UUID REFERENCES public.age_categories(id) ON DELETE SET NULL,
    start_at            TIMESTAMPTZ NOT NULL,
    end_at              TIMESTAMPTZ,
    location            TEXT,
    description         TEXT,
    status              TEXT NOT NULL DEFAULT 'scheduled'
                            CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    training_id         UUID REFERENCES public.trainings(id) ON DELETE SET NULL,
    game_id             UUID REFERENCES public.games(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_tenant_id_idx ON public.events (tenant_id);
CREATE INDEX IF NOT EXISTS events_start_at_idx  ON public.events (start_at);
CREATE INDEX IF NOT EXISTS events_type_idx      ON public.events (type);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_tenant_isolation" ON public.events
    USING (tenant_id = (
        SELECT tu.tenant_id FROM public.tenant_users tu
        WHERE tu.user_id = auth.uid()
        LIMIT 1
    ));

-- ─────────────────────────────────────────
-- 10. EVENT_RSVP
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_rsvp (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id     UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'tentative'
                     CHECK (status IN ('confirmed', 'declined', 'tentative')),
    responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_rsvp_event_id_idx ON public.event_rsvp (event_id);
CREATE INDEX IF NOT EXISTS event_rsvp_user_id_idx  ON public.event_rsvp (user_id);

ALTER TABLE public.event_rsvp ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas RSVPs de eventos do seu tenant
CREATE POLICY "event_rsvp_isolation" ON public.event_rsvp
    USING (event_id IN (
        SELECT e.id FROM public.events e
        WHERE e.tenant_id = (
            SELECT tu.tenant_id FROM public.tenant_users tu
            WHERE tu.user_id = auth.uid()
            LIMIT 1
        )
    ));

-- ─────────────────────────────────────────
-- 11. ANNOUNCEMENTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    sender_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    target_type     TEXT NOT NULL DEFAULT 'all'
                        CHECK (target_type IN ('all', 'group', 'age_category', 'individual')),
    target_id       UUID,  -- group_id, age_category_id ou user_id dependendo do target_type
    published_at    TIMESTAMPTZ DEFAULT now(),
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcements_tenant_id_idx    ON public.announcements (tenant_id);
CREATE INDEX IF NOT EXISTS announcements_published_at_idx ON public.announcements (published_at DESC);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_tenant_isolation" ON public.announcements
    USING (tenant_id = (
        SELECT tu.tenant_id FROM public.tenant_users tu
        WHERE tu.user_id = auth.uid()
        LIMIT 1
    ));

-- ─────────────────────────────────────────
-- 12. NOTIFICATIONS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type            TEXT NOT NULL,  -- announcement, invoice_due, event_reminder, etc.
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    channels        JSONB NOT NULL DEFAULT '{"push": false, "email": true}',
    read_at         TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ DEFAULT now(),
    reference_type  TEXT,  -- announcement, event, invoice, other
    reference_id    UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_tenant_id_idx ON public.notifications (tenant_id);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx   ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_read_at_idx   ON public.notifications (read_at) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Cada usuário vê apenas suas próprias notificações
CREATE POLICY "notifications_own_only" ON public.notifications
    USING (user_id = auth.uid());

-- ─────────────────────────────────────────
-- Atualiza updated_at automático em novas tabelas
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'seasons', 'age_categories', 'groups', 'guardians',
        'school_plans', 'invoices', 'announcements'
    ]
    LOOP
        EXECUTE format('
            CREATE TRIGGER set_updated_at_%1$s
            BEFORE UPDATE ON public.%1$s
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()
        ', t);
    END LOOP;
END;
$$;
