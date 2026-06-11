import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Star, Loader2, X, Check, Calendar } from 'lucide-react';
import { seasonService, Season } from '../services/seasonService';
import { useLanguage } from '../contexts/LanguageContext';

const EMPTY: Omit<Season, 'id' | 'tenant_id' | 'created_at' | 'updated_at'> = {
    name: '', year: new Date().getFullYear(), start_date: '', end_date: '', is_current: false,
};

const Seasons: React.FC = () => {
    const { language } = useLanguage();
    const t = (pt: string, en: string) => language === 'en-US' ? en : pt;

    const [seasons, setSeasons] = useState<Season[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [modal, setModal] = useState<{ open: boolean; data: typeof EMPTY & { id?: string } }>({
        open: false, data: { ...EMPTY },
    });
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try { setSeasons(await seasonService.list()); }
        catch { setError(t('Erro ao carregar temporadas', 'Error loading seasons')); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openCreate = () => setModal({ open: true, data: { ...EMPTY } });
    const openEdit = (s: Season) => setModal({
        open: true,
        data: { id: s.id, name: s.name, year: s.year, start_date: s.start_date ?? '', end_date: s.end_date ?? '', is_current: s.is_current },
    });

    const handleSave = async () => {
        if (!modal.data.name.trim()) return;
        setSaving(true);
        setError(null);
        try {
            const { id, ...payload } = modal.data;
            if (id) await seasonService.update(id, payload);
            else await seasonService.create(payload);
            setModal({ open: false, data: { ...EMPTY } });
            await load();
        } catch (e: any) {
            setError(e.message ?? t('Erro ao salvar', 'Error saving'));
        } finally { setSaving(false); }
    };

    const handleSetCurrent = async (id: string) => {
        try { await seasonService.setCurrent(id); await load(); }
        catch { setError(t('Erro ao definir temporada atual', 'Error setting current season')); }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        setSaving(true);
        try { await seasonService.delete(deleteId); setDeleteId(null); await load(); }
        catch { setError(t('Erro ao excluir', 'Error deleting')); }
        finally { setSaving(false); }
    };

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{t('Temporadas', 'Seasons')}</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{t('Gerencie as temporadas / anos letivos do clube', 'Manage club seasons and school years')}</p>
                </div>
                <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark transition-colors">
                    <Plus className="w-4 h-4" />
                    {t('Nova Temporada', 'New Season')}
                </button>
            </div>

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : seasons.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{t('Nenhuma temporada cadastrada', 'No seasons registered')}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {seasons.map(s => (
                        <div key={s.id} className={`flex items-center gap-4 p-4 bg-white rounded-xl border-2 ${s.is_current ? 'border-primary/30 bg-primary/5' : 'border-slate-100'}`}>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-800">{s.name}</span>
                                    {s.is_current && (
                                        <span className="px-2 py-0.5 text-[11px] font-bold bg-primary text-white rounded-full uppercase">
                                            {t('Atual', 'Current')}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {s.start_date && s.end_date
                                        ? `${new Date(s.start_date + 'T12:00').toLocaleDateString()} – ${new Date(s.end_date + 'T12:00').toLocaleDateString()}`
                                        : s.year}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {!s.is_current && (
                                    <button onClick={() => handleSetCurrent(s.id)} title={t('Definir como atual', 'Set as current')}
                                        className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors">
                                        <Star className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={() => openEdit(s)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => setDeleteId(s.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
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
                                {modal.data.id ? t('Editar Temporada', 'Edit Season') : t('Nova Temporada', 'New Season')}
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
                                    placeholder={t('Ex: Temporada 2026', 'E.g.: Season 2026')}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Ano', 'Year')} *</label>
                                <input type="number" value={modal.data.year} onChange={e => setModal(m => ({ ...m, data: { ...m.data, year: Number(e.target.value) } }))}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Início', 'Start')}</label>
                                    <input type="date" value={modal.data.start_date ?? ''} onChange={e => setModal(m => ({ ...m, data: { ...m.data, start_date: e.target.value } }))}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Fim', 'End')}</label>
                                    <input type="date" value={modal.data.end_date ?? ''} onChange={e => setModal(m => ({ ...m, data: { ...m.data, end_date: e.target.value } }))}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                </div>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={modal.data.is_current} onChange={e => setModal(m => ({ ...m, data: { ...m.data, is_current: e.target.checked } }))}
                                    className="w-4 h-4 accent-primary" />
                                <span className="text-sm text-slate-700">{t('Definir como temporada atual', 'Set as current season')}</span>
                            </label>
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
                        <h2 className="text-lg font-bold text-slate-800 mb-2">{t('Excluir temporada?', 'Delete season?')}</h2>
                        <p className="text-sm text-slate-500 mb-6">{t('Turmas vinculadas podem ser afetadas.', 'Linked groups may be affected.')}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200">{t('Cancelar', 'Cancel')}</button>
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

export default Seasons;
