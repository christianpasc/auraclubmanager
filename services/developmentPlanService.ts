import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';

export type PlanStatus  = 'draft' | 'active' | 'completed';
export type GoalStatus  = 'pending' | 'in_progress' | 'achieved' | 'cancelled';

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  draft:     'Rascunho',
  active:    'Ativo',
  completed: 'Concluído',
};

export const PLAN_STATUS_COLORS: Record<PlanStatus, string> = {
  draft:     'bg-slate-100 text-slate-600',
  active:    'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
};

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  pending:     'Pendente',
  in_progress: 'Em andamento',
  achieved:    'Alcançada',
  cancelled:   'Cancelada',
};

export const GOAL_STATUS_COLORS: Record<GoalStatus, string> = {
  pending:     'bg-slate-100 text-slate-500',
  in_progress: 'bg-blue-100 text-blue-700',
  achieved:    'bg-green-100 text-green-700',
  cancelled:   'bg-rose-100 text-rose-500',
};

export interface DevelopmentGoal {
  id?: string;
  plan_id?: string;
  skill_id?: string | null;
  description?: string | null;
  target_score?: number | null;
  deadline?: string | null;
  status?: GoalStatus;
  notes?: string | null;
  updated_at?: string;
  created_at?: string;
  skill?: { id: string; name: string } | null;
}

export interface DevelopmentPlan {
  id?: string;
  tenant_id?: string;
  athlete_id: string;
  coach_id?: string | null;
  title: string;
  description?: string | null;
  start_date: string;
  end_date?: string | null;
  status?: PlanStatus;
  created_at?: string;
  updated_at?: string;
  athlete?: { id: string; full_name: string; photo_url?: string | null } | null;
  goals?: DevelopmentGoal[];
}

function isMinor(birthDate: string | null): boolean {
  if (!birthDate) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return new Date(birthDate) > cutoff;
}

export const developmentPlanService = {
  // ── Plans ─────────────────────────────────────────────────────────────────
  async getAll(athleteId?: string): Promise<DevelopmentPlan[]> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) return [];
    let q = supabase
      .from('development_plans')
      .select('*, athlete:athletes(id, full_name, photo_url)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (athleteId) q = q.eq('athlete_id', athleteId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as DevelopmentPlan[];
  },

  async getById(id: string): Promise<DevelopmentPlan & { goals: DevelopmentGoal[] }> {
    const { data, error } = await supabase
      .from('development_plans')
      .select('*, athlete:athletes(id, full_name, photo_url), goals:development_goals(*, skill:skills(id, name))')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as DevelopmentPlan & { goals: DevelopmentGoal[] };
  },

  async create(p: Omit<DevelopmentPlan, 'id' | 'tenant_id' | 'created_at' | 'updated_at' | 'athlete' | 'goals'>): Promise<DevelopmentPlan> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) throw new Error('No tenant');
    const { data, error } = await supabase
      .from('development_plans')
      .insert({ ...p, tenant_id: tenantId })
      .select()
      .single();
    if (error) throw error;
    return data as DevelopmentPlan;
  },

  async update(id: string, p: Partial<DevelopmentPlan>): Promise<DevelopmentPlan> {
    const { athlete: _, goals: __, ...rest } = p;
    const { data, error } = await supabase
      .from('development_plans')
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as DevelopmentPlan;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('development_plans').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Goals ─────────────────────────────────────────────────────────────────
  async saveGoals(planId: string, goals: Omit<DevelopmentGoal, 'id' | 'plan_id' | 'created_at' | 'updated_at' | 'skill'>[]): Promise<void> {
    await supabase.from('development_goals').delete().eq('plan_id', planId);
    if (!goals.length) return;
    const { error } = await supabase
      .from('development_goals')
      .insert(goals.map(g => ({ ...g, plan_id: planId })));
    if (error) throw error;
  },

  async updateGoalStatus(goalId: string, status: GoalStatus, notes?: string): Promise<void> {
    const { error } = await supabase
      .from('development_goals')
      .update({ status, notes: notes ?? null, updated_at: new Date().toISOString() })
      .eq('id', goalId);
    if (error) throw error;
  },

  // ── Share (notify athlete + guardians) ────────────────────────────────────
  async share(planId: string): Promise<void> {
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) return;

    const plan = await developmentPlanService.getById(planId);
    const athleteId = plan.athlete_id;

    const { data: athlete } = await supabase
      .from('athletes')
      .select('id, user_id, birth_date, full_name')
      .eq('id', athleteId)
      .single();

    if (!athlete) return;

    const notifications: object[] = [];

    if (athlete.user_id) {
      notifications.push({
        tenant_id: tenantId,
        user_id: athlete.user_id,
        type: 'development_plan',
        title: `Plano de desenvolvimento: ${plan.title}`,
        body: `Um novo plano de desenvolvimento foi criado para você. Acesse o app para ver suas metas.`,
        channels: { email: true, push: false },
        reference_type: 'development_plan',
        reference_id: planId,
      });
    }

    if (isMinor(athlete.birth_date)) {
      const { data: links } = await supabase
        .from('athlete_guardians')
        .select('guardian:guardians(id, user_id, full_name)')
        .eq('athlete_id', athleteId);

      for (const link of links ?? []) {
        const guardian = link.guardian as any;
        if (!guardian?.user_id) continue;
        notifications.push({
          tenant_id: tenantId,
          user_id: guardian.user_id,
          type: 'development_plan',
          title: `Plano de desenvolvimento de ${athlete.full_name}`,
          body: `Um plano de desenvolvimento foi criado para ${athlete.full_name}: "${plan.title}". Acesse o app para acompanhar as metas.`,
          channels: { email: true, push: false },
          reference_type: 'development_plan',
          reference_id: planId,
        });
      }
    }

    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }

    // Mark plan as active when shared
    await developmentPlanService.update(planId, { status: 'active' });
  },
};
