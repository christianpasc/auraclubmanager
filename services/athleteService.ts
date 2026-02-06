
import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';

// Helper to get current tenant_id - uses the cached value from TenantContext
export const getCurrentTenantId = async (): Promise<string | null> => {
    const tenantId = getCurrentTenantIdSync();
    console.log('getCurrentTenantId - from context:', tenantId);
    return tenantId;
};

export interface Athlete {
    id?: string;
    tenant_id?: string;
    user_id?: string;
    full_name: string;
    birth_date?: string;
    cpf?: string;
    rg?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    photo_url?: string;
    category?: string;
    position?: string;
    dominant_foot?: string;
    jersey_number?: number;
    status?: string;
    join_date?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relationship?: string;
    guardian_name?: string;
    guardian_cpf?: string;
    guardian_phone?: string;
    guardian_email?: string;
    created_at?: string;
    updated_at?: string;
}

export interface AthleteWardrobe {
    id?: string;
    athlete_id?: string;
    shirt_size?: string;
    shorts_size?: string;
    shoe_size?: string;
    uniform_number?: number;
    has_uniform?: boolean;
    uniform_delivered_at?: string;
    has_training_kit?: boolean;
    training_kit_delivered_at?: string;
    has_bag?: boolean;
    bag_delivered_at?: string;
    notes?: string;
}

export interface AthletePhysiology {
    id?: string;
    athlete_id?: string;
    measurement_date?: string;
    height_cm?: number;
    weight_kg?: number;
    body_fat_percentage?: number;
    muscle_mass_kg?: number;
    bmi?: number;
    resting_heart_rate?: number;
    max_heart_rate?: number;
    blood_pressure_systolic?: number;
    blood_pressure_diastolic?: number;
    vo2_max?: number;
    flexibility_score?: number;
    agility_score?: number;
    speed_40m?: number;
    medical_notes?: string;
    injuries?: string;
    allergies?: string;
    blood_type?: string;
}

export interface AthleteTrainingHistory {
    id?: string;
    athlete_id?: string;
    event_type: 'training' | 'game';
    event_date: string;
    event_name?: string;
    training_type?: string;
    duration_minutes?: number;
    intensity?: string;
    opponent?: string;
    result?: string;
    goals_scored?: number;
    assists?: number;
    minutes_played?: number;
    yellow_cards?: number;
    red_cards?: number;
    performance_rating?: number;
    coach_notes?: string;
}

// Athletes CRUD
export const athleteService = {
    async getAll() {
        const { data, error } = await supabase
            .from('athletes')
            .select('*')
            .order('full_name');
        if (error) throw error;
        return data as Athlete[];
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('athletes')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data as Athlete;
    },

    async create(athlete: Omit<Athlete, 'id' | 'created_at' | 'updated_at'>) {
        const tenant_id = await getCurrentTenantId();
        if (!tenant_id) throw new Error('No tenant selected');

        const { data, error } = await supabase
            .from('athletes')
            .insert({ ...athlete, tenant_id })
            .select()
            .single();
        if (error) throw error;
        return data as Athlete;
    },

    async update(id: string, athlete: Partial<Athlete>) {
        const { data, error } = await supabase
            .from('athletes')
            .update({ ...athlete, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as Athlete;
    },

    async delete(id: string) {
        const { error } = await supabase.from('athletes').delete().eq('id', id);
        if (error) throw error;
    },
};

// Wardrobe CRUD
export const wardrobeService = {
    async getByAthleteId(athleteId: string) {
        const { data, error } = await supabase
            .from('athlete_wardrobe')
            .select('*')
            .eq('athlete_id', athleteId)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data as AthleteWardrobe | null;
    },

    async upsert(athleteId: string, wardrobe: Omit<AthleteWardrobe, 'id' | 'athlete_id'>) {
        const existing = await this.getByAthleteId(athleteId);

        if (existing) {
            const { data, error } = await supabase
                .from('athlete_wardrobe')
                .update({ ...wardrobe, updated_at: new Date().toISOString() })
                .eq('athlete_id', athleteId)
                .select()
                .single();
            if (error) throw error;
            return data as AthleteWardrobe;
        } else {
            const { data, error } = await supabase
                .from('athlete_wardrobe')
                .insert({ ...wardrobe, athlete_id: athleteId })
                .select()
                .single();
            if (error) throw error;
            return data as AthleteWardrobe;
        }
    },
};

// Physiology CRUD
export const physiologyService = {
    async getByAthleteId(athleteId: string) {
        const { data, error } = await supabase
            .from('athlete_physiology')
            .select('*')
            .eq('athlete_id', athleteId)
            .order('measurement_date', { ascending: false });
        if (error) throw error;
        return data as AthletePhysiology[];
    },

    async getLatest(athleteId: string) {
        const { data, error } = await supabase
            .from('athlete_physiology')
            .select('*')
            .eq('athlete_id', athleteId)
            .order('measurement_date', { ascending: false })
            .limit(1)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data as AthletePhysiology | null;
    },

    async create(athleteId: string, physiology: Omit<AthletePhysiology, 'id' | 'athlete_id'>) {
        const { data, error } = await supabase
            .from('athlete_physiology')
            .insert({ ...physiology, athlete_id: athleteId })
            .select()
            .single();
        if (error) throw error;
        return data as AthletePhysiology;
    },

    async update(id: string, physiology: Partial<AthletePhysiology>) {
        const { data, error } = await supabase
            .from('athlete_physiology')
            .update({ ...physiology, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as AthletePhysiology;
    },
};

// Training History CRUD
export const trainingHistoryService = {
    async getByAthleteId(athleteId: string) {
        const { data, error } = await supabase
            .from('athlete_training_history')
            .select('*')
            .eq('athlete_id', athleteId)
            .order('event_date', { ascending: false });
        if (error) throw error;
        return data as AthleteTrainingHistory[];
    },

    async create(athleteId: string, history: Omit<AthleteTrainingHistory, 'id' | 'athlete_id'>) {
        const { data, error } = await supabase
            .from('athlete_training_history')
            .insert({ ...history, athlete_id: athleteId })
            .select()
            .single();
        if (error) throw error;
        return data as AthleteTrainingHistory;
    },

    async update(id: string, history: Partial<AthleteTrainingHistory>) {
        const { data, error } = await supabase
            .from('athlete_training_history')
            .update(history)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as AthleteTrainingHistory;
    },

    async delete(id: string) {
        const { error } = await supabase.from('athlete_training_history').delete().eq('id', id);
        if (error) throw error;
    },
};
