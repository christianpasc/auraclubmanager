import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';

export interface Group {
    id: string;
    tenant_id: string;
    season_id: string | null;
    age_category_id: string | null;
    name: string;
    description: string | null;
    coach_user_id: string | null;
    max_athletes: number | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    // joined from relations
    season_name?: string;
    age_category_name?: string;
    coach_name?: string;
    athlete_count?: number;
}

export interface AthleteGroup {
    id: string;
    athlete_id: string;
    group_id: string;
    joined_at: string;
    left_at: string | null;
    created_at: string;
    athlete_name?: string;
    athlete_photo?: string;
    athlete_position?: string;
}

export const groupService = {
    async list(): Promise<Group[]> {
        const tenantId = getCurrentTenantIdSync();
        const { data, error } = await supabase
            .from('groups')
            .select(`
                *,
                seasons(name),
                age_categories(name),
                profiles(full_name),
                athlete_groups(count)
            `)
            .eq('tenant_id', tenantId)
            .order('name', { ascending: true });
        if (error) throw error;
        return (data ?? []).map((g: any) => ({
            ...g,
            season_name: g.seasons?.name ?? null,
            age_category_name: g.age_categories?.name ?? null,
            coach_name: g.profiles?.full_name ?? null,
            athlete_count: g.athlete_groups?.[0]?.count ?? 0,
        }));
    },

    async getById(id: string): Promise<Group | null> {
        const { data, error } = await supabase
            .from('groups')
            .select(`*, seasons(name), age_categories(name), profiles(full_name)`)
            .eq('id', id)
            .single();
        if (error) throw error;
        if (!data) return null;
        return {
            ...data,
            season_name: (data as any).seasons?.name ?? null,
            age_category_name: (data as any).age_categories?.name ?? null,
            coach_name: (data as any).profiles?.full_name ?? null,
        };
    },

    async create(payload: Pick<Group, 'name' | 'description' | 'season_id' | 'age_category_id' | 'coach_user_id' | 'max_athletes' | 'is_active'>): Promise<Group> {
        const tenantId = getCurrentTenantIdSync();
        const { data, error } = await supabase
            .from('groups')
            .insert({ ...payload, tenant_id: tenantId })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async update(id: string, payload: Partial<Pick<Group, 'name' | 'description' | 'season_id' | 'age_category_id' | 'coach_user_id' | 'max_athletes' | 'is_active'>>): Promise<Group> {
        const { data, error } = await supabase
            .from('groups')
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase.from('groups').delete().eq('id', id);
        if (error) throw error;
    },

    async getAthletes(groupId: string): Promise<AthleteGroup[]> {
        const { data, error } = await supabase
            .from('athlete_groups')
            .select(`*, athletes(full_name, photo_url, position)`)
            .eq('group_id', groupId)
            .is('left_at', null)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data ?? []).map((ag: any) => ({
            ...ag,
            athlete_name: ag.athletes?.full_name ?? '',
            athlete_photo: ag.athletes?.photo_url ?? null,
            athlete_position: ag.athletes?.position ?? null,
        }));
    },

    async addAthlete(groupId: string, athleteId: string): Promise<void> {
        const { error } = await supabase
            .from('athlete_groups')
            .upsert({ group_id: groupId, athlete_id: athleteId, left_at: null }, { onConflict: 'athlete_id,group_id' });
        if (error) throw error;
    },

    async removeAthlete(groupId: string, athleteId: string): Promise<void> {
        const { error } = await supabase
            .from('athlete_groups')
            .update({ left_at: new Date().toISOString().split('T')[0] })
            .eq('group_id', groupId)
            .eq('athlete_id', athleteId);
        if (error) throw error;
    },

    async getAthleteCurrentGroup(athleteId: string): Promise<{ group_id: string; group_name: string } | null> {
        const { data, error } = await supabase
            .from('athlete_groups')
            .select('group_id, groups(name)')
            .eq('athlete_id', athleteId)
            .is('left_at', null)
            .maybeSingle();
        if (error) throw error;
        if (!data) return null;
        return { group_id: data.group_id, group_name: (data as any).groups?.name ?? '' };
    },
};
