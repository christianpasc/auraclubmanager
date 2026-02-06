
import { supabase } from '../lib/supabase';
import { Athlete, athleteService, getCurrentTenantId } from './athleteService';
import { monthlyFeeService } from './monthlyFeeService';


export interface Enrollment {
    id?: string;
    tenant_id?: string;
    athlete_id?: string;
    enrollment_date?: string;
    start_date?: string;
    end_date?: string;
    plan_type?: string;
    monthly_fee?: number;
    payment_day?: number;
    payment_method?: string;
    status?: string;
    contract_signed?: boolean;
    contract_signed_at?: string;
    notes?: string;
    created_at?: string;
    updated_at?: string;
    // Joined data
    athlete?: Athlete;
}

export interface EnrollmentWithAthlete extends Enrollment {
    athlete: Athlete;
}

export const enrollmentService = {
    async getAll() {
        const { data, error } = await supabase
            .from('enrollments')
            .select(`
        *,
        athlete:athletes(*)
      `)
            .order('enrollment_date', { ascending: false });
        if (error) throw error;
        return data as EnrollmentWithAthlete[];
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('enrollments')
            .select(`
        *,
        athlete:athletes(*)
      `)
            .eq('id', id)
            .single();
        if (error) throw error;
        return data as EnrollmentWithAthlete;
    },

    async create(enrollment: Omit<Enrollment, 'id' | 'created_at' | 'updated_at'>) {
        const tenant_id = await getCurrentTenantId();
        if (!tenant_id) throw new Error('No tenant selected');

        const { data, error } = await supabase
            .from('enrollments')
            .insert({ ...enrollment, tenant_id })
            .select()
            .single();
        if (error) throw error;
        return data as Enrollment;
    },

    async createWithAthlete(
        athleteData: Omit<Athlete, 'id' | 'created_at' | 'updated_at'>,
        enrollmentData: Omit<Enrollment, 'id' | 'athlete_id' | 'created_at' | 'updated_at'>
    ) {
        // First create the athlete
        const athlete = await athleteService.create(athleteData);

        // Then create the enrollment linked to the athlete
        const enrollment = await this.create({
            ...enrollmentData,
            athlete_id: athlete.id,
        });

        // Generate monthly fees based on the plan type
        if (enrollment.id && athlete.id) {
            try {
                await monthlyFeeService.generateFromEnrollment(enrollment, athlete.id);
            } catch (err) {
                console.error('Error generating monthly fees:', err);
                // Don't throw - enrollment was still created successfully
            }
        }

        return { athlete, enrollment };
    },


    async update(id: string, enrollment: Partial<Enrollment>) {
        const { data, error } = await supabase
            .from('enrollments')
            .update({ ...enrollment, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as Enrollment;
    },

    async delete(id: string) {
        const { error } = await supabase.from('enrollments').delete().eq('id', id);
        if (error) throw error;
    },

    async updateStatus(id: string, status: string) {
        return this.update(id, { status });
    },
};

export const planTypes = [
    { value: 'monthly', label: 'Mensal' },
    { value: 'quarterly', label: 'Trimestral' },
    { value: 'semiannual', label: 'Semestral' },
    { value: 'annual', label: 'Anual' },
];

export const paymentMethods = [
    { value: 'pix', label: 'PIX' },
    { value: 'credit_card', label: 'Cartão de Crédito' },
    { value: 'boleto', label: 'Boleto' },
    { value: 'cash', label: 'Dinheiro' },
];

export const enrollmentStatuses = [
    { value: 'pending', label: 'Pendente', color: 'warning' },
    { value: 'active', label: 'Ativa', color: 'success' },
    { value: 'cancelled', label: 'Cancelada', color: 'error' },
    { value: 'expired', label: 'Expirada', color: 'neutral' },
];
