
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
    school_plan_id?: string | null;
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
        const created = data as Enrollment;

        // Generate the initial charge: a Stripe-payable invoice if a payment plan
        // was selected, otherwise the legacy manual monthly fees.
        if (created.id && created.athlete_id) {
            try {
                if (created.school_plan_id) {
                    await this.generateInitialInvoice(created);
                } else {
                    await monthlyFeeService.generateFromEnrollment(created, created.athlete_id);
                }
            } catch (err) {
                console.error('Error generating fees/invoice:', err);
                // Don't throw - enrollment was still created successfully
            }
        }

        return created;
    },

    async generateInitialInvoice(enrollment: Enrollment) {
        if (!enrollment.school_plan_id || !enrollment.athlete_id) return;
        const tenant_id = await getCurrentTenantId();
        if (!tenant_id) throw new Error('No tenant selected');

        const { data: plan, error: planError } = await supabase
            .from('school_plans')
            .select('name, amount')
            .eq('id', enrollment.school_plan_id)
            .single();
        if (planError || !plan) throw planError || new Error('Plan not found');

        const dueDate = enrollment.start_date || enrollment.enrollment_date || new Date().toISOString().split('T')[0];

        const { data: invoice, error } = await supabase.from('invoices').insert({
            tenant_id,
            athlete_id: enrollment.athlete_id,
            school_plan_id: enrollment.school_plan_id,
            enrollment_id: enrollment.id,
            description: plan.name,
            amount: plan.amount,
            due_date: dueDate,
            status: 'pending',
        }).select().single();
        if (error) throw error;

        // Email the payment link to the athlete (or guardian, if a minor).
        // Best-effort: a failed send shouldn't block the enrollment.
        try {
            await supabase.functions.invoke('send-invoice-email', {
                body: { invoice_id: invoice.id, base_url: window.location.origin },
            });
        } catch (err) {
            console.error('Error sending invoice email:', err);
        }
    },

    async createWithAthlete(
        athleteData: Omit<Athlete, 'id' | 'created_at' | 'updated_at'>,
        enrollmentData: Omit<Enrollment, 'id' | 'athlete_id' | 'created_at' | 'updated_at'>
    ) {
        // First create the athlete
        const athlete = await athleteService.create(athleteData);

        // Then create the enrollment linked to the athlete (also generates the
        // initial Stripe invoice or legacy monthly fees, see create() above)
        const enrollment = await this.create({
            ...enrollmentData,
            athlete_id: athlete.id,
        });

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

// Default payment methods (shown when tenant has no custom methods configured)
export const DEFAULT_PAYMENT_METHODS = [
    { value: 'cash' },
    { value: 'card' },
];

export const enrollmentStatuses = [
    { value: 'pending', label: 'Pendente', color: 'warning' },
    { value: 'active', label: 'Ativa', color: 'success' },
    { value: 'cancelled', label: 'Cancelada', color: 'error' },
    { value: 'expired', label: 'Expirada', color: 'neutral' },
];
