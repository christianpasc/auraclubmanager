import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Loader2, Pencil, Trash2, Target, Search, Send, CheckCircle2,
} from 'lucide-react';
import {
  developmentPlanService, DevelopmentPlan,
  PLAN_STATUS_LABELS, PLAN_STATUS_COLORS, GOAL_STATUS_LABELS, GOAL_STATUS_COLORS,
} from '../services/developmentPlanService';
import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';
import { useLanguage } from '../contexts/LanguageContext';

interface AthleteOption { id: string; full_name: string; }

const DevelopmentPlans: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [plans,    setPlans]    = useState<DevelopmentPlan[]>([]);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [sharing,  setSharing]  = useState<string | null>(null);

  const [filterAthlete, setFilterAthlete] = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [search,        setSearch]        = useState('');

  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const tenantId = getCurrentTenantIdSync();
    const [p, athletesRes] = await Promise.all([
      developmentPlanService.getAll(),
      supabase.from('athletes').select('id, full_name').eq('tenant_id', tenantId!).order('full_name'),
    ]);
    setPlans(p);
    setAthletes((athletesRes.data ?? []) as AthleteOption[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const deletePlan = async (id: string) => {
    if (!window.confirm('Remover este plano de desenvolvimento?')) return;
    await developmentPlanService.delete(id);
    setPlans(prev => prev.filter(p => p.id !== id));
  };

  const sharePlan = async (id: string) => {
    setSharing(id);
    try {
      await developmentPlanService.share(id);
      // Refresh the plan status
      setPlans(prev => prev.map(p => p.id === id ? { ...p, status: 'active' } : p));
    } catch (e: any) {
      alert(`Erro ao compartilhar: ${e.message}`);
    } finally {
      setSharing(null);
    }
  };

  const filtered = plans.filter(p => {
    if (filterAthlete && p.athlete_id !== filterAthlete) return false;
    if (filterStatus  && p.status    !== filterStatus)   return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) &&
        !p.athlete?.full_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const fmtDate = (d?: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  // Stats
  const active    = plans.filter(p => p.status === 'active').length;
  const draft     = plans.filter(p => p.status === 'draft').length;
  const completed = plans.filter(p => p.status === 'completed').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('plans.title')}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{t('plans.subtitle')}</p>
        </div>
        <button onClick={() => navigate('/development-plans/new')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus className="w-4 h-4"/> {t('plans.newButton')}
        </button>
      </div>

      {/* Stats */}
      {plans.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t('plans.stats.active'),    value: active,    color: 'text-indigo-600' },
            { label: t('plans.stats.draft'),     value: draft,     color: 'text-slate-500'  },
            { label: t('plans.stats.completed'), value: completed, color: 'text-green-600'  },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('common.search')}
            className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm w-44"/>
        </div>
        <select value={filterAthlete} onChange={e => setFilterAthlete(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <option value="">{t('plans.allAthletes')}</option>
          {athletes.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <option value="">{t('plans.allStatuses')}</option>
          {Object.entries(PLAN_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-500"/></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Target className="w-12 h-12 mb-3 opacity-30"/>
          <p className="font-medium">{plans.length === 0 ? t('plans.empty') : t('common.noResults')}</p>
          {plans.length === 0 && (
            <button onClick={() => navigate('/development-plans/new')}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
              {t('plans.createFirst')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(plan => (
            <div key={plan.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Plan header */}
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {plan.athlete?.photo_url ? (
                      <img src={plan.athlete.photo_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0"/>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                        {plan.athlete?.full_name?.charAt(0) ?? '?'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{plan.title}</p>
                      <p className="text-xs text-slate-400">{plan.athlete?.full_name} · {fmtDate(plan.start_date)}{plan.end_date ? ` → ${fmtDate(plan.end_date)}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PLAN_STATUS_COLORS[plan.status ?? 'draft']}`}>
                      {PLAN_STATUS_LABELS[plan.status ?? 'draft']}
                    </span>
                    {plan.status === 'draft' && (
                      <button onClick={() => sharePlan(plan.id!)} disabled={sharing === plan.id}
                        title={t('plans.share')}
                        className="p-1.5 rounded hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 disabled:opacity-50">
                        {sharing === plan.id ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Send className="w-3.5 h-3.5"/>}
                      </button>
                    )}
                    <button onClick={() => navigate(`/development-plans/${plan.id}`)}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600">
                      <Pencil className="w-3.5 h-3.5"/>
                    </button>
                    <button onClick={() => deletePlan(plan.id!)}
                      className="p-1.5 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-500">
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                    <button onClick={() => setExpanded(e => e === plan.id ? null : plan.id!)}
                      className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-50">
                      {expanded === plan.id ? t('common.close') : t('plans.showGoals')}
                    </button>
                  </div>
                </div>
                {plan.description && <p className="text-sm text-slate-500 mt-2 ml-12">{plan.description}</p>}
              </div>

              {/* Goals (expanded) — requires loading with goals */}
              {expanded === plan.id && <GoalsExpanded planId={plan.id!}/>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Lazy-loads goals when a plan is expanded
const GoalsExpanded: React.FC<{ planId: string }> = ({ planId }) => {
  const { t } = useLanguage();
  const [goals,   setGoals]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    developmentPlanService.getById(planId).then(p => {
      setGoals(p.goals ?? []);
      setLoading(false);
    });
  }, [planId]);

  const toggleStatus = async (goal: any) => {
    const next = goal.status === 'pending' ? 'in_progress'
               : goal.status === 'in_progress' ? 'achieved'
               : 'pending';
    setUpdating(goal.id);
    await developmentPlanService.updateGoalStatus(goal.id, next);
    setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, status: next } : g));
    setUpdating(null);
  };

  if (loading) return <div className="px-5 pb-4 flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-3.5 h-3.5 animate-spin"/> {t('plans.loading')}</div>;
  if (!goals.length) return <div className="px-5 pb-4 text-sm text-slate-400">{t('plans.noGoals')}</div>;

  return (
    <div className="border-t border-slate-100 px-5 py-4 space-y-2">
      {goals.map(goal => (
        <div key={goal.id} className="flex items-start gap-3 py-2">
          <button onClick={() => toggleStatus(goal)} disabled={updating === goal.id}
            className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 shrink-0 transition-colors ${
              goal.status === 'achieved'    ? 'bg-green-500 border-green-500 text-white' :
              goal.status === 'in_progress' ? 'border-blue-500 bg-blue-50' : 'border-slate-300'
            }`}>
            {goal.status === 'achieved' && <CheckCircle2 className="w-3 h-3"/>}
            {updating === goal.id && <Loader2 className="w-3 h-3 animate-spin"/>}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {goal.skill?.name && (
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full">{goal.skill.name}</span>
              )}
              {goal.target_score && (
                <span className="text-xs text-slate-400">meta: {goal.target_score}/10</span>
              )}
              {goal.deadline && (
                <span className="text-xs text-slate-400">prazo: {new Date(goal.deadline + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })}</span>
              )}
              <span className={`ml-auto px-2 py-0.5 text-xs rounded-full font-medium ${GOAL_STATUS_COLORS[goal.status as keyof typeof GOAL_STATUS_COLORS] ?? ''}`}>
                {goal.status === 'pending' ? t('goals.pending') : goal.status === 'in_progress' ? t('goals.inProgress') : goal.status === 'achieved' ? t('goals.achieved') : goal.status === 'cancelled' ? t('goals.cancelled') : goal.status}
              </span>
            </div>
            {goal.description && <p className="text-sm text-slate-600 mt-0.5">{goal.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DevelopmentPlans;
