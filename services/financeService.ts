import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';

// Helper to get current tenant_id
export const getCurrentTenantId = async (): Promise<string | null> => {
    const tenantId = getCurrentTenantIdSync();
    return tenantId;
};

export interface Transaction {
    id?: string;
    tenant_id?: string;
    type: 'income' | 'expense';
    description: string;
    category: string;
    date: string;
    amount: number;
    status: 'reconciled' | 'pending';
    notes?: string;
    created_at?: string;
    updated_at?: string;
}

export interface FinanceSummary {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    pendingCount: number;
}

// Transaction categories
export const TRANSACTION_CATEGORIES = {
    income: [
        'Mensalidades',
        'Matrículas',
        'Patrocínios',
        'Eventos',
        'Vendas',
        'Doações',
        'Outros',
    ],
    expense: [
        'Infraestrutura',
        'Equipamentos',
        'Salários',
        'Transporte',
        'Alimentação',
        'Material Esportivo',
        'Marketing',
        'Manutenção',
        'Impostos',
        'Outros',
    ],
};

export const financeService = {
    async getAll() {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });
        if (error) throw error;
        return data as Transaction[];
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data as Transaction;
    },

    async create(transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) {
        const tenant_id = await getCurrentTenantId();
        if (!tenant_id) throw new Error('No tenant selected');

        const { data, error } = await supabase
            .from('transactions')
            .insert({ ...transaction, tenant_id })
            .select()
            .single();
        if (error) throw error;
        return data as Transaction;
    },

    async update(id: string, transaction: Partial<Transaction>) {
        const { data, error } = await supabase
            .from('transactions')
            .update({ ...transaction, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as Transaction;
    },

    async delete(id: string) {
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) throw error;
    },

    async getSummary(): Promise<FinanceSummary> {
        const transactions = await this.getAll();

        const totalIncome = transactions
            .filter(t => t.type === 'income')
            .reduce((acc, t) => acc + Number(t.amount), 0);

        const totalExpense = transactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => acc + Number(t.amount), 0);

        const pendingCount = transactions.filter(t => t.status === 'pending').length;

        return {
            totalIncome,
            totalExpense,
            balance: totalIncome - totalExpense,
            pendingCount,
        };
    },

    async getByDateRange(startDate: string, endDate: string) {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: false });
        if (error) throw error;
        return data as Transaction[];
    },
};
