import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';

export type DrillIntensity = 'low' | 'medium' | 'high';

export const INTENSITY_LABELS: Record<DrillIntensity, string> = {
  low:    'Leve',
  medium: 'Moderado',
  high:   'Intenso',
};

export const INTENSITY_COLORS: Record<DrillIntensity, string> = {
  low:    'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  high:   'bg-rose-100 text-rose-700',
};

export interface DrillCategory {
  id?: string;
  tenant_id?: string;
  name: string;
  color?: string;
  created_at?: string;
}

export interface Drill {
  id?: string;
  tenant_id?: string;
  category_id?: string | null;
  name: string;
  description?: string | null;
  duration_minutes?: number | null;
  intensity?: DrillIntensity;
  objectives?: string[];
  equipment?: string[];
  is_public?: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  category?: DrillCategory | null;
  tags?: string[];
}

export interface TrainingDrill {
  training_id: string;
  drill_id: string;
  sort_order?: number;
  notes?: string | null;
  drill?: Drill;
}

export const drillService = {
  // ── Categories ────────────────────────────────────────────────────────────
  async getCategories(): Promise<DrillCategory[]> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) return [];
    const { data, error } = await supabase
      .from('drill_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name');
    if (error) throw error;
    return (data ?? []) as DrillCategory[];
  },

  async createCategory(c: Omit<DrillCategory, 'id' | 'tenant_id' | 'created_at'>): Promise<DrillCategory> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) throw new Error('No tenant');
    const { data, error } = await supabase
      .from('drill_categories').insert({ ...c, tenant_id: tenantId }).select().single();
    if (error) throw error;
    return data as DrillCategory;
  },

  async updateCategory(id: string, c: Partial<DrillCategory>): Promise<DrillCategory> {
    const { data, error } = await supabase
      .from('drill_categories').update(c).eq('id', id).select().single();
    if (error) throw error;
    return data as DrillCategory;
  },

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase.from('drill_categories').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Drills ────────────────────────────────────────────────────────────────
  async getAll(): Promise<Drill[]> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) return [];
    const { data: drillsData, error } = await supabase
      .from('drills')
      .select('*, category:drill_categories(id, name, color)')
      .eq('tenant_id', tenantId)
      .order('name');
    if (error) throw error;

    // Fetch tags for all drills
    const drills = (drillsData ?? []) as Drill[];
    if (drills.length === 0) return drills;

    const ids = drills.map(d => d.id!);
    const { data: tagsData } = await supabase
      .from('drill_tags')
      .select('drill_id, tag')
      .in('drill_id', ids);

    const tagMap: Record<string, string[]> = {};
    for (const t of tagsData ?? []) {
      if (!tagMap[t.drill_id]) tagMap[t.drill_id] = [];
      tagMap[t.drill_id].push(t.tag);
    }

    return drills.map(d => ({ ...d, tags: tagMap[d.id!] ?? [] }));
  },

  async create(d: Omit<Drill, 'id' | 'tenant_id' | 'created_at' | 'updated_at' | 'category' | 'tags'>): Promise<Drill> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) throw new Error('No tenant');
    const { data, error } = await supabase
      .from('drills').insert({ ...d, tenant_id: tenantId }).select().single();
    if (error) throw error;
    return data as Drill;
  },

  async update(id: string, d: Partial<Drill>): Promise<Drill> {
    const { category: _, tags: __, ...rest } = d;
    const { data, error } = await supabase
      .from('drills')
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) throw error;
    return data as Drill;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('drills').delete().eq('id', id);
    if (error) throw error;
  },

  async saveTags(drillId: string, tags: string[]): Promise<void> {
    await supabase.from('drill_tags').delete().eq('drill_id', drillId);
    if (!tags.length) return;
    const { error } = await supabase
      .from('drill_tags')
      .insert(tags.map(tag => ({ drill_id: drillId, tag })));
    if (error) throw error;
  },

  // ── Training ↔ Drills ─────────────────────────────────────────────────────
  async getByTraining(trainingId: string): Promise<TrainingDrill[]> {
    const { data, error } = await supabase
      .from('training_drills')
      .select('*, drill:drills(*, category:drill_categories(id,name,color))')
      .eq('training_id', trainingId)
      .order('sort_order');
    if (error) throw error;
    return (data ?? []) as TrainingDrill[];
  },

  async attachToTraining(trainingId: string, drillIds: string[]): Promise<void> {
    await supabase.from('training_drills').delete().eq('training_id', trainingId);
    if (!drillIds.length) return;
    const { error } = await supabase.from('training_drills').insert(
      drillIds.map((drill_id, idx) => ({ training_id: trainingId, drill_id, sort_order: idx }))
    );
    if (error) throw error;
  },
};
