import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Loader2, X, Check, Tags } from 'lucide-react';
import { ageCategoryService, AgeCategory } from '../services/ageCategoryService';
import { useLanguage } from '../contexts/LanguageContext';

const EMPTY: Omit<AgeCategory, 'id' | 'tenant_id' | 'created_at' | 'updated_at'> = {
    name: '', min_birth_year: null, max_birth_year: null, sort_order: 0,
};

const AgeCategories: React.FC = () => {
    const { language } = useLanguage();
    const t = (pt: string, en: string) => language === 'en-US' ? en : pt;

    const [categories, setCategories] = useState<AgeCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [modal, setModal] = useState<{ open: boolean; data: typeof EMPTY & { id?: string } }>({
        open: false, data: { ...EMPTY },
    });
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try { setCategories(await ageCategoryService.list()); }
        catch { setError(t('Erro ao carregar categorias', 'Error loading categories')); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openCreate = () => {
        const nextOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) + 1 : 0;
        setModal({ open: true, data: { ...EMPTY, sort_order: nextOrder } });
    };
    const openEdit = (c: AgeCategory) => setModal({
        open: true,
        data: { id: c.id, name: c.name, min_birth_year: c.min_birth_year, max_birth_year: c.max_birth_year, sort_order: c.sort_order },
    });

    const handleSave = async () => {
        if (!modal.data.name.trim()) return;
        setSaving(true);
        setError(null);
        try {
            const { id, ...payload } = modal.data;
            if (id) await ageCategoryService.update(id, payload);
            else await ageCategoryService.create(payload);
            setModal({ open: false, data: { ...EMPTY } });
            await load();
        } catch (e: any) {
            setError(e.message ?? t('Erro ao salvar', 'Error saving'));
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        setSaving(true);
        try { await ageCategoryService.delete(deleteId); setDeleteId(null); await load(); }
        catch { setError(t('Erro ao excluir', 'Error deleting')); }
        finally { setSaving(false); }
    };

    const yearRangeLabel = (c: AgeCategory) => {
        if (!c.min_birth_year && !c.max_birth_year) return '—';
        if (!c.min_birth_year) return `≤ ${c.max_birth_year}`;
        if (!c.max_birth_year) return `≥ ${c.min_birth_year}`;
        return `${c.min_birth_year} – ${c.max_birth_year}`;
    };

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{t('Categorias de Idade', 'Age Categories')}</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{t('Defina faixas etárias para auto-atribuição de categoria', 'Define age groups for automatic category assignment')}</p>
                </div>
                <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark transition-colors">
                    <Plus className="w-4 h-4" />
                    {t('Nova Categoria', 'New Category')}
                </button>
            </div>

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : categories.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <Tags className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{t('Nenhuma categoria cadastrada', 'No categories registered')}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {categories.map(c => (
                        <div key={c.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border-2 border-slate-100">
                            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-primary">{c.sort_order + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <span className="font-semibold text-slate-800">{c.name}</span>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {t('Ano de nascimento:', 'Birth year:')} {yearRangeLabel(c)}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => openEdit(c)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => setDeleteId(c.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create / Edit Modal */}
            {modal.open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h2 className="text-lg font-bold text-slate-800">
                                {modal.data.id ? t('Editar Categoria', 'Edit Category') : t('Nova Categoria', 'New Category')}
                            </h2>
                            <button onClick={() => setModal({ open: false, data: { ...EMPTY } })} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Nome', 'Name')} *</label>
                                <input value={modal.data.name} onChange={e => setModal(m => ({ ...m, data: { ...m.data, name: e.target.value } }))}
                                    placeholder="Sub-17"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Ano nasc. mínimo', 'Min birth year')}</label>
                                    <input type="number" value={modal.data.min_birth_year ?? ''}
                                        onChange={e => setModal(m => ({ ...m, data: { ...m.data, min_birth_year: e.target.value ? Number(e.target.value) : null } }))}
                                        placeholder="2007"
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Ano nasc. máximo', 'Max birth year')}</label>
                                    <input type="number" value={modal.data.max_birth_year ?? ''}
                                        onChange={e => setModal(m => ({ ...m, data: { ...m.data, max_birth_year: e.target.value ? Number(e.target.value) : null } }))}
                                        placeholder="2010"
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Ordem de exibição', 'Display order')}</label>
                                <input type="number" value={modal.data.sort_order}
                                    onChange={e => setModal(m => ({ ...m, data: { ...m.data, sort_order: Number(e.target.value) } }))}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                            </div>
                            <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-lg">
                                {t(
                                    'Atletas com data de nascimento dentro desses anos serão auto-categorizados ao salvar.',
                                    'Athletes born within these years will be auto-categorized when saved.'
                                )}
                            </p>
                        </div>
                        <div className="flex gap-3 p-6 pt-0">
                            <button onClick={() => setModal({ open: false, data: { ...EMPTY } })} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors">
                                {t('Cancelar', 'Cancel')}
                            </button>
                            <button onClick={handleSave} disabled={saving || !modal.data.name.trim()} className="flex-1 px-4 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                {t('Salvar', 'Save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirm */}
            {deleteId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                        <h2 className="text-lg font-bold text-slate-800 mb-2">{t('Excluir categoria?', 'Delete category?')}</h2>
                        <p className="text-sm text-slate-500 mb-6">{t('Turmas vinculadas a essa categoria podem ser afetadas.', 'Groups linked to this category may be affected.')}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-lg">{t('Cancelar', 'Cancel')}</button>
                            <button onClick={handleDelete} disabled={saving} className="flex-1 px-4 py-2.5 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2">
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {t('Excluir', 'Delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgeCategories;
