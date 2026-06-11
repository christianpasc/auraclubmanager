import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';

export interface Guardian {
    id: string;
    tenant_id: string;
    user_id: string | null;
    full_name: string;
    cpf: string | null;
    rg: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    // joined
    athlete_count?: number;
    athletes?: { id: string; full_name: string; photo_url: string | null; relationship: string; is_primary: boolean }[];
}

export interface AthleteGuardianLink {
    athlete_id: string;
    guardian_id: string;
    relationship: string;
    is_primary: boolean;
}

export const guardianService = {
    async list(): Promise<Guardian[]> {
        const tenantId = getCurrentTenantIdSync();
        const { data, error } = await supabase
            .from('guardians')
            .select(`*, athlete_guardians(count)`)
            .eq('tenant_id', tenantId)
            .order('full_name', { ascending: true });
        if (error) throw error;
        return (data ?? []).map((g: any) => ({
            ...g,
            athlete_count: g.athlete_guardians?.[0]?.count ?? 0,
        }));
    },

    async getById(id: string): Promise<Guardian | null> {
        const { data, error } = await supabase
            .from('guardians')
            .select(`*, athlete_guardians(athlete_id, relationship, is_primary, athletes(id, full_name, photo_url))`)
            .eq('id', id)
            .single();
        if (error) throw error;
        if (!data) return null;
        return {
            ...data,
            athletes: ((data as any).athlete_guardians ?? []).map((ag: any) => ({
                id: ag.athletes?.id,
                full_name: ag.athletes?.full_name ?? '',
                photo_url: ag.athletes?.photo_url ?? null,
                relationship: ag.relationship,
                is_primary: ag.is_primary,
            })),
        };
    },

    async create(payload: Omit<Guardian, 'id' | 'tenant_id' | 'created_at' | 'updated_at' | 'athlete_count' | 'athletes'>): Promise<Guardian> {
        const tenantId = getCurrentTenantIdSync();
        const { user_id, ...rest } = payload;
        const { data, error } = await supabase
            .from('guardians')
            .insert({ ...rest, user_id: user_id ?? null, tenant_id: tenantId })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async update(id: string, payload: Partial<Omit<Guardian, 'id' | 'tenant_id' | 'created_at' | 'updated_at' | 'athlete_count' | 'athletes'>>): Promise<Guardian> {
        const { data, error } = await supabase
            .from('guardians')
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase.from('guardians').delete().eq('id', id);
        if (error) throw error;
    },

    async linkAthlete(guardianId: string, athleteId: string, relationship: string, isPrimary: boolean): Promise<void> {
        const { error } = await supabase
            .from('athlete_guardians')
            .upsert(
                { guardian_id: guardianId, athlete_id: athleteId, relationship, is_primary: isPrimary },
                { onConflict: 'athlete_id,guardian_id' }
            );
        if (error) throw error;
    },

    async unlinkAthlete(guardianId: string, athleteId: string): Promise<void> {
        const { error } = await supabase
            .from('athlete_guardians')
            .delete()
            .eq('guardian_id', guardianId)
            .eq('athlete_id', athleteId);
        if (error) throw error;
    },

    async getAthleteGuardians(athleteId: string): Promise<{ guardian: Guardian; relationship: string; is_primary: boolean }[]> {
        const { data, error } = await supabase
            .from('athlete_guardians')
            .select(`relationship, is_primary, guardians(*)`)
            .eq('athlete_id', athleteId)
            .order('is_primary', { ascending: false });
        if (error) throw error;
        return (data ?? []).map((row: any) => ({
            guardian: row.guardians as Guardian,
            relationship: row.relationship,
            is_primary: row.is_primary,
        }));
    },
};
