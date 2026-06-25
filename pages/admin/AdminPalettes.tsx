import React, { useEffect, useState } from 'react';
import { paletteService, ColorPalette, PaletteColors } from '../../services/paletteService';
import { auditService } from '../../services/auditService';
import { Loader2, AlertTriangle, Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight, Palette as PaletteIcon, Check } from 'lucide-react';

const EMPTY_COLORS: PaletteColors = { primary: '#4f46e5', secondary: '#818cf8', accent: '#c7d2fe' };

const AdminPalettes: React.FC = () => {
    const [palettes, setPalettes] = useState<ColorPalette[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<ColorPalette | null>(null);
    const [name, setName] = useState('');
    const [colors, setColors] = useState<PaletteColors>(EMPTY_COLORS);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const load = async () => {
        try {
            setLoading(true);
            const data = await paletteService.getAll();
            setPalettes(data);
        } catch (err: any) {
            console.error('Error loading palettes:', err);
            setError(err.message || 'Erro ao carregar paletas.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const openCreate = () => {
        setEditing(null);
        setName('');
        setColors(EMPTY_COLORS);
        setShowModal(true);
    };

    const openEdit = (p: ColorPalette) => {
        setEditing(p);
        setName(p.name);
        setColors({ ...EMPTY_COLORS, ...p.colors });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            if (editing) {
                await paletteService.update(editing.id, { name: name.trim(), colors });
                await auditService.log('palette.update', 'color_palette', editing.id, { name: name.trim() });
            } else {
                const created = await paletteService.create(name.trim(), colors, palettes.length);
                await auditService.log('palette.create', 'color_palette', created.id, { name: name.trim() });
            }
            setShowModal(false);
            await load();
        } catch (err: any) {
            console.error('Error saving palette:', err);
            setError(err.message || 'Erro ao salvar paleta.');
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (p: ColorPalette) => {
        try {
            await paletteService.update(p.id, { is_active: !p.is_active });
            await load();
        } catch (err: any) {
            console.error('Error toggling palette:', err);
            setError(err.message || 'Erro ao alterar paleta.');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const deleted = palettes.find(p => p.id === id);
            await paletteService.delete(id);
            await auditService.log('palette.delete', 'color_palette', id, { name: deleted?.name });
            setDeleteConfirm(null);
            await load();
        } catch (err: any) {
            console.error('Error deleting palette:', err);
            setError(err.message || 'Erro ao excluir paleta.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Paletas</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Cores que os clubes podem escolher em Configurações.</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nova Paleta
                </button>
            </div>

            {error && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {palettes.map(p => (
                    <div key={p.id} className={`bg-white rounded-xl border p-4 space-y-3 ${p.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800 text-sm">{p.name}</span>
                            <button onClick={() => handleToggle(p)} title={p.is_active ? 'Desativar' : 'Ativar'}>
                                {p.is_active
                                    ? <ToggleRight className="w-6 h-6 text-green-500" />
                                    : <ToggleLeft className="w-6 h-6 text-slate-300" />}
                            </button>
                        </div>
                        <div className="flex gap-2">
                            {[p.colors.primary, p.colors.secondary, p.colors.accent].filter(Boolean).map((c, i) => (
                                <div key={i} className="w-10 h-10 rounded-lg border border-slate-200" style={{ background: c }} />
                            ))}
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={() => openEdit(p)}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                            >
                                <Pencil className="w-3.5 h-3.5" /> Editar
                            </button>
                            {deleteConfirm === p.id ? (
                                <button
                                    onClick={() => handleDelete(p.id)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    <Check className="w-3.5 h-3.5" /> Confirmar
                                </button>
                            ) : (
                                <button
                                    onClick={() => setDeleteConfirm(p.id)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-auto"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {palettes.length === 0 && (
                    <div className="col-span-full text-center py-12 text-slate-400">
                        <PaletteIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Nenhuma paleta cadastrada ainda.</p>
                    </div>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-800">{editing ? 'Editar Paleta' : 'Nova Paleta'}</h3>
                            <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Nome</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Ex: Azul Clássico"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {(['primary', 'secondary', 'accent'] as const).map(key => (
                                <div key={key}>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1 capitalize">
                                        {key === 'primary' ? 'Primária' : key === 'secondary' ? 'Secundária' : 'Destaque'}
                                    </label>
                                    <input
                                        type="color"
                                        value={colors[key] || '#ffffff'}
                                        onChange={e => setColors(prev => ({ ...prev, [key]: e.target.value }))}
                                        className="w-full h-10 rounded-lg border border-slate-200 cursor-pointer"
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !name.trim()}
                                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {editing ? 'Salvar' : 'Criar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPalettes;
