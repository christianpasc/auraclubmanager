import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Loader2, Pencil, Trash2, UserRound, Phone, Mail } from 'lucide-react';
import { guardianService, Guardian } from '../services/guardianService';
import { useLanguage } from '../contexts/LanguageContext';

const Guardians: React.FC = () => {
    const navigate = useNavigate();
    const { language } = useLanguage();
    const t = (pt: string, en: string) => language === 'en-US' ? en : pt;

    const [guardians, setGuardians] = useState<Guardian[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try { setGuardians(await guardianService.list()); }
        catch { setError(t('Erro ao carregar responsáveis', 'Error loading guardians')); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = guardians.filter(g =>
        !search ||
        g.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (g.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (g.phone ?? '').includes(search)
    );

    const handleDelete = async () => {
        if (!deleteId) return;
        setDeleting(true);
        try { await guardianService.delete(deleteId); setDeleteId(null); await load(); }
        catch { setError(t('Erro ao excluir responsável', 'Error deleting guardian')); }
        finally { setDeleting(false); }
    };

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{t('Responsáveis', 'Guardians')}</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{t('Pais, mães e responsáveis legais dos atletas', 'Parents and legal guardians of athletes')}</p>
                </div>
                <button onClick={() => navigate('/guardians/new')} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark transition-colors">
                    <Plus className="w-4 h-4" />
                    {t('Novo Responsável', 'New Guardian')}
                </button>
            </div>

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder={t('Buscar por nome, email ou telefone...', 'Search by name, email or phone...')}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <UserRound className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">{t('Nenhum responsável encontrado', 'No guardians found')}</p>
                    <button onClick={() => navigate('/guardians/new')} className="mt-4 text-primary text-sm font-semibold hover:underline">
                        {t('Cadastrar primeiro responsável', 'Register first guardian')}
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">{t('Nome', 'Name')}</th>
                                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase hidden sm:table-cell">{t('Contato', 'Contact')}</th>
                                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase">{t('Atletas', 'Athletes')}</th>
                                <th className="px-4 py-3 w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.map(g => (
                                <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                <span className="text-sm font-bold text-primary">{g.full_name.charAt(0)}</span>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-800 text-sm">{g.full_name}</p>
                                                {g.city && <p className="text-xs text-slate-400">{g.city}{g.state ? ` – ${g.state}` : ''}</p>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 hidden sm:table-cell">
                                        <div className="space-y-0.5">
                                            {g.phone && (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                    <Phone className="w-3 h-3" />
                                                    {g.phone}
                                                </div>
                                            )}
                                            {g.email && (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                    <Mail className="w-3 h-3" />
                                                    {g.email}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${(g.athlete_count ?? 0) > 0 ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>
                                            {g.athlete_count ?? 0}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1 justify-end">
                                            <button onClick={() => navigate(`/guardians/${g.id}`)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setDeleteId(g.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Delete confirm */}
            {deleteId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                        <h2 className="text-lg font-bold text-slate-800 mb-2">{t('Excluir responsável?', 'Delete guardian?')}</h2>
                        <p className="text-sm text-slate-500 mb-6">{t('Os atletas vinculados não serão excluídos.', 'Linked athletes will not be deleted.')}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-lg">{t('Cancelar', 'Cancel')}</button>
                            <button onClick={handleDelete} disabled={deleting} className="flex-1 px-4 py-2.5 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2">
                                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                                {t('Excluir', 'Delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Guardians;
