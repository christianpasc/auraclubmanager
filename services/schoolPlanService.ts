import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';

export interface SchoolPlan {
  id?: string;
  tenant_id?: string;
  name: string;
  description?: string;
  interval: 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'one_time';
  amount: number;
  currency?: string;
  is_active?: boolean;
  stripe_product_id?: string | null;
  stripe_price_id?: string | null;
  stripe_live_product_id?: string | null;
  stripe_live_price_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const PLAN_INTERVAL_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
  one_time: 'Avulso',
};

export const schoolPlanService = {
  async getAll(): Promise<SchoolPlan[]> {
    const { data, error } = await supabase
      .from('school_plans')
      .select('*')
      .order('amount', { ascending: true });
    if (error) throw error;
    return (data || []) as SchoolPlan[];
  },

  async getActive(): Promise<SchoolPlan[]> {
    const { data, error } = await supabase
      .from('school_plans')
      .select('*')
      .eq('is_active', true)
      .order('amount', { ascending: true });
    if (error) throw error;
    return (data || []) as SchoolPlan[];
  },

  async getById(id: string): Promise<SchoolPlan> {
    const { data, error } = await supabase
      .from('school_plans')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as SchoolPlan;
  },

  async create(plan: Omit<SchoolPlan, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<SchoolPlan> {
    const tenant_id = getCurrentTenantIdSync();
    if (!tenant_id) throw new Error('No tenant selected');
    const { data, error } = await supabase
      .from('school_plans')
      .insert({ ...plan, tenant_id })
      .select()
      .single();
    if (error) throw error;
    return data as SchoolPlan;
  },

  async update(id: string, plan: Partial<SchoolPlan>): Promise<SchoolPlan> {
    const { data, error } = await supabase
      .from('school_plans')
      .update({ ...plan, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as SchoolPlan;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('school_plans').delete().eq('id', id);
    if (error) throw error;
  },

  async toggleActive(id: string, is_active: boolean): Promise<void> {
    const { error } = await supabase
      .from('school_plans')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};
