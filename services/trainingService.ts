
import { supabase } from '../lib/supabase';
import { getCurrentTenantId } from './athleteService';

export interface Training {
    id?: string;
    tenant_id?: string;
    training_date: string;
    training_time?: string;
    end_time?: string;
    category?: string;
    focus?: string;
    description?: string;
    location?: string;
    status?: string;
    intensity?: string;
    notes?: string;
    created_at?: string;
    updated_at?: string;
}

export interface TrainingParticipant {
    id?: string;
    tenant_id?: string;
    training_id?: string;
    athlete_id?: string;
    attended?: boolean;
    performance_rating?: number;
    effort_rating?: number;
    notes?: string;
    created_at?: string;
    // Joined data
    athlete?: {
        id: string;
        full_name: string;
        photo_url?: string;
        category?: string;
        position?: string;
    };
}

export interface TrainingActivity {
    id?: string;
    training_id?: string;
    phase?: string;
    activity_name: string;
    duration_minutes?: number;
    description?: string;
    order_index?: number;
    created_at?: string;
}

export const trainingStatuses = [
    { value: 'scheduled', label: 'Agendado', color: 'neutral' },
    { value: 'in_progress', label: 'Em Andamento', color: 'warning' },
    { value: 'completed', label: 'Concluído', color: 'success' },
    { value: 'cancelled', label: 'Cancelado', color: 'error' },
];

export const trainingIntensities = [
    { value: 'low', label: 'Baixa' },
    { value: 'medium', label: 'Média' },
    { value: 'high', label: 'Alta' },
    { value: 'recovery', label: 'Regenerativo' },
];

export const trainingPhases = [
    { value: 'warmup', label: 'Aquecimento' },
    { value: 'main', label: 'Principal' },
    { value: 'cooldown', label: 'Volta à Calma' },
    { value: 'tactical', label: 'Tático' },
    { value: 'physical', label: 'Físico' },
    { value: 'technical', label: 'Técnico' },
];

export const trainingService = {
    async getAll() {
        const { data, error } = await supabase
            .from('trainings')
            .select('*')
            .order('training_date', { ascending: false });
        if (error) throw error;
        return data as Training[];
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('trainings')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data as Training;
    },

    async create(training: Omit<Training, 'id' | 'created_at' | 'updated_at'>) {
        const tenant_id = await getCurrentTenantId();
        if (!tenant_id) throw new Error('No tenant selected');

        const { data, error } = await supabase
            .from('trainings')
            .insert({ ...training, tenant_id })
            .select()
            .single();
        if (error) throw error;
        return data as Training;
    },

    async update(id: string, training: Partial<Training>) {
        const { data, error } = await supabase
            .from('trainings')
            .update({ ...training, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as Training;
    },

    async delete(id: string) {
        const { error } = await supabase.from('trainings').delete().eq('id', id);
        if (error) throw error;
    },
};

export const trainingParticipantService = {
    async getByTraining(trainingId: string) {
        const { data, error } = await supabase
            .from('training_participants')
            .select(`
                *,
                athlete:athletes(id, full_name, photo_url, category, position)
            `)
            .eq('training_id', trainingId);
        if (error) throw error;
        return data as TrainingParticipant[];
    },

    async create(participant: Omit<TrainingParticipant, 'id' | 'created_at' | 'athlete'>) {
        const tenant_id = await getCurrentTenantId();
        if (!tenant_id) throw new Error('No tenant selected');

        const { data, error } = await supabase
            .from('training_participants')
            .insert({ ...participant, tenant_id })
            .select()
            .single();
        if (error) throw error;
        return data as TrainingParticipant;
    },

    async createMany(participants: Omit<TrainingParticipant, 'id' | 'created_at' | 'athlete'>[]) {
        const tenant_id = await getCurrentTenantId();
        if (!tenant_id) throw new Error('No tenant selected');

        const withTenant = participants.map(p => ({ ...p, tenant_id }));
        const { data, error } = await supabase
            .from('training_participants')
            .insert(withTenant)
            .select();
        if (error) throw error;
        return data as TrainingParticipant[];
    },

    async update(id: string, participant: Partial<TrainingParticipant>) {
        const { athlete, ...participantData } = participant;
        const { data, error } = await supabase
            .from('training_participants')
            .update(participantData)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as TrainingParticipant;
    },

    async delete(id: string) {
        const { error } = await supabase.from('training_participants').delete().eq('id', id);
        if (error) throw error;
    },

    async deleteByTraining(trainingId: string) {
        const { error } = await supabase.from('training_participants').delete().eq('training_id', trainingId);
        if (error) throw error;
    },

    async upsertMany(trainingId: string, participants: Partial<TrainingParticipant>[]) {
        await this.deleteByTraining(trainingId);
        if (participants.length > 0) {
            const toInsert = participants.map(p => ({
                ...p,
                training_id: trainingId,
            }));
            return this.createMany(toInsert as any);
        }
        return [];
    },
};

export const trainingActivityService = {
    async getByTraining(trainingId: string) {
        const { data, error } = await supabase
            .from('training_activities')
            .select('*')
            .eq('training_id', trainingId)
            .order('order_index', { ascending: true });
        if (error) throw error;
        return data as TrainingActivity[];
    },

    async create(activity: Omit<TrainingActivity, 'id' | 'created_at'>) {
        const { data, error } = await supabase
            .from('training_activities')
            .insert(activity)
            .select()
            .single();
        if (error) throw error;
        return data as TrainingActivity;
    },

    async createMany(activities: Omit<TrainingActivity, 'id' | 'created_at'>[]) {
        const { data, error } = await supabase
            .from('training_activities')
            .insert(activities)
            .select();
        if (error) throw error;
        return data as TrainingActivity[];
    },

    async update(id: string, activity: Partial<TrainingActivity>) {
        const { data, error } = await supabase
            .from('training_activities')
            .update(activity)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as TrainingActivity;
    },

    async delete(id: string) {
        const { error } = await supabase.from('training_activities').delete().eq('id', id);
        if (error) throw error;
    },

    async deleteByTraining(trainingId: string) {
        const { error } = await supabase.from('training_activities').delete().eq('training_id', trainingId);
        if (error) throw error;
    },

    async upsertMany(trainingId: string, activities: Partial<TrainingActivity>[]) {
        await this.deleteByTraining(trainingId);
        if (activities.length > 0) {
            const toInsert = activities.map((a, index) => ({
                ...a,
                training_id: trainingId,
                order_index: index,
            }));
            return this.createMany(toInsert as any);
        }
        return [];
    },
};
