import { supabase } from '../lib/supabase';
import { HelpArticle, HelpCategory, I18nText } from './helpCenterService';

export const adminHelpCenterService = {
    // Admin reads bypass nothing special — RLS lets super admins read everything
    // (active+inactive, draft+published) via the "manage" policy's USING clause.
    async getAllCategories(): Promise<HelpCategory[]> {
        const { data, error } = await supabase
            .from('help_categories')
            .select('*')
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data || []) as HelpCategory[];
    },

    async getAllArticles(): Promise<HelpArticle[]> {
        const { data, error } = await supabase
            .from('help_articles')
            .select('*')
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data || []) as HelpArticle[];
    },

    async getArticleById(id: string): Promise<HelpArticle | null> {
        const { data, error } = await supabase
            .from('help_articles')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        return (data || null) as HelpArticle | null;
    },

    async createCategory(slug: string, nameI18n: I18nText, icon: string | null, sortOrder = 0): Promise<HelpCategory> {
        const { data, error } = await supabase.rpc('admin_create_help_category', {
            p_slug: slug,
            p_name_i18n: JSON.stringify(nameI18n || {}),
            p_icon: icon,
            p_sort_order: sortOrder,
        });
        if (error) throw error;
        return data as HelpCategory;
    },

    async updateCategory(id: string, updates: Partial<Pick<HelpCategory, 'slug' | 'name_i18n' | 'icon' | 'sort_order' | 'is_active'>>): Promise<HelpCategory> {
        const { data, error } = await supabase.rpc('admin_update_help_category', {
            p_id: id,
            p_slug: updates.slug ?? null,
            p_name_i18n: updates.name_i18n ? JSON.stringify(updates.name_i18n) : null,
            p_icon: updates.icon ?? null,
            p_sort_order: updates.sort_order ?? null,
            p_is_active: updates.is_active ?? null,
        });
        if (error) throw error;
        return data as HelpCategory;
    },

    async deleteCategory(id: string): Promise<void> {
        const { error } = await supabase.rpc('admin_delete_help_category', { p_id: id });
        if (error) throw error;
    },

    async createArticle(article: Omit<HelpArticle, 'id'>): Promise<HelpArticle> {
        const { data, error } = await supabase.rpc('admin_create_help_article', {
            p_category_id: article.category_id,
            p_slug: article.slug,
            p_title_i18n: JSON.stringify(article.title_i18n || {}),
            p_excerpt_i18n: JSON.stringify(article.excerpt_i18n || {}),
            p_content_i18n: JSON.stringify(article.content_i18n || {}),
            p_feature_key: article.feature_key || null,
            p_route_key: article.route_key || null,
            p_status: article.status || 'draft',
            p_sort_order: article.sort_order || 0,
            p_search_keywords: article.search_keywords || null,
        });
        if (error) throw error;
        return data as HelpArticle;
    },

    async updateArticle(id: string, updates: Partial<HelpArticle>): Promise<HelpArticle> {
        const params: Record<string, unknown> = { p_id: id };
        if (updates.category_id !== undefined) params.p_category_id = updates.category_id;
        if (updates.slug !== undefined) params.p_slug = updates.slug;
        if (updates.title_i18n !== undefined) params.p_title_i18n = JSON.stringify(updates.title_i18n);
        if (updates.excerpt_i18n !== undefined) params.p_excerpt_i18n = JSON.stringify(updates.excerpt_i18n);
        if (updates.content_i18n !== undefined) params.p_content_i18n = JSON.stringify(updates.content_i18n);
        if (updates.status !== undefined) params.p_status = updates.status;
        if (updates.sort_order !== undefined) params.p_sort_order = updates.sort_order;
        if (updates.search_keywords !== undefined) params.p_search_keywords = updates.search_keywords;

        if (updates.feature_key !== undefined) {
            if (updates.feature_key === null) params.p_clear_feature_key = true;
            else params.p_feature_key = updates.feature_key;
        }
        if (updates.route_key !== undefined) {
            if (updates.route_key === null) params.p_clear_route_key = true;
            else params.p_route_key = updates.route_key;
        }

        const { data, error } = await supabase.rpc('admin_update_help_article', params);
        if (error) throw error;
        return data as HelpArticle;
    },

    async deleteArticle(id: string): Promise<void> {
        const { error } = await supabase.rpc('admin_delete_help_article', { p_id: id });
        if (error) throw error;
    },

    async uploadArticleImage(file: File): Promise<string> {
        const ext = file.name.split('.').pop();
        const path = `images/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from('help-center').upload(path, file, {
            cacheControl: '3600',
            upsert: false,
        });
        if (error) throw error;
        const { data } = supabase.storage.from('help-center').getPublicUrl(path);
        return data.publicUrl;
    },
};
