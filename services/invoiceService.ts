import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';

export interface Invoice {
  id?: string;
  tenant_id?: string;
  athlete_id?: string;
  school_plan_id?: string | null;
  description?: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  installment_number?: number;
  total_installments?: number;
  notes?: string;
  stripe_subscription_id?: string | null;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined
  athlete?: { id: string; full_name: string; photo_url?: string };
  school_plan?: { id: string; name: string; interval: string };
}

export const invoiceService = {
  async getAll(): Promise<Invoice[]> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, athlete:athletes(id, full_name, photo_url), school_plan:school_plans(id, name, interval)')
      .order('due_date', { ascending: false });
    if (error) throw error;
    return (data || []) as Invoice[];
  },

  async getPending(): Promise<Invoice[]> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, athlete:athletes(id, full_name, photo_url), school_plan:school_plans(id, name, interval)')
      .in('status', ['pending', 'overdue'])
      .order('due_date', { ascending: true });
    if (error) throw error;
    return (data || []) as Invoice[];
  },

  async create(invoice: Omit<Invoice, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<Invoice> {
    const tenant_id = getCurrentTenantIdSync();
    if (!tenant_id) throw new Error('No tenant selected');
    const { data, error } = await supabase
      .from('invoices')
      .insert({ ...invoice, tenant_id })
      .select()
      .single();
    if (error) throw error;
    return data as Invoice;
  },

  async updateStatus(id: string, status: Invoice['status'], extra?: Partial<Invoice>): Promise<void> {
    const { error } = await supabase
      .from('invoices')
      .update({ status, ...extra, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};
