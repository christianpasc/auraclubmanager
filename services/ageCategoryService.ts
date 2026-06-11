import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';

export interface AgeCategory {
    id: string;
    tenant_id: string;
    name: string;
    min_birth_year: number | null;
    max_birth_year: number | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export const ageCategoryService = {
    async list(): Promise<AgeCategory[]> {
        const tenantId = getCurrentTenantIdSync();
        const { data, error } = await supabase
            .from('age_categories')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return data ?? [];
    },

    async getById(id: string): Promise<AgeCategory | null> {
        const { data, error } = await supabase
            .from('age_categories')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data;
    },

    async create(payload: Omit<AgeCategory, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<AgeCategory> {
        const tenantId = getCurrentTenantIdSync();
        const { data, error } = await supabase
            .from('age_categories')
            .insert({ ...payload, tenant_id: tenantId })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async update(id: string, payload: Partial<Omit<AgeCategory, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>): Promise<AgeCategory> {
        const { data, error } = await supabase
            .from('age_categories')
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase.from('age_categories').delete().eq('id', id);
        if (error) throw error;
    },

    /** Given a birth date string (YYYY-MM-DD), return the best matching category name */
    matchCategory(birthDate: string, categories: AgeCategory[]): string | null {
        if (!birthDate) return null;
        const birthYear = new Date(birthDate).getFullYear();
        const match = categories.find(c => {
            const okMin = c.min_birth_year === null || birthYear >= c.min_birth_year;
            const okMax = c.max_birth_year === null || birthYear <= c.max_birth_year;
            return okMin && okMax;
        });
        return match?.name ?? null;
    },
};
