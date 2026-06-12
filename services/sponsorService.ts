import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';

export interface Sponsor {
  id?: string;
  tenant_id?: string;
  name: string;
  logo_url?: string | null;
  website_url?: string | null;
  description?: string | null;
  category?: string | null;
  is_active?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SponsorshipPackage {
  id?: string;
  tenant_id?: string;
  name: string;
  description?: string | null;
  price?: number | null;
  benefits?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SponsorshipSale {
  id?: string;
  tenant_id?: string;
  sponsor_id: string;
  package_id?: string | null;
  amount: number;
  start_date?: string | null;
  end_date?: string | null;
  status?: 'active' | 'expired' | 'cancelled';
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  // joined
  sponsor?: Sponsor;
  package?: SponsorshipPackage;
}

export const SPONSOR_CATEGORIES = ['Principal', 'Ouro', 'Prata', 'Bronze', 'Apoiador', 'Parceiro'];

export const SALE_STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  expired: 'Expirado',
  cancelled: 'Cancelado',
};

export const SALE_STATUS_CLASSES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

export const sponsorService = {
  // --- Sponsors ---
  async getAll(): Promise<Sponsor[]> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) return [];
    const { data, error } = await supabase
      .from('sponsors')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('sort_order')
      .order('name');
    if (error) throw error;
    return (data ?? []) as Sponsor[];
  },

  async getPublic(tenantId: string): Promise<Sponsor[]> {
    const { data } = await supabase
      .from('sponsors')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order')
      .order('name');
    return (data ?? []) as Sponsor[];
  },

  async create(s: Omit<Sponsor, 'id' | 'created_at' | 'updated_at'>): Promise<Sponsor> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) throw new Error('No tenant');
    const { data, error } = await supabase.from('sponsors').insert({ ...s, tenant_id: tenantId }).select().single();
    if (error) throw error;
    return data as Sponsor;
  },

  async update(id: string, s: Partial<Sponsor>): Promise<Sponsor> {
    const { data, error } = await supabase
      .from('sponsors').update({ ...s, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw error;
    return data as Sponsor;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('sponsors').delete().eq('id', id);
    if (error) throw error;
  },

  // --- Packages ---
  async getPackages(): Promise<SponsorshipPackage[]> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) return [];
    const { data, error } = await supabase
      .from('sponsorship_packages').select('*').eq('tenant_id', tenantId).order('name');
    if (error) throw error;
    return (data ?? []) as SponsorshipPackage[];
  },

  async createPackage(p: Omit<SponsorshipPackage, 'id' | 'created_at' | 'updated_at'>): Promise<SponsorshipPackage> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) throw new Error('No tenant');
    const { data, error } = await supabase.from('sponsorship_packages').insert({ ...p, tenant_id: tenantId }).select().single();
    if (error) throw error;
    return data as SponsorshipPackage;
  },

  async updatePackage(id: string, p: Partial<SponsorshipPackage>): Promise<void> {
    const { error } = await supabase
      .from('sponsorship_packages').update({ ...p, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },

  async deletePackage(id: string): Promise<void> {
    const { error } = await supabase.from('sponsorship_packages').delete().eq('id', id);
    if (error) throw error;
  },

  // --- Sales ---
  async getSales(): Promise<SponsorshipSale[]> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) return [];
    const { data, error } = await supabase
      .from('sponsorship_sales')
      .select('*, sponsor:sponsors(id, name, logo_url, category), package:sponsorship_packages(id, name, price)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as SponsorshipSale[];
  },

  async createSale(s: Omit<SponsorshipSale, 'id' | 'created_at' | 'updated_at' | 'sponsor' | 'package'>): Promise<SponsorshipSale> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) throw new Error('No tenant');
    const { data, error } = await supabase
      .from('sponsorship_sales').insert({ ...s, tenant_id: tenantId }).select().single();
    if (error) throw error;
    return data as SponsorshipSale;
  },

  async updateSale(id: string, s: Partial<SponsorshipSale>): Promise<void> {
    const { sponsor: _, package: __, ...rest } = s;
    const { error } = await supabase
      .from('sponsorship_sales').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },

  async deleteSale(id: string): Promise<void> {
    const { error } = await supabase.from('sponsorship_sales').delete().eq('id', id);
    if (error) throw error;
  },
};
