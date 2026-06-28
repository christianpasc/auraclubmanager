import { supabase } from '../lib/supabase';
import { Language } from '../contexts/LanguageContext';

export type I18nText = Partial<Record<Language, string>>;

export interface HelpCategory {
    id: string;
    slug: string;
    name_i18n: I18nText;
    icon: string | null;
    sort_order: number;
    is_active: boolean;
}

export interface HelpArticle {
    id: string;
    category_id: string;
    slug: string;
    title_i18n: I18nText;
    excerpt_i18n: I18nText;
    content_i18n: I18nText;
    feature_key: string | null;
    route_key: string | null;
    status: 'draft' | 'published';
    sort_order: number;
    search_keywords: string | null;
}

export function pickI18n(text: I18nText | undefined, language: Language): string {
    if (!text) return '';
    return text[language] || text['pt-BR'] || Object.values(text)[0] || '';
}

// Public, read-only access — RLS already restricts these queries to
// is_active/published rows, so anonymous (logged-out) visitors can call
// every method here safely. Mirrors paletteService.getActive()/adminPlanService.getActivePlans().
export const helpCenterService = {
    async getCategories(): Promise<HelpCategory[]> {
        const { data, error } = await supabase
            .from('help_categories')
            .select('*')
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data || []) as HelpCategory[];
    },

    async getAllPublishedArticles(): Promise<HelpArticle[]> {
        const { data, error } = await supabase
            .from('help_articles')
            .select('*')
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data || []) as HelpArticle[];
    },

    async getArticlesByCategory(categoryId: string): Promise<HelpArticle[]> {
        const { data, error } = await supabase
            .from('help_articles')
            .select('*')
            .eq('category_id', categoryId)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data || []) as HelpArticle[];
    },

    async getArticleBySlug(slug: string): Promise<HelpArticle | null> {
        const { data, error } = await supabase
            .from('help_articles')
            .select('*')
            .eq('slug', slug)
            .maybeSingle();
        if (error) throw error;
        return (data || null) as HelpArticle | null;
    },

    async getArticleByFeatureKey(featureKey: string): Promise<HelpArticle | null> {
        const { data, error } = await supabase
            .from('help_articles')
            .select('*')
            .eq('feature_key', featureKey)
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return (data || null) as HelpArticle | null;
    },

    async getArticleByRouteKey(routeKey: string): Promise<HelpArticle | null> {
        const { data, error } = await supabase
            .from('help_articles')
            .select('*')
            .eq('route_key', routeKey)
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return (data || null) as HelpArticle | null;
    },
};
