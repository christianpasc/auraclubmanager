-- ============================================
-- Migration: Help Center (Central de Ajuda)
-- Adds: help_categories, help_articles
-- Adds RPCs: admin_create_help_category, admin_update_help_category, admin_delete_help_category,
--            admin_create_help_article, admin_update_help_article, admin_delete_help_article
-- Public reads go straight through RLS (no RPC needed), mirroring stripe_plans.
-- Storage bucket "help-center" must be created separately (public bucket) — see note at bottom.
-- Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE guards).
-- ============================================

-- ============================================
-- 1. help_categories
-- ============================================

CREATE TABLE IF NOT EXISTS public.help_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.help_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active help categories" ON public.help_categories;
CREATE POLICY "Anyone can read active help categories"
  ON public.help_categories
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Super admins can manage help categories" ON public.help_categories;
CREATE POLICY "Super admins can manage help categories"
  ON public.help_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_super_admin = true
    )
  );

-- ============================================
-- 2. help_articles
-- ============================================

CREATE TABLE IF NOT EXISTS public.help_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.help_categories(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
  excerpt_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
  feature_key TEXT,
  route_key TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  search_keywords TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_help_articles_category ON public.help_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_help_articles_feature_key ON public.help_articles(feature_key);
CREATE INDEX IF NOT EXISTS idx_help_articles_route_key ON public.help_articles(route_key);
CREATE INDEX IF NOT EXISTS idx_help_articles_slug ON public.help_articles(slug);

ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published help articles" ON public.help_articles;
CREATE POLICY "Anyone can read published help articles"
  ON public.help_articles
  FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS "Super admins can manage help articles" ON public.help_articles;
CREATE POLICY "Super admins can manage help articles"
  ON public.help_articles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_super_admin = true
    )
  );

-- ============================================
-- 3. RPCs — Categories
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_create_help_category(
  p_slug TEXT,
  p_name_i18n JSONB,
  p_icon TEXT DEFAULT NULL,
  p_sort_order INTEGER DEFAULT 0
)
RETURNS public.help_categories
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.help_categories;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a super admin';
  END IF;

  INSERT INTO public.help_categories (slug, name_i18n, icon, sort_order)
  VALUES (p_slug, p_name_i18n, p_icon, p_sort_order)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_help_category(
  p_id UUID,
  p_slug TEXT DEFAULT NULL,
  p_name_i18n JSONB DEFAULT NULL,
  p_icon TEXT DEFAULT NULL,
  p_sort_order INTEGER DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS public.help_categories
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.help_categories;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a super admin';
  END IF;

  UPDATE public.help_categories SET
    slug = COALESCE(p_slug, slug),
    name_i18n = COALESCE(p_name_i18n, name_i18n),
    icon = COALESCE(p_icon, icon),
    sort_order = COALESCE(p_sort_order, sort_order),
    is_active = COALESCE(p_is_active, is_active),
    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Help category not found';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_help_category(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a super admin';
  END IF;

  IF EXISTS (SELECT 1 FROM public.help_articles WHERE category_id = p_id) THEN
    RAISE EXCEPTION 'Cannot delete a category that still has articles';
  END IF;

  DELETE FROM public.help_categories WHERE id = p_id;
END;
$$;

-- ============================================
-- 4. RPCs — Articles
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_create_help_article(
  p_category_id UUID,
  p_slug TEXT,
  p_title_i18n JSONB,
  p_excerpt_i18n JSONB DEFAULT '{}'::jsonb,
  p_content_i18n JSONB DEFAULT '{}'::jsonb,
  p_feature_key TEXT DEFAULT NULL,
  p_route_key TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'draft',
  p_sort_order INTEGER DEFAULT 0,
  p_search_keywords TEXT DEFAULT NULL
)
RETURNS public.help_articles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.help_articles;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a super admin';
  END IF;

  INSERT INTO public.help_articles (
    category_id, slug, title_i18n, excerpt_i18n, content_i18n,
    feature_key, route_key, status, sort_order, search_keywords
  )
  VALUES (
    p_category_id, p_slug, p_title_i18n, p_excerpt_i18n, p_content_i18n,
    p_feature_key, p_route_key, p_status, p_sort_order, p_search_keywords
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_help_article(
  p_id UUID,
  p_category_id UUID DEFAULT NULL,
  p_slug TEXT DEFAULT NULL,
  p_title_i18n JSONB DEFAULT NULL,
  p_excerpt_i18n JSONB DEFAULT NULL,
  p_content_i18n JSONB DEFAULT NULL,
  p_feature_key TEXT DEFAULT NULL,
  p_route_key TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_sort_order INTEGER DEFAULT NULL,
  p_search_keywords TEXT DEFAULT NULL,
  p_clear_feature_key BOOLEAN DEFAULT false,
  p_clear_route_key BOOLEAN DEFAULT false
)
RETURNS public.help_articles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.help_articles;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a super admin';
  END IF;

  UPDATE public.help_articles SET
    category_id = COALESCE(p_category_id, category_id),
    slug = COALESCE(p_slug, slug),
    title_i18n = COALESCE(p_title_i18n, title_i18n),
    excerpt_i18n = COALESCE(p_excerpt_i18n, excerpt_i18n),
    content_i18n = COALESCE(p_content_i18n, content_i18n),
    feature_key = CASE WHEN p_clear_feature_key THEN NULL ELSE COALESCE(p_feature_key, feature_key) END,
    route_key = CASE WHEN p_clear_route_key THEN NULL ELSE COALESCE(p_route_key, route_key) END,
    status = COALESCE(p_status, status),
    sort_order = COALESCE(p_sort_order, sort_order),
    search_keywords = COALESCE(p_search_keywords, search_keywords),
    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Help article not found';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_help_article(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not a super admin';
  END IF;

  DELETE FROM public.help_articles WHERE id = p_id;
END;
$$;

-- ============================================
-- 5. Storage bucket (manual step, not SQL)
-- ============================================
-- Create a PUBLIC bucket named "help-center" via Supabase Studio or the
-- Storage API. Public read is implicit once the bucket is marked public;
-- write access for super admins only is enforced at the application layer
-- (the same way the "tenants" bucket logo upload works today).
