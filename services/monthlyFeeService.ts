import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';
import { Enrollment } from './enrollmentService';

// Helper to get current tenant_id
export const getCurrentTenantId = async (): Promise<string | null> => {
    return getCurrentTenantIdSync();
};

export interface MonthlyFee {
    id?: string;
    tenant_id?: string;
    enrollment_id?: string;
    athlete_id: string;
    installment_number: number;
    due_date: string;
    amount: number;
    status: 'pending' | 'paid' | 'overdue';
    paid_at?: string;
    payment_method?: string;
    description?: string;
    notes?: string;
    transaction_id?: string;
    created_at?: string;
    updated_at?: string;
    // Joined data
    athlete?: {
        id: string;
        full_name: string;
        category?: string;
        photo_url?: string;
    };
    enrollment?: {
        id: string;
        plan_type?: string;
    };
}

// Map plan types to number of installments
export const PLAN_INSTALLMENTS: Record<string, number> = {
    monthly: 1,
    quarterly: 3,
    semiannual: 6,
    annual: 12,
};

export const FEE_STATUSES = [
    { value: 'pending', label: 'Pendente', color: 'warning' },
    { value: 'paid', label: 'Pago', color: 'success' },
    { value: 'overdue', label: 'Atrasado', color: 'error' },
];

export const monthlyFeeService = {
    async getAll() {
        const { data, error } = await supabase
            .from('monthly_fees')
            .select(`
                *,
                athlete:athletes(id, full_name, category, photo_url),
                enrollment:enrollments(id, plan_type)
            `)
            .order('due_date', { ascending: false });
        if (error) throw error;
        return data as MonthlyFee[];
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('monthly_fees')
            .select(`
                *,
                athlete:athletes(id, full_name, category, photo_url),
                enrollment:enrollments(id, plan_type)
            `)
            .eq('id', id)
            .single();
        if (error) throw error;
        return data as MonthlyFee;
    },

    async getByEnrollment(enrollmentId: string) {
        const { data, error } = await supabase
            .from('monthly_fees')
            .select(`
                *,
                athlete:athletes(id, full_name, category, photo_url)
            `)
            .eq('enrollment_id', enrollmentId)
            .order('installment_number', { ascending: true });
        if (error) throw error;
        return data as MonthlyFee[];
    },

    async getByAthlete(athleteId: string) {
        const { data, error } = await supabase
            .from('monthly_fees')
            .select(`
                *,
                enrollment:enrollments(id, plan_type)
            `)
            .eq('athlete_id', athleteId)
            .order('due_date', { ascending: false });
        if (error) throw error;
        return data as MonthlyFee[];
    },

    async create(fee: Omit<MonthlyFee, 'id' | 'created_at' | 'updated_at'>) {
        const tenant_id = await getCurrentTenantId();
        if (!tenant_id) throw new Error('No tenant selected');

        const { data, error } = await supabase
            .from('monthly_fees')
            .insert({ ...fee, tenant_id })
            .select()
            .single();
        if (error) throw error;
        return data as MonthlyFee;
    },

    async update(id: string, fee: Partial<MonthlyFee>) {
        const { data, error } = await supabase
            .from('monthly_fees')
            .update({ ...fee, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as MonthlyFee;
    },

    async delete(id: string) {
        const { error } = await supabase.from('monthly_fees').delete().eq('id', id);
        if (error) throw error;
    },

    async markAsPaid(id: string, paymentMethod?: string) {
        return this.update(id, {
            status: 'paid',
            paid_at: new Date().toISOString(),
            payment_method: paymentMethod,
        });
    },

    async updateOverdueStatus() {
        const today = new Date().toISOString().split('T')[0];
        const { error } = await supabase
            .from('monthly_fees')
            .update({ status: 'overdue', updated_at: new Date().toISOString() })
            .eq('status', 'pending')
            .lt('due_date', today);
        if (error) throw error;
    },

    /**
     * Generate monthly fees for an enrollment based on plan type
     * @param enrollment The enrollment data with plan_type, monthly_fee, start_date, payment_day
     * @param athleteId The athlete ID
     */
    async generateFromEnrollment(
        enrollment: Enrollment,
        athleteId: string
    ): Promise<MonthlyFee[]> {
        const tenant_id = await getCurrentTenantId();
        if (!tenant_id) throw new Error('No tenant selected');

        const planType = enrollment.plan_type || 'monthly';
        const installmentCount = PLAN_INSTALLMENTS[planType] || 1;
        const monthlyAmount = enrollment.monthly_fee || 0;
        const startDate = enrollment.start_date ? new Date(enrollment.start_date) : new Date();
        const paymentDay = enrollment.payment_day || 10;

        const fees: Omit<MonthlyFee, 'id' | 'created_at' | 'updated_at'>[] = [];

        for (let i = 0; i < installmentCount; i++) {
            const dueDate = new Date(startDate);
            dueDate.setMonth(dueDate.getMonth() + i);
            dueDate.setDate(Math.min(paymentDay, this.getDaysInMonth(dueDate)));

            fees.push({
                tenant_id,
                enrollment_id: enrollment.id,
                athlete_id: athleteId,
                installment_number: i + 1,
                due_date: dueDate.toISOString().split('T')[0],
                amount: monthlyAmount,
                status: 'pending',
                description: `Mensalidade ${i + 1}/${installmentCount} - ${this.getMonthName(dueDate)}`,
            });
        }

        // Insert all fees
        const { data, error } = await supabase
            .from('monthly_fees')
            .insert(fees)
            .select();

        if (error) throw error;
        return data as MonthlyFee[];
    },

    // Helper to get days in a month
    getDaysInMonth(date: Date): number {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    },

    // Helper to get month name in Portuguese
    getMonthName(date: Date): string {
        return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    },

    // Get summary statistics
    async getSummary() {
        const fees = await this.getAll();

        const totalExpected = fees.reduce((acc, f) => acc + Number(f.amount), 0);
        const totalReceived = fees
            .filter(f => f.status === 'paid')
            .reduce((acc, f) => acc + Number(f.amount), 0);
        const totalPending = fees
            .filter(f => f.status === 'pending')
            .reduce((acc, f) => acc + Number(f.amount), 0);
        const totalOverdue = fees
            .filter(f => f.status === 'overdue')
            .reduce((acc, f) => acc + Number(f.amount), 0);

        const pendingCount = fees.filter(f => f.status === 'pending').length;
        const overdueCount = fees.filter(f => f.status === 'overdue').length;

        return {
            totalExpected,
            totalReceived,
            totalPending,
            totalOverdue,
            pendingCount,
            overdueCount,
        };
    },
};
