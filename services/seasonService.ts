import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';

export interface Season {
    id: string;
    tenant_id: string;
    name: string;
    year: number;
    start_date: string | null;
    end_date: string | null;
    is_current: boolean;
    created_at: string;
    updated_at: string;
}

export const seasonService = {
    async list(): Promise<Season[]> {
        const tenantId = getCurrentTenantIdSync();
        const { data, error } = await supabase
            .from('seasons')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('year', { ascending: false });
        if (error) throw error;
        return data ?? [];
    },

    async getById(id: string): Promise<Season | null> {
        const { data, error } = await supabase
            .from('seasons')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data;
    },

    async create(payload: Omit<Season, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<Season> {
        const tenantId = getCurrentTenantIdSync();
        const { data, error } = await supabase
            .from('seasons')
            .insert({ ...payload, tenant_id: tenantId })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async update(id: string, payload: Partial<Omit<Season, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>): Promise<Season> {
        const { data, error } = await supabase
            .from('seasons')
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async setCurrent(id: string): Promise<void> {
        const tenantId = getCurrentTenantIdSync();
        // Unset all current seasons for this tenant, then set the new one
        await supabase
            .from('seasons')
            .update({ is_current: false, updated_at: new Date().toISOString() })
            .eq('tenant_id', tenantId);
        const { error } = await supabase
            .from('seasons')
            .update({ is_current: true, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase.from('seasons').delete().eq('id', id);
        if (error) throw error;
    },
};
