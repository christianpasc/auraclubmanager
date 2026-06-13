import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Save, ArrowLeft, ChevronDown } from 'lucide-react';
import { assessmentService, AssessmentTemplate, Skill, SkillCategory, DIMENSION_LABELS, DIMENSION_COLORS } from '../services/assessmentService';
import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';
import { useLanguage } from '../contexts/LanguageContext';

interface AthleteOption { id: string; full_name: string; }
interface GroupOption   { id: string; name: string; }

interface ScoreRow {
  skill_id: string;
  score: number;
  comment: string;
}

const AssessmentForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isEdit = Boolean(id);

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState<string | null>(null);

  // Reference data
  const [athletes,   setAthletes]   = useState<AthleteOption[]>([]);
  const [groups,     setGroups]     = useState<GroupOption[]>([]);
  const [templates,  setTemplates]  = useState<AssessmentTemplate[]>([]);
  const [allSkills,  setAllSkills]  = useState<Skill[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);

  // Form state
  const [athleteId,   setAthleteId]   = useState('');
  const [templateId,  setTemplateId]  = useState('');
  const [groupId,     setGroupId]     = useState('');
  const [assessedAt,  setAssessedAt]  = useState(new Date().toISOString().slice(0, 10));
  const [notes,       setNotes]       = useState('');
  const [scoreRows,   setScoreRows]   = useState<ScoreRow[]>([]);

  const activeSkills = templateId
    ? allSkills.filter(s => {
        const tpl = templates.find(t => t.id === templateId);
        return tpl?.skill_ids.includes(s.id!);
      })
    : allSkills;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const tenantId = getCurrentTenantIdSync();
      const [athletesRes, groupsRes, tpls, skills, cats] = await Promise.all([
        supabase.from('athletes').select('id, full_name').eq('tenant_id', tenantId!).eq('status', 'active').order('full_name'),
        supabase.from('groups').select('id, name').eq('tenant_id', tenantId!).order('name'),
        assessmentService.getTemplates(),
        assessmentService.getSkills(),
        assessmentService.getCategories(),
      ]);
      setAthletes((athletesRes.data ?? []) as AthleteOption[]);
      setGroups((groupsRes.data ?? []) as GroupOption[]);
      setTemplates(tpls);
      setAllSkills(skills);
      setCategories(cats);

      if (isEdit && id) {
        const a = await assessmentService.getById(id);
        setAthleteId(a.athlete_id);
        setTemplateId(a.template_id ?? '');
        setGroupId(a.group_id ?? '');
        setAssessedAt(a.assessed_at);
        setNotes(a.notes ?? '');
        setScoreRows((a.scores ?? []).map(s => ({ skill_id: s.skill_id, score: s.score, comment: s.comment ?? '' })));
      }
      setLoading(false);
    };
    load();
  }, [id]);

  // When template changes, re-init score rows preserving existing scores
  useEffect(() => {
    const skillsToShow = templateId
      ? allSkills.filter(s => { const t = templates.find(t => t.id === templateId); return t?.skill_ids.includes(s.id!); })
      : allSkills;
    setScoreRows(prev => skillsToShow.map(s => {
      const existing = prev.find(r => r.skill_id === s.id);
      return existing ?? { skill_id: s.id!, score: Math.round((s.scale_min ?? 1) + ((s.scale_max ?? 10) - (s.scale_min ?? 1)) / 2), comment: '' };
    }));
  }, [templateId, allSkills, templates]);

  const setScore   = (skillId: string, score: number) => setScoreRows(prev => prev.map(r => r.skill_id === skillId ? { ...r, score } : r));
  const setComment = (skillId: string, comment: string) => setScoreRows(prev => prev.map(r => r.skill_id === skillId ? { ...r, comment } : r));

  const submit = async () => {
    if (!athleteId) { setErr('Selecione um atleta.'); return; }
    if (scoreRows.length === 0) { setErr('Selecione um modelo ou adicione skills para avaliar.'); return; }
    setSaving(true); setErr(null);
    try {
      let assessmentId = id;
      const payload = {
        athlete_id: athleteId,
        template_id: templateId || null,
        group_id: groupId || null,
        notes: notes.trim() || null,
        assessed_at: assessedAt,
      };
      if (isEdit && id) {
        await assessmentService.update(id, payload);
      } else {
        const created = await assessmentService.create(payload);
        assessmentId = created.id;
      }
      await assessmentService.saveScores(assessmentId!, scoreRows.map(r => ({ skill_id: r.skill_id, score: r.score, comment: r.comment || null })));
      navigate('/assessments');
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  // Group active skills by category for display
  const skillsByCategory = categories.map(cat => ({
    cat,
    skills: activeSkills.filter(s => s.category_id === cat.id),
  })).filter(g => g.skills.length > 0);
  const uncategorized = activeSkills.filter(s => !s.category_id);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-500"/>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/assessments')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-5 h-5"/>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{isEdit ? t('assessments.editTitle') : t('assessments.newTitle')}</h1>
          <p className="text-slate-500 text-sm">{t('assessments.subtitle')}</p>
        </div>
      </div>

      {/* Basic info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">{t('assessments.section.info')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.athlete')} <span className="text-rose-500">*</span></label>
            <select value={athleteId} onChange={e => setAthleteId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Selecionar atleta...</option>
              {athletes.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('assessments.date')}</label>
            <input type="date" value={assessedAt} onChange={e => setAssessedAt(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('assessments.template')}</label>
            <div className="relative">
              <select value={templateId} onChange={e => setTemplateId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm appearance-none">
                <option value="">{t('assessments.allSkills')}</option>
                {templates.map(t => <option key={t.id} value={t.id!}>{t.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('assessments.group')}</label>
            <select value={groupId} onChange={e => setGroupId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">{t('assessments.noGroup')}</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">{t('assessments.notes')}</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"/>
        </div>
      </div>

      {/* Score cards */}
      {activeSkills.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
          <p className="text-amber-700 text-sm font-medium">{t('assessments.noSkills')}</p>
          <p className="text-amber-600 text-xs mt-1">{t('assessments.noSkillsAction')}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {[...skillsByCategory, ...(uncategorized.length > 0 ? [{ cat: null, skills: uncategorized }] : [])].map(({ cat, skills: cs }) => {
            const color = cat ? (DIMENSION_COLORS[cat.dimension] || '#6366f1') : '#94a3b8';
            return (
              <div key={cat?.id ?? 'uncategorized'} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}/>
                  <h3 className="font-semibold text-slate-700">
                    {cat ? `${cat.name}` : 'Outros'}
                    {cat && <span className="ml-2 text-xs font-normal text-slate-400">{DIMENSION_LABELS[cat.dimension]}</span>}
                  </h3>
                </div>
                <div className="space-y-5">
                  {cs.map(skill => {
                    const row = scoreRows.find(r => r.skill_id === skill.id);
                    const score = row?.score ?? skill.scale_min ?? 1;
                    const min = skill.scale_min ?? 1;
                    const max = skill.scale_max ?? 10;
                    const pct = ((score - min) / (max - min)) * 100;
                    return (
                      <div key={skill.id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div>
                            <span className="text-sm font-medium text-slate-700">{skill.name}</span>
                            {skill.description && <p className="text-xs text-slate-400 mt-0.5">{skill.description}</p>}
                          </div>
                          <span className="text-lg font-bold tabular-nums" style={{ color }}>{score}</span>
                        </div>
                        <input
                          type="range"
                          min={min} max={max} step={0.5}
                          value={score}
                          onChange={e => setScore(skill.id!, Number(e.target.value))}
                          className="w-full accent-indigo-600 h-2"
                          style={{ accentColor: color }}
                        />
                        <div className="flex justify-between text-[10px] text-slate-300 mt-0.5">
                          <span>{min}</span><span>{max}</span>
                        </div>
                        <input
                          value={row?.comment ?? ''}
                          onChange={e => setComment(skill.id!, e.target.value)}
                          placeholder="Comentário (opcional)"
                          className="mt-2 w-full border border-slate-100 rounded-lg px-3 py-1.5 text-xs text-slate-600 bg-slate-50 focus:border-slate-300 outline-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {err && <p className="text-rose-600 text-sm bg-rose-50 rounded-xl px-4 py-3">{err}</p>}

      {/* Actions */}
      <div className="flex justify-end gap-3 pb-8">
        <button onClick={() => navigate('/assessments')} className="px-5 py-2.5 text-sm text-slate-600 hover:text-slate-800">{t('common.cancel')}</button>
        <button onClick={submit} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
          {isEdit ? t('assessments.saveChanges') : t('assessments.save')}
        </button>
      </div>
    </div>
  );
};

export default AssessmentForm;
