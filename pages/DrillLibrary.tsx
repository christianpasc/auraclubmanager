import React, { useState, useEffect } from 'react';
import {
  Plus, Loader2, Pencil, Trash2, BookOpen, Search, X, Save, Tag,
  Clock, Zap,
} from 'lucide-react';
import {
  drillService, Drill, DrillCategory, INTENSITY_LABELS, INTENSITY_COLORS,
} from '../services/drillService';

const CATEGORY_COLORS = [
  '#6366f1','#14b8a6','#f59e0b','#ec4899','#22c55e','#ef4444','#3b82f6','#8b5cf6',
];

// ── Drill Modal ───────────────────────────────────────────────────────────────
interface DrillModalProps {
  initial: Partial<Drill>;
  categories: DrillCategory[];
  onSave: (d: Drill) => void;
  onClose: () => void;
}
const DrillModal: React.FC<DrillModalProps> = ({ initial, categories, onSave, onClose }) => {
  const [name,        setName]        = useState(initial.name ?? '');
  const [categoryId,  setCategoryId]  = useState(initial.category_id ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [duration,    setDuration]    = useState(initial.duration_minutes ? String(initial.duration_minutes) : '');
  const [intensity,   setIntensity]   = useState<'low'|'medium'|'high'>(initial.intensity ?? 'medium');
  const [objectives,  setObjectives]  = useState((initial.objectives ?? []).join('\n'));
  const [equipment,   setEquipment]   = useState((initial.equipment ?? []).join('\n'));
  const [tagsRaw,     setTagsRaw]     = useState((initial.tags ?? []).join(', '));
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) { setErr('Nome é obrigatório.'); return; }
    setSaving(true); setErr(null);
    try {
      const payload = {
        name: name.trim(),
        category_id: categoryId || null,
        description: description.trim() || null,
        duration_minutes: duration ? parseInt(duration) : null,
        intensity,
        objectives: objectives.split('\n').map(s => s.trim()).filter(Boolean),
        equipment:  equipment.split('\n').map(s => s.trim()).filter(Boolean),
        is_public: false,
      };
      let drill: Drill;
      if (initial.id) {
        drill = await drillService.update(initial.id, payload);
      } else {
        drill = await drillService.create(payload);
      }
      const tags = tagsRaw.split(',').map(s => s.trim()).filter(Boolean);
      await drillService.saveTags(drill.id!, tags);
      onSave({ ...drill, tags });
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">{initial.id ? 'Editar Exercício' : 'Novo Exercício'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nome <span className="text-rose-500">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="ex: Rondo 4x1"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Categoria</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Sem categoria</option>
                {categories.map(c => <option key={c.id} value={c.id!}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Intensidade</label>
              <select value={intensity} onChange={e => setIntensity(e.target.value as any)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {Object.entries(INTENSITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Duração (min)</label>
            <input type="number" min="1" value={duration} onChange={e => setDuration(e.target.value)}
              placeholder="ex: 15"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descrição / Como executar</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Objetivos (1 por linha)</label>
              <textarea value={objectives} onChange={e => setObjectives(e.target.value)} rows={3}
                placeholder="Condução de bola&#10;Visão periférica"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Materiais (1 por linha)</label>
              <textarea value={equipment} onChange={e => setEquipment(e.target.value)} rows={3}
                placeholder="Cones&#10;Coletes"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tags (separadas por vírgula)</label>
            <input value={tagsRaw} onChange={e => setTagsRaw(e.target.value)}
              placeholder="ex: posse, pressão, técnico"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
          </div>
          {err && <p className="text-rose-600 text-xs bg-rose-50 rounded-lg px-3 py-2">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Category Modal ────────────────────────────────────────────────────────────
interface CatModalProps {
  initial: Partial<DrillCategory>;
  onSave: (c: DrillCategory) => void;
  onClose: () => void;
}
const CatModal: React.FC<CatModalProps> = ({ initial, onSave, onClose }) => {
  const [name,    setName]    = useState(initial.name ?? '');
  const [color,   setColor]   = useState(initial.color ?? CATEGORY_COLORS[0]);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) { setErr('Nome é obrigatório.'); return; }
    setSaving(true); setErr(null);
    try {
      const result = initial.id
        ? await drillService.updateCategory(initial.id, { name: name.trim(), color })
        : await drillService.createCategory({ name: name.trim(), color });
      onSave(result);
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">{initial.id ? 'Editar Categoria' : 'Nova Categoria'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nome</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="ex: Posse de Bola"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Cor</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}/>
              ))}
            </div>
          </div>
          {err && <p className="text-rose-600 text-xs bg-rose-50 rounded-lg px-3 py-2">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Drill Card ─────────────────────────────────────────────────────────────────
interface DrillCardProps {
  drill: Drill;
  onEdit: () => void;
  onDelete: () => void;
}
const DrillCard: React.FC<DrillCardProps> = ({ drill, onEdit, onDelete }) => {
  const color = drill.category?.color ?? '#6366f1';
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {drill.category && (
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }}/>
          )}
          <p className="font-semibold text-slate-800 truncate">{drill.name}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5"/></button>
          <button onClick={onDelete} className="p-1.5 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5"/></button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {drill.intensity && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INTENSITY_COLORS[drill.intensity]}`}>
            <Zap className="w-3 h-3 inline mr-0.5"/>{INTENSITY_LABELS[drill.intensity]}
          </span>
        )}
        {drill.duration_minutes && (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="w-3 h-3"/>{drill.duration_minutes} min
          </span>
        )}
        {drill.category && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: color + '20', color }}>
            {drill.category.name}
          </span>
        )}
      </div>

      {drill.description && (
        <p className="text-sm text-slate-500 line-clamp-2">{drill.description}</p>
      )}

      {drill.objectives && drill.objectives.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {drill.objectives.slice(0, 3).map((o, i) => (
            <span key={i} className="text-xs bg-slate-50 text-slate-500 px-2 py-0.5 rounded">{o}</span>
          ))}
          {drill.objectives.length > 3 && <span className="text-xs text-slate-400">+{drill.objectives.length - 3}</span>}
        </div>
      )}

      {drill.tags && drill.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-50">
          <Tag className="w-3 h-3 text-slate-300 mt-0.5 shrink-0"/>
          {drill.tags.map((tag, i) => (
            <span key={i} className="text-xs text-slate-400">#{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const DrillLibrary: React.FC = () => {
  const [drills,     setDrills]     = useState<Drill[]>([]);
  const [categories, setCategories] = useState<DrillCategory[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [drillModal, setDrillModal] = useState<Partial<Drill> | null>(null);
  const [catModal,   setCatModal]   = useState<Partial<DrillCategory> | null>(null);

  const [search,        setSearch]        = useState('');
  const [filterCat,     setFilterCat]     = useState('');
  const [filterIntensity, setFilterIntensity] = useState('');

  const load = async () => {
    setLoading(true);
    const [d, c] = await Promise.all([drillService.getAll(), drillService.getCategories()]);
    setDrills(d); setCategories(c);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const saveDrill = (d: Drill) => {
    setDrills(prev => {
      const idx = prev.findIndex(x => x.id === d.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = d; return next; }
      return [...prev, d];
    });
    setDrillModal(null);
  };

  const deleteDrill = async (id: string) => {
    if (!window.confirm('Remover este exercício?')) return;
    await drillService.delete(id);
    setDrills(prev => prev.filter(d => d.id !== id));
  };

  const saveCat = (c: DrillCategory) => {
    setCategories(prev => {
      const idx = prev.findIndex(x => x.id === c.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = c; return next; }
      return [...prev, c];
    });
    setCatModal(null);
  };

  const filtered = drills.filter(d => {
    if (filterCat       && d.category_id    !== filterCat)       return false;
    if (filterIntensity && d.intensity      !== filterIntensity)  return false;
    if (search) {
      const q = search.toLowerCase();
      const inName = d.name.toLowerCase().includes(q);
      const inTags = (d.tags ?? []).some(t => t.toLowerCase().includes(q));
      const inObj  = (d.objectives ?? []).some(o => o.toLowerCase().includes(q));
      if (!inName && !inTags && !inObj) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Biblioteca de Exercícios</h1>
          <p className="text-slate-500 text-sm mt-0.5">{drills.length} exercício{drills.length !== 1 ? 's' : ''} cadastrado{drills.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCatModal({})}
            className="px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
            + Categoria
          </button>
          <button onClick={() => setDrillModal({ intensity: 'medium', objectives: [], equipment: [], tags: [] })}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4"/> Novo Exercício
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, tag ou objetivo..."
            className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm w-64"/>
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Todas categorias</option>
          {categories.map(c => <option key={c.id} value={c.id!}>{c.name}</option>)}
        </select>
        <select value={filterIntensity} onChange={e => setFilterIntensity(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Todas intensidades</option>
          {Object.entries(INTENSITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-500"/></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <BookOpen className="w-12 h-12 mb-3 opacity-30"/>
          <p className="font-medium">{drills.length === 0 ? 'Biblioteca vazia' : 'Nenhum resultado'}</p>
          {drills.length === 0 && (
            <button onClick={() => setDrillModal({ intensity: 'medium', objectives: [], equipment: [], tags: [] })}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
              Criar primeiro exercício
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(drill => (
            <DrillCard
              key={drill.id}
              drill={drill}
              onEdit={() => setDrillModal(drill)}
              onDelete={() => deleteDrill(drill.id!)}
            />
          ))}
        </div>
      )}

      {drillModal !== null && (
        <DrillModal
          initial={drillModal}
          categories={categories}
          onSave={saveDrill}
          onClose={() => setDrillModal(null)}
        />
      )}
      {catModal !== null && (
        <CatModal
          initial={catModal}
          onSave={saveCat}
          onClose={() => setCatModal(null)}
        />
      )}
    </div>
  );
};

export default DrillLibrary;
