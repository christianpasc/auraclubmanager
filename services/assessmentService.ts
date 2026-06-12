import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';

export type Dimension = 'technical' | 'tactical' | 'physical' | 'psychological';

export const DIMENSION_LABELS: Record<Dimension, string> = {
  technical:     'Técnico',
  tactical:      'Tático',
  physical:      'Físico',
  psychological: 'Psicológico',
};

export const DIMENSION_COLORS: Record<Dimension, string> = {
  technical:     '#6366f1',
  tactical:      '#14b8a6',
  physical:      '#f59e0b',
  psychological: '#ec4899',
};

export interface SkillCategory {
  id?: string;
  tenant_id?: string;
  name: string;
  dimension: Dimension;
  sort_order?: number;
  created_at?: string;
}

export interface Skill {
  id?: string;
  tenant_id?: string;
  category_id?: string | null;
  name: string;
  description?: string | null;
  scale_min?: number;
  scale_max?: number;
  rubric?: Record<string, string> | null;
  sort_order?: number;
  created_at?: string;
  category?: SkillCategory;
}

export interface AssessmentTemplate {
  id?: string;
  tenant_id?: string;
  name: string;
  description?: string | null;
  skill_ids: string[];
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AssessmentScore {
  id?: string;
  assessment_id?: string;
  skill_id: string;
  score: number;
  comment?: string | null;
  skill?: Skill;
}

export interface Assessment {
  id?: string;
  tenant_id?: string;
  athlete_id: string;
  template_id?: string | null;
  coach_id?: string | null;
  group_id?: string | null;
  notes?: string | null;
  assessed_at: string;
  created_at?: string;
  updated_at?: string;
  athlete?: { id: string; full_name: string; photo_url?: string | null };
  coach?: { id: string; full_name: string } | null;
  scores?: AssessmentScore[];
}

export const assessmentService = {
  // ── Skill Categories ──────────────────────────────────────────────────────
  async getCategories(): Promise<SkillCategory[]> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) return [];
    const { data, error } = await supabase
      .from('skill_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('sort_order');
    if (error) throw error;
    return (data ?? []) as SkillCategory[];
  },

  async createCategory(cat: Omit<SkillCategory, 'id' | 'tenant_id' | 'created_at'>): Promise<SkillCategory> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) throw new Error('No tenant');
    const { data, error } = await supabase
      .from('skill_categories').insert({ ...cat, tenant_id: tenantId }).select().single();
    if (error) throw error;
    return data as SkillCategory;
  },

  async updateCategory(id: string, cat: Partial<SkillCategory>): Promise<SkillCategory> {
    const { data, error } = await supabase
      .from('skill_categories').update(cat).eq('id', id).select().single();
    if (error) throw error;
    return data as SkillCategory;
  },

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase.from('skill_categories').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Skills ────────────────────────────────────────────────────────────────
  async getSkills(): Promise<Skill[]> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) return [];
    const { data, error } = await supabase
      .from('skills')
      .select('*, category:skill_categories(id,name,dimension)')
      .eq('tenant_id', tenantId)
      .order('sort_order');
    if (error) throw error;
    return (data ?? []) as Skill[];
  },

  async createSkill(skill: Omit<Skill, 'id' | 'tenant_id' | 'created_at' | 'category'>): Promise<Skill> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) throw new Error('No tenant');
    const { data, error } = await supabase
      .from('skills').insert({ ...skill, tenant_id: tenantId }).select().single();
    if (error) throw error;
    return data as Skill;
  },

  async updateSkill(id: string, skill: Partial<Skill>): Promise<Skill> {
    const { category: _, ...rest } = skill;
    const { data, error } = await supabase
      .from('skills').update(rest).eq('id', id).select().single();
    if (error) throw error;
    return data as Skill;
  },

  async deleteSkill(id: string): Promise<void> {
    const { error } = await supabase.from('skills').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Assessment Templates ──────────────────────────────────────────────────
  async getTemplates(): Promise<AssessmentTemplate[]> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) return [];
    const { data, error } = await supabase
      .from('assessment_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as AssessmentTemplate[];
  },

  async createTemplate(tpl: Omit<AssessmentTemplate, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<AssessmentTemplate> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) throw new Error('No tenant');
    const { data, error } = await supabase
      .from('assessment_templates').insert({ ...tpl, tenant_id: tenantId }).select().single();
    if (error) throw error;
    return data as AssessmentTemplate;
  },

  async updateTemplate(id: string, tpl: Partial<AssessmentTemplate>): Promise<AssessmentTemplate> {
    const { data, error } = await supabase
      .from('assessment_templates')
      .update({ ...tpl, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) throw error;
    return data as AssessmentTemplate;
  },

  async deleteTemplate(id: string): Promise<void> {
    const { error } = await supabase.from('assessment_templates').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Assessments ───────────────────────────────────────────────────────────
  async getAll(filters?: { athleteId?: string; groupId?: string }): Promise<Assessment[]> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) return [];
    let q = supabase
      .from('assessments')
      .select('*, athlete:athletes(id,full_name,photo_url), coach:profiles(id,full_name)')
      .eq('tenant_id', tenantId)
      .order('assessed_at', { ascending: false });
    if (filters?.athleteId) q = q.eq('athlete_id', filters.athleteId);
    if (filters?.groupId)   q = q.eq('group_id', filters.groupId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Assessment[];
  },

  async getById(id: string): Promise<Assessment & { scores: AssessmentScore[] }> {
    const { data, error } = await supabase
      .from('assessments')
      .select('*, athlete:athletes(id,full_name,photo_url), coach:profiles(id,full_name), scores:assessment_scores(*, skill:skills(*))')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Assessment & { scores: AssessmentScore[] };
  },

  async create(a: Omit<Assessment, 'id' | 'tenant_id' | 'created_at' | 'updated_at' | 'athlete' | 'coach' | 'scores'>): Promise<Assessment> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) throw new Error('No tenant');
    const { data, error } = await supabase
      .from('assessments').insert({ ...a, tenant_id: tenantId }).select().single();
    if (error) throw error;
    return data as Assessment;
  },

  async update(id: string, a: Partial<Assessment>): Promise<Assessment> {
    const { athlete: _, coach: __, scores: ___, ...rest } = a;
    const { data, error } = await supabase
      .from('assessments')
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) throw error;
    return data as Assessment;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('assessments').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Scores ────────────────────────────────────────────────────────────────
  async saveScores(assessmentId: string, scores: { skill_id: string; score: number; comment?: string | null }[]): Promise<void> {
    // Delete all then insert fresh (simple, avoids upsert conflicts)
    await supabase.from('assessment_scores').delete().eq('assessment_id', assessmentId);
    if (scores.length === 0) return;
    const { error } = await supabase.from('assessment_scores').insert(
      scores.map(s => ({ assessment_id: assessmentId, skill_id: s.skill_id, score: s.score, comment: s.comment ?? null }))
    );
    if (error) throw error;
  },
};
