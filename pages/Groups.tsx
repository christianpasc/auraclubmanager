import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users, Pencil, Trash2, Loader2, UsersRound } from 'lucide-react';
import { groupService, Group } from '../services/groupService';
import { seasonService, Season } from '../services/seasonService';
import { useLanguage } from '../contexts/LanguageContext';

const Groups: React.FC = () => {
    const navigate = useNavigate();
    const { language } = useLanguage();
    const t = (pt: string, en: string) => language === 'en-US' ? en : pt;

    const [groups, setGroups] = useState<Group[]>([]);
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [seasonFilter, setSeasonFilter] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [g, s] = await Promise.all([groupService.list(), seasonService.list()]);
            setGroups(g);
            setSeasons(s);
        } catch { setError(t('Erro ao carregar turmas', 'Error loading groups')); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = groups.filter(g => {
        const matchSearch = !search || g.name.toLowerCase().includes(search.toLowerCase()) ||
            (g.age_category_name ?? '').toLowerCase().includes(search.toLowerCase());
        const matchSeason = !seasonFilter || g.season_id === seasonFilter;
        return matchSearch && matchSeason;
    });

    const handleDelete = async () => {
        if (!deleteId) return;
        setDeleting(true);
        try { await groupService.delete(deleteId); setDeleteId(null); await load(); }
        catch { setError(t('Erro ao excluir turma', 'Error deleting group')); }
        finally { setDeleting(false); }
    };

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{t('Turmas', 'Groups')}</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{t('Organize atletas em turmas por temporada e categoria', 'Organize athletes into groups by season and category')}</p>
                </div>
                <button onClick={() => navigate('/groups/new')} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark transition-colors">
                    <Plus className="w-4 h-4" />
                    {t('Nova Turma', 'New Group')}
                </button>
            </div>

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder={t('Buscar turma...', 'Search group...')}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
                <select value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none min-w-[160px]">
                    <option value="">{t('Todas as temporadas', 'All seasons')}</option>
                    {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <UsersRound className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">{t('Nenhuma turma encontrada', 'No groups found')}</p>
                    <button onClick={() => navigate('/groups/new')} className="mt-4 text-primary text-sm font-semibold hover:underline">
                        {t('Criar primeira turma', 'Create first group')}
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(g => (
                        <div key={g.id} className={`bg-white rounded-xl border-2 p-5 flex flex-col gap-3 ${g.is_active ? 'border-slate-100' : 'border-slate-100 opacity-60'}`}>
                            <div className="flex items-start justify-between">
                                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <UsersRound className="w-5 h-5 text-primary" />
                                </div>
                                {!g.is_active && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-500 rounded-full uppercase">
                                        {t('Inativa', 'Inactive')}
                                    </span>
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">{g.name}</h3>
                                {g.age_category_name && <p className="text-xs text-primary font-semibold mt-0.5">{g.age_category_name}</p>}
                                {g.season_name && <p className="text-xs text-slate-400">{g.season_name}</p>}
                                {g.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{g.description}</p>}
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <Users className="w-3.5 h-3.5" />
                                    <span>{g.athlete_count ?? 0} {t('atletas', 'athletes')}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => navigate(`/groups/${g.id}`)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setDeleteId(g.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete confirm */}
            {deleteId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                        <h2 className="text-lg font-bold text-slate-800 mb-2">{t('Excluir turma?', 'Delete group?')}</h2>
                        <p className="text-sm text-slate-500 mb-6">{t('Os atletas não serão excluídos, apenas desvinculados da turma.', 'Athletes will not be deleted, only unlinked from the group.')}</p>
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

export default Groups;
