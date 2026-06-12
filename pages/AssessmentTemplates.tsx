import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Loader2, X, Save, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import {
  assessmentService,
  AssessmentTemplate,
  Skill,
  SkillCategory,
  DIMENSION_LABELS,
  DIMENSION_COLORS,
} from '../services/assessmentService';

const AssessmentTemplates: React.FC = () => {
  const [templates, setTemplates]   = useState<AssessmentTemplate[]>([]);
  const [skills,    setSkills]      = useState<Skill[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [loading,   setLoading]     = useState(true);

  // Template modal
  const [tplModal,  setTplModal]  = useState<Partial<AssessmentTemplate> | null>(null);
  const [tplSaving, setTplSaving] = useState(false);
  const [tplErr,    setTplErr]    = useState<string | null>(null);

  // Skill modal
  const [skillModal,  setSkillModal]  = useState<Partial<Skill> | null>(null);
  const [skillSaving, setSkillSaving] = useState(false);
  const [skillErr,    setSkillErr]    = useState<string | null>(null);

  // Category modal
  const [catModal,  setCatModal]  = useState<Partial<SkillCategory> | null>(null);
  const [catSaving, setCatSaving] = useState(false);
  const [catErr,    setCatErr]    = useState<string | null>(null);

  const [expandedSkills, setExpandedSkills] = useState(false);

  const load = async () => {
    setLoading(true);
    const [t, s, c] = await Promise.all([
      assessmentService.getTemplates(),
      assessmentService.getSkills(),
      assessmentService.getCategories(),
    ]);
    setTemplates(t); setSkills(s); setCategories(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Template CRUD ──
  const saveTpl = async () => {
    if (!tplModal) return;
    if (!tplModal.name?.trim()) { setTplErr('Nome é obrigatório.'); return; }
    if (!tplModal.skill_ids?.length) { setTplErr('Selecione ao menos 1 skill.'); return; }
    setTplSaving(true); setTplErr(null);
    try {
      if (tplModal.id) {
        const updated = await assessmentService.updateTemplate(tplModal.id, tplModal as AssessmentTemplate);
        setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
      } else {
        const created = await assessmentService.createTemplate({ name: tplModal.name!, description: tplModal.description ?? null, skill_ids: tplModal.skill_ids! });
        setTemplates(prev => [created, ...prev]);
      }
      setTplModal(null);
    } catch (e: any) { setTplErr(e.message); } finally { setTplSaving(false); }
  };

  const deleteTpl = async (id: string) => {
    if (!window.confirm('Remover modelo?')) return;
    await assessmentService.deleteTemplate(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const toggleSkillInTpl = (skillId: string) => {
    setTplModal(prev => {
      if (!prev) return prev;
      const ids = prev.skill_ids ?? [];
      return { ...prev, skill_ids: ids.includes(skillId) ? ids.filter(id => id !== skillId) : [...ids, skillId] };
    });
  };

  // ── Skill CRUD ──
  const saveSkill = async () => {
    if (!skillModal) return;
    if (!skillModal.name?.trim()) { setSkillErr('Nome é obrigatório.'); return; }
    setSkillSaving(true); setSkillErr(null);
    try {
      if (skillModal.id) {
        const updated = await assessmentService.updateSkill(skillModal.id, skillModal);
        setSkills(prev => prev.map(s => s.id === updated.id ? updated : s));
      } else {
        const created = await assessmentService.createSkill({
          name: skillModal.name!,
          description: skillModal.description ?? null,
          category_id: skillModal.category_id ?? null,
          scale_min: skillModal.scale_min ?? 1,
          scale_max: skillModal.scale_max ?? 10,
          rubric: skillModal.rubric ?? null,
          sort_order: skillModal.sort_order ?? 0,
        });
        setSkills(prev => [...prev, created]);
      }
      setSkillModal(null);
    } catch (e: any) { setSkillErr(e.message); } finally { setSkillSaving(false); }
  };

  const deleteSkill = async (id: string) => {
    if (!window.confirm('Remover skill?')) return;
    await assessmentService.deleteSkill(id);
    setSkills(prev => prev.filter(s => s.id !== id));
  };

  // ── Category CRUD ──
  const saveCat = async () => {
    if (!catModal) return;
    if (!catModal.name?.trim()) { setCatErr('Nome é obrigatório.'); return; }
    if (!catModal.dimension)    { setCatErr('Selecione uma dimensão.'); return; }
    setCatSaving(true); setCatErr(null);
    try {
      if (catModal.id) {
        const updated = await assessmentService.updateCategory(catModal.id, catModal as SkillCategory);
        setCategories(prev => prev.map(c => c.id === updated.id ? updated : c));
      } else {
        const created = await assessmentService.createCategory({ name: catModal.name!, dimension: catModal.dimension!, sort_order: catModal.sort_order ?? 0 });
        setCategories(prev => [...prev, created]);
      }
      setCatModal(null);
    } catch (e: any) { setCatErr(e.message); } finally { setCatSaving(false); }
  };

  // Group skills by category for template builder
  const skillsByCategory = categories.map(cat => ({
    cat,
    skills: skills.filter(s => s.category_id === cat.id),
  })).filter(g => g.skills.length > 0);
  const uncategorized = skills.filter(s => !s.category_id);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-500"/>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Modelos de Avaliação</h1>
          <p className="text-slate-500 text-sm mt-0.5">Configure skills e modelos de avaliação reutilizáveis.</p>
        </div>
        <button onClick={() => setTplModal({ skill_ids: [] })}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus className="w-4 h-4"/> Novo Modelo
        </button>
      </div>

      {/* Skills section (collapsible) */}
      <div className="bg-white rounded-xl border border-slate-200">
        <button onClick={() => setExpandedSkills(e => !e)}
          className="w-full flex items-center justify-between px-5 py-4 text-left">
          <span className="font-semibold text-slate-700">Skills Cadastradas ({skills.length})</span>
          <div className="flex items-center gap-2">
            <button onClick={e => { e.stopPropagation(); setSkillModal({ scale_min: 1, scale_max: 10, sort_order: 0 }); }}
              className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs hover:bg-slate-200">
              <Plus className="w-3 h-3"/> Skill
            </button>
            <button onClick={e => { e.stopPropagation(); setCatModal({ sort_order: 0 }); }}
              className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs hover:bg-slate-200">
              <Plus className="w-3 h-3"/> Categoria
            </button>
            {expandedSkills ? <ChevronUp className="w-4 h-4 text-slate-400"/> : <ChevronDown className="w-4 h-4 text-slate-400"/>}
          </div>
        </button>
        {expandedSkills && (
          <div className="border-t border-slate-100 p-4 space-y-4">
            {categories.map(cat => {
              const catSkills = skills.filter(s => s.category_id === cat.id);
              if (!catSkills.length) return null;
              const color = DIMENSION_COLORS[cat.dimension] || '#6366f1';
              return (
                <div key={cat.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}/>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{cat.name} · {DIMENSION_LABELS[cat.dimension]}</span>
                    <button onClick={() => setCatModal(cat)} className="text-slate-300 hover:text-indigo-500 ml-1"><Pencil className="w-3 h-3"/></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {catSkills.map(skill => (
                      <div key={skill.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                        <span className="text-slate-700">{skill.name}</span>
                        <div className="flex gap-1">
                          <button onClick={() => setSkillModal(skill)} className="text-slate-300 hover:text-indigo-500"><Pencil className="w-3 h-3"/></button>
                          <button onClick={() => deleteSkill(skill.id!)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-3 h-3"/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {uncategorized.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Sem categoria</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {uncategorized.map(skill => (
                    <div key={skill.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                      <span className="text-slate-700">{skill.name}</span>
                      <div className="flex gap-1">
                        <button onClick={() => setSkillModal(skill)} className="text-slate-300 hover:text-indigo-500"><Pencil className="w-3 h-3"/></button>
                        <button onClick={() => deleteSkill(skill.id!)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-3 h-3"/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {skills.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Nenhuma skill cadastrada ainda. Clique em "+ Skill" para começar.</p>
            )}
          </div>
        )}
      </div>

      {/* Templates list */}
      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <ClipboardList className="w-12 h-12 mb-3 opacity-30"/>
          <p className="font-medium">Nenhum modelo criado ainda</p>
          <p className="text-sm mt-1">Crie skills primeiro, depois monte um modelo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(tpl => {
            const tplSkills = skills.filter(s => tpl.skill_ids.includes(s.id!));
            return (
              <div key={tpl.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <p className="font-semibold text-slate-800">{tpl.name}</p>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setTplModal(tpl)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5"/></button>
                    <button onClick={() => deleteTpl(tpl.id!)} className="p-1.5 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
                {tpl.description && <p className="text-sm text-slate-500 mb-3">{tpl.description}</p>}
                <p className="text-xs text-slate-400">{tplSkills.length} skill{tplSkills.length !== 1 ? 's' : ''}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tplSkills.slice(0, 5).map(s => (
                    <span key={s.id} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full">{s.name}</span>
                  ))}
                  {tplSkills.length > 5 && <span className="text-xs text-slate-400">+{tplSkills.length - 5}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Template Modal ── */}
      {tplModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <h2 className="text-lg font-semibold text-slate-800">{tplModal.id ? 'Editar Modelo' : 'Novo Modelo'}</h2>
              <button onClick={() => setTplModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome <span className="text-rose-500">*</span></label>
                <input value={tplModal.name || ''} onChange={e => setTplModal(p => ({ ...p!, name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descrição</label>
                <textarea value={tplModal.description || ''} onChange={e => setTplModal(p => ({ ...p!, description: e.target.value }))}
                  rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Skills incluídas <span className="text-rose-500">*</span></label>
                {skills.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhuma skill disponível. Cadastre skills primeiro.</p>
                ) : (
                  <div className="space-y-3">
                    {skillsByCategory.map(({ cat, skills: cs }) => (
                      <div key={cat.id}>
                        <p className="text-xs text-slate-400 font-medium mb-1.5">{cat.name}</p>
                        <div className="flex flex-wrap gap-2">
                          {cs.map(skill => {
                            const selected = (tplModal.skill_ids ?? []).includes(skill.id!);
                            return (
                              <button key={skill.id} onClick={() => toggleSkillInTpl(skill.id!)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                {skill.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {uncategorized.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-400 font-medium mb-1.5">Outros</p>
                        <div className="flex flex-wrap gap-2">
                          {uncategorized.map(skill => {
                            const selected = (tplModal.skill_ids ?? []).includes(skill.id!);
                            return (
                              <button key={skill.id} onClick={() => toggleSkillInTpl(skill.id!)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                {skill.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {tplErr && <p className="text-rose-600 text-xs bg-rose-50 rounded-lg px-3 py-2">{tplErr}</p>}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200 shrink-0">
              <button onClick={() => setTplModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
              <button onClick={saveTpl} disabled={tplSaving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {tplSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Skill Modal ── */}
      {skillModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">{skillModal.id ? 'Editar Skill' : 'Nova Skill'}</h2>
              <button onClick={() => setSkillModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome <span className="text-rose-500">*</span></label>
                <input value={skillModal.name || ''} onChange={e => setSkillModal(p => ({ ...p!, name: e.target.value }))}
                  placeholder="ex: Condução de bola"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Categoria</label>
                <select value={skillModal.category_id || ''} onChange={e => setSkillModal(p => ({ ...p!, category_id: e.target.value || null }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Sem categoria</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({DIMENSION_LABELS[c.dimension]})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descrição</label>
                <textarea value={skillModal.description || ''} onChange={e => setSkillModal(p => ({ ...p!, description: e.target.value }))}
                  rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Escala mínima</label>
                  <input type="number" value={skillModal.scale_min ?? 1} onChange={e => setSkillModal(p => ({ ...p!, scale_min: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Escala máxima</label>
                  <input type="number" value={skillModal.scale_max ?? 10} onChange={e => setSkillModal(p => ({ ...p!, scale_max: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
                </div>
              </div>
              {skillErr && <p className="text-rose-600 text-xs bg-rose-50 rounded-lg px-3 py-2">{skillErr}</p>}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setSkillModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
              <button onClick={saveSkill} disabled={skillSaving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {skillSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Category Modal ── */}
      {catModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">{catModal.id ? 'Editar Categoria' : 'Nova Categoria'}</h2>
              <button onClick={() => setCatModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome <span className="text-rose-500">*</span></label>
                <input value={catModal.name || ''} onChange={e => setCatModal(p => ({ ...p!, name: e.target.value }))}
                  placeholder="ex: Técnico"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Dimensão <span className="text-rose-500">*</span></label>
                <select value={catModal.dimension || ''} onChange={e => setCatModal(p => ({ ...p!, dimension: e.target.value as any }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Selecionar...</option>
                  {Object.entries(DIMENSION_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              {catErr && <p className="text-rose-600 text-xs bg-rose-50 rounded-lg px-3 py-2">{catErr}</p>}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setCatModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
              <button onClick={saveCat} disabled={catSaving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {catSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentTemplates;
