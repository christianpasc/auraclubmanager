import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Save, Plus, Trash2, Send,
} from 'lucide-react';
import {
  developmentPlanService, DevelopmentGoal, PLAN_STATUS_LABELS,
} from '../services/developmentPlanService';
import { assessmentService, Skill } from '../services/assessmentService';
import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';

interface AthleteOption { id: string; full_name: string; }

let goalCounter = 0;
const emptyGoal = (): DevelopmentGoal & { localId: string } => ({
  localId: `goal-${++goalCounter}`,
  skill_id: null,
  description: '',
  target_score: null,
  deadline: null,
  status: 'pending',
  notes: null,
});

const GOAL_STATUS_LABELS = {
  pending: 'Pendente', in_progress: 'Em andamento', achieved: 'Alcançada', cancelled: 'Cancelada',
} as const;

const DevelopmentPlanForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [sharing,  setSharing]  = useState(false);
  const [err,      setErr]      = useState<string | null>(null);
  const [shared,   setShared]   = useState(false);

  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [skills,   setSkills]   = useState<Skill[]>([]);

  // Form state
  const [athleteId,    setAthleteId]    = useState('');
  const [title,        setTitle]        = useState('');
  const [description,  setDescription]  = useState('');
  const [startDate,    setStartDate]    = useState(new Date().toISOString().slice(0, 10));
  const [endDate,      setEndDate]      = useState('');
  const [status,       setStatus]       = useState<'draft' | 'active' | 'completed'>('draft');
  const [goals,        setGoals]        = useState<(DevelopmentGoal & { localId: string })[]>([emptyGoal()]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const tenantId = getCurrentTenantIdSync();
      const [athletesRes, skillsData] = await Promise.all([
        supabase.from('athletes').select('id, full_name').eq('tenant_id', tenantId!).eq('status', 'active').order('full_name'),
        assessmentService.getSkills(),
      ]);
      setAthletes((athletesRes.data ?? []) as AthleteOption[]);
      setSkills(skillsData);

      if (isEdit && id) {
        const plan = await developmentPlanService.getById(id);
        setAthleteId(plan.athlete_id);
        setTitle(plan.title);
        setDescription(plan.description ?? '');
        setStartDate(plan.start_date);
        setEndDate(plan.end_date ?? '');
        setStatus(plan.status ?? 'draft');
        setGoals(
          (plan.goals ?? []).map(g => ({ ...g, localId: `goal-${++goalCounter}` }))
        );
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const addGoal    = () => setGoals(prev => [...prev, emptyGoal()]);
  const removeGoal = (localId: string) => setGoals(prev => prev.filter(g => g.localId !== localId));
  const updateGoal = (localId: string, patch: Partial<DevelopmentGoal>) =>
    setGoals(prev => prev.map(g => g.localId === localId ? { ...g, ...patch } : g));

  const submit = async (andShare = false) => {
    if (!title.trim())   { setErr('Título é obrigatório.'); return; }
    if (!athleteId)      { setErr('Selecione um atleta.'); return; }
    if (!startDate)      { setErr('Data de início é obrigatória.'); return; }
    const validGoals = goals.filter(g => g.description?.trim() || g.skill_id);
    if (!validGoals.length) { setErr('Adicione pelo menos 1 meta.'); return; }

    andShare ? setSharing(true) : setSaving(true);
    setErr(null);
    try {
      const payload = {
        athlete_id: athleteId,
        title: title.trim(),
        description: description.trim() || null,
        start_date: startDate,
        end_date: endDate || null,
        status,
      };
      let planId = id;
      if (isEdit && id) {
        await developmentPlanService.update(id, payload);
      } else {
        const created = await developmentPlanService.create(payload);
        planId = created.id;
      }
      await developmentPlanService.saveGoals(planId!, validGoals.map(g => ({
        skill_id: g.skill_id ?? null,
        description: g.description?.trim() ?? null,
        target_score: g.target_score ?? null,
        deadline: g.deadline ?? null,
        status: g.status ?? 'pending',
        notes: g.notes ?? null,
      })));

      if (andShare && planId) {
        await developmentPlanService.share(planId);
        setShared(true);
      }
      navigate('/development-plans');
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); setSharing(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-500"/>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/development-plans')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-5 h-5"/>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{isEdit ? 'Editar PDI' : 'Novo Plano de Desenvolvimento'}</h1>
          <p className="text-slate-500 text-sm">Defina metas de evolução por skill e prazo.</p>
        </div>
      </div>

      {/* Plan info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Informações do Plano</h2>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Atleta <span className="text-rose-500">*</span></label>
          <select value={athleteId} onChange={e => setAthleteId(e.target.value)}
            disabled={isEdit}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50">
            <option value="">Selecionar atleta...</option>
            {athletes.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Título do PDI <span className="text-rose-500">*</span></label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="ex: Desenvolvimento técnico Sub-17 — 2º semestre"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Descrição</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"/>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Início <span className="text-rose-500">*</span></label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Término</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              {Object.entries(PLAN_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Goals */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Metas ({goals.filter(g => g.description?.trim() || g.skill_id).length})</h2>
          <button onClick={addGoal}
            className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 text-sm font-medium">
            <Plus className="w-4 h-4"/> Adicionar meta
          </button>
        </div>

        <div className="space-y-4">
          {goals.map((goal, idx) => (
            <div key={goal.localId} className="border border-slate-100 rounded-xl p-4 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase">Meta {idx + 1}</span>
                {goals.length > 1 && (
                  <button onClick={() => removeGoal(goal.localId)} className="text-slate-300 hover:text-rose-500">
                    <Trash2 className="w-3.5 h-3.5"/>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Skill vinculada</label>
                  <select value={goal.skill_id ?? ''} onChange={e => updateGoal(goal.localId, { skill_id: e.target.value || null })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white">
                    <option value="">Sem skill específica</option>
                    {skills.map(s => <option key={s.id} value={s.id!}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nota alvo</label>
                  <input type="number" min="0" max="10" step="0.5"
                    value={goal.target_score ?? ''} onChange={e => updateGoal(goal.localId, { target_score: e.target.value ? Number(e.target.value) : null })}
                    placeholder="ex: 7.5"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descrição da meta</label>
                <input value={goal.description ?? ''} onChange={e => updateGoal(goal.localId, { description: e.target.value })}
                  placeholder="O que o atleta deve alcançar..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Prazo</label>
                  <input type="date" value={goal.deadline ?? ''} onChange={e => updateGoal(goal.localId, { deadline: e.target.value || null })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                  <select value={goal.status ?? 'pending'} onChange={e => updateGoal(goal.localId, { status: e.target.value as any })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white">
                    {Object.entries(GOAL_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {err && <p className="text-rose-600 text-sm bg-rose-50 rounded-xl px-4 py-3">{err}</p>}
      {shared && <p className="text-green-700 text-sm bg-green-50 rounded-xl px-4 py-3">PDI compartilhado! Atleta e responsáveis foram notificados.</p>}

      {/* Actions */}
      <div className="flex flex-wrap justify-end gap-3 pb-8">
        <button onClick={() => navigate('/development-plans')} className="px-5 py-2.5 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
        <button onClick={() => submit(false)} disabled={saving || sharing}
          className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
          Salvar rascunho
        </button>
        <button onClick={() => submit(true)} disabled={saving || sharing}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50">
          {sharing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
          Salvar e compartilhar
        </button>
      </div>
    </div>
  );
};

export default DevelopmentPlanForm;
