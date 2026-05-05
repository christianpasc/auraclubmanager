
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Search, Filter, ChevronRight, Trash2,
    MapPin, User, Loader2, AlertCircle, Radar, Star,
    BarChart2, Kanban,
} from 'lucide-react';
import {
    prospectService,
    Prospect, ProspectStatus, ProspectPriority, ProspectSource,
    FUNNEL_STATUSES, PRIORITY_META, SOURCE_META, FOOTBALL_POSITIONS,
    calcAge, calcOverallScore,
} from '../services/prospectService';
import { useLanguage } from '../contexts/LanguageContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PriorityBadge: React.FC<{ priority?: ProspectPriority; t: (k: string) => string }> = ({ priority = 'normal', t }) => {
    const m = PRIORITY_META[priority];
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${m.bg} ${m.text} ${m.border}`}>
            {t(m.labelKey)}
        </span>
    );
};

const SourceBadge: React.FC<{ source?: ProspectSource; t: (k: string) => string }> = ({ source, t }) => {
    if (!source) return null;
    const m = SOURCE_META[source];
    return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
            {t(m.labelKey)}
        </span>
    );
};

const ScorePill: React.FC<{ score?: number | null }> = ({ score }) => {
    if (score === null || score === undefined) return null;
    const color = score >= 4.2 ? 'text-green-700 bg-green-50 border-green-200'
        : score >= 3.0 ? 'text-amber-700 bg-amber-50 border-amber-200'
        : 'text-red-700 bg-red-50 border-red-200';
    return (
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-black border ${color}`}>
            <Star className="w-2.5 h-2.5 fill-current" />
            {score.toFixed(1)}
        </span>
    );
};

// ── Prospect card ─────────────────────────────────────────────────────────────

interface ProspectCardProps {
    prospect: Prospect;
    onEdit: () => void;
    onAdvance: () => void;
    onDelete: () => void;
    t: (k: string) => string;
    advanceLabel?: string;
}

const ProspectCard: React.FC<ProspectCardProps> = ({ prospect, onEdit, onAdvance, onDelete, t, advanceLabel }) => {
    const age = calcAge(prospect.birth_date);
    const score = prospect.overall_score ?? calcOverallScore(prospect.scores);
    const [confirmDelete, setConfirmDelete] = useState(false);

    return (
        <div
            className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all p-4 cursor-pointer group"
            onClick={onEdit}
        >
            {/* Top row: priority + score + delete */}
            <div className="flex items-start justify-between mb-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <PriorityBadge priority={prospect.priority as ProspectPriority} t={t} />
                    <ScorePill score={score} />
                </div>
                <button
                    onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all rounded"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Delete confirm */}
            {confirmDelete && (
                <div
                    className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-2"
                    onClick={e => e.stopPropagation()}
                >
                    <p className="text-xs text-red-700 font-medium">Remover?</p>
                    <div className="flex gap-1">
                        <button
                            onClick={e => { e.stopPropagation(); setConfirmDelete(false); }}
                            className="px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                        >
                            Não
                        </button>
                        <button
                            onClick={e => { e.stopPropagation(); onDelete(); }}
                            className="px-2 py-0.5 text-xs text-white bg-red-500 hover:bg-red-600 rounded"
                        >
                            Sim
                        </button>
                    </div>
                </div>
            )}

            <p className="font-bold text-slate-800 text-sm leading-tight mb-1 truncate">{prospect.full_name}</p>

            <p className="text-xs text-slate-500 mb-2">
                {[prospect.position, age ? `${age} anos` : null].filter(Boolean).join(' · ')}
            </p>

            {(prospect.city || prospect.current_club) && (
                <div className="flex items-center gap-1 text-xs text-slate-400 mb-2">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">
                        {[prospect.city, prospect.current_club].filter(Boolean).join(' · ')}
                    </span>
                </div>
            )}

            <div className="mb-3">
                <SourceBadge source={prospect.source as ProspectSource} t={t} />
            </div>

            {advanceLabel && (
                <button
                    onClick={e => { e.stopPropagation(); onAdvance(); }}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-primary hover:text-primary-dark hover:bg-primary/5 rounded-lg border border-primary/20 hover:border-primary/40 transition-colors"
                >
                    {advanceLabel}
                    <ChevronRight className="w-3 h-3" />
                </button>
            )}
        </div>
    );
};

// ── Kanban Column ─────────────────────────────────────────────────────────────

interface KanbanColumnProps {
    status: typeof FUNNEL_STATUSES[number];
    prospects: Prospect[];
    onEdit: (p: Prospect) => void;
    onAdvance: (id: string, next: ProspectStatus) => void;
    onDelete: (id: string) => void;
    t: (k: string) => string;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ status, prospects, onEdit, onAdvance, onDelete, t }) => {
    const advanceLabel = status.next ? t('prospects.advance') : undefined;

    return (
        <div className="flex flex-col flex-shrink-0 w-44">
            <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl mb-3 border ${status.bg} ${status.border}`}>
                <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${status.dot}`} />
                    <span className={`text-xs font-bold uppercase tracking-wider ${status.text}`}>
                        {t(status.labelKey)}
                    </span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                    {prospects.length}
                </span>
            </div>

            <div className="flex flex-col gap-3 flex-1">
                {prospects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                        <User className="w-8 h-8 mb-2" />
                        <p className="text-xs text-center">{t('prospects.noProspects')}</p>
                    </div>
                ) : (
                    prospects.map(p => (
                        <ProspectCard
                            key={p.id}
                            prospect={p}
                            onEdit={() => onEdit(p)}
                            onAdvance={() => status.next && onAdvance(p.id!, status.next)}
                            onDelete={() => onDelete(p.id!)}
                            t={t}
                            advanceLabel={advanceLabel}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

// ── Reports View ──────────────────────────────────────────────────────────────

const ReportsView: React.FC<{ prospects: Prospect[]; t: (k: string) => string }> = ({ prospects, t }) => {
    const total = prospects.length || 1;

    // Top prospects by score
    const scored = prospects
        .map(p => ({ ...p, _score: p.overall_score ?? calcOverallScore(p.scores) }))
        .filter(p => p._score !== null)
        .sort((a, b) => (b._score! - a._score!))
        .slice(0, 8);

    // Source distribution
    const sourceCounts = (Object.keys(SOURCE_META) as ProspectSource[]).map(s => ({
        key: s,
        label: t(SOURCE_META[s].labelKey),
        count: prospects.filter(p => p.source === s).length,
    })).filter(s => s.count > 0).sort((a, b) => b.count - a.count);

    // Priority distribution
    const priorityCounts = (['urgent', 'high', 'normal', 'low'] as ProspectPriority[]).map(p => ({
        key: p,
        label: t(PRIORITY_META[p].labelKey),
        count: prospects.filter(x => x.priority === p).length,
        meta: PRIORITY_META[p],
    })).filter(p => p.count > 0);

    const maxSource   = Math.max(...sourceCounts.map(s => s.count), 1);
    const maxPriority = Math.max(...priorityCounts.map(p => p.count), 1);

    return (
        <div className="space-y-5">
            {/* Funnel */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                    {t('prospects.report.funnel')}
                </p>
                <div className="space-y-2.5">
                    {FUNNEL_STATUSES.map(s => {
                        const count = prospects.filter(p => p.status === s.value).length;
                        const pct   = Math.round((count / total) * 100);
                        return (
                            <div key={s.value} className="flex items-center gap-3">
                                <span className={`text-xs font-semibold w-28 shrink-0 ${s.text}`}>
                                    {t(s.labelKey)}
                                </span>
                                <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${s.dot.replace('bg-', 'bg-')}`}
                                        style={{ width: `${pct}%`, minWidth: count > 0 ? '1.5rem' : 0 }}
                                    />
                                </div>
                                <span className="text-xs font-black text-slate-600 w-8 text-right">{count}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Top prospects */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {t('prospects.report.topProspects')}
                        </p>
                        <p className="text-[10px] text-slate-400">{t('prospects.report.topDesc')}</p>
                    </div>
                    {scored.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-6">{t('prospects.report.noScore')}</p>
                    ) : (
                        <ol className="space-y-2">
                            {scored.map((p, i) => {
                                const color = p._score! >= 4.2 ? 'text-green-600 bg-green-50'
                                    : p._score! >= 3.0 ? 'text-amber-600 bg-amber-50'
                                    : 'text-red-600 bg-red-50';
                                return (
                                    <li key={p.id} className="flex items-center gap-3">
                                        <span className="text-xs font-black text-slate-300 w-4">{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-slate-700 truncate">{p.full_name}</p>
                                            <p className="text-[10px] text-slate-400">{p.position}</p>
                                        </div>
                                        <span className={`flex items-center gap-0.5 text-xs font-black px-2 py-0.5 rounded-lg ${color}`}>
                                            <Star className="w-2.5 h-2.5 fill-current" />
                                            {p._score!.toFixed(1)}
                                        </span>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </div>

                {/* Distributions */}
                <div className="space-y-5">
                    {/* By source */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                            {t('prospects.report.sources')}
                        </p>
                        {sourceCounts.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-3">{t('prospects.report.noData')}</p>
                        ) : (
                            <div className="space-y-2">
                                {sourceCounts.map(s => (
                                    <div key={s.key} className="flex items-center gap-3">
                                        <span className="text-xs text-slate-600 w-24 shrink-0 truncate">{s.label}</span>
                                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary/60 rounded-full transition-all duration-500"
                                                style={{ width: `${(s.count / maxSource) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-bold text-slate-600 w-5 text-right">{s.count}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* By priority */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                            {t('prospects.report.priorities')}
                        </p>
                        {priorityCounts.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-3">{t('prospects.report.noData')}</p>
                        ) : (
                            <div className="space-y-2">
                                {priorityCounts.map(p => (
                                    <div key={p.key} className="flex items-center gap-3">
                                        <span className={`text-xs font-semibold w-16 shrink-0 ${p.meta.text}`}>
                                            {p.label}
                                        </span>
                                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${p.meta.bg.replace('bg-', 'bg-').replace('-100', '-400')}`}
                                                style={{ width: `${(p.count / maxPriority) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-bold text-slate-600 w-5 text-right">{p.count}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

type View = 'board' | 'reports';

const Prospects: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();

    const [prospects, setProspects] = useState<Prospect[]>([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState<string | null>(null);
    const [search, setSearch]       = useState('');
    const [posFilter, setPosFilter] = useState('');
    const [priFilter, setPriFilter] = useState('');
    const [view, setView]           = useState<View>('board');

    const load = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await prospectService.getAll();
            setProspects(data);
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar prospectos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleAdvance = async (id: string, next: ProspectStatus) => {
        try {
            await prospectService.updateStatus(id, next);
            setProspects(prev => prev.map(p => p.id === id ? { ...p, status: next } : p));
        } catch {}
    };

    const handleDelete = async (id: string) => {
        try {
            await prospectService.delete(id);
            setProspects(prev => prev.filter(p => p.id !== id));
        } catch {}
    };

    const filtered = prospects.filter(p => {
        const q = search.toLowerCase();
        const matchSearch = !q || p.full_name.toLowerCase().includes(q)
            || (p.city || '').toLowerCase().includes(q)
            || (p.current_club || '').toLowerCase().includes(q);
        const matchPos = !posFilter || p.position === posFilter;
        const matchPri = !priFilter || p.priority === priFilter;
        return matchSearch && matchPos && matchPri;
    });

    const byStatus = (status: ProspectStatus) =>
        filtered.filter(p => p.status === status);

    const total    = prospects.length;
    const approved = prospects.filter(p => p.status === 'approved').length;
    const convRate = total ? Math.round((approved / total) * 100) : 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Radar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{t('pages.prospects')}</h1>
                        <p className="text-sm text-slate-500">
                            {total} prospectos · {convRate}% aprovação
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* View switcher */}
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setView('board')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${view === 'board' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Kanban className="w-3.5 h-3.5" />
                            {t('prospects.tab.kanban')}
                        </button>
                        <button
                            onClick={() => setView('reports')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${view === 'reports' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <BarChart2 className="w-3.5 h-3.5" />
                            {t('prospects.tab.reports')}
                        </button>
                    </div>
                    <button
                        onClick={() => navigate('/prospects/new')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        {t('prospects.newProspect')}
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* Summary mini-stats */}
            <div
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
                style={{ gridAutoRows: '80px' }}
            >
                {FUNNEL_STATUSES.map(s => {
                    const count = prospects.filter(p => p.status === s.value).length;
                    return (
                        <div key={s.value} className={`rounded-xl border px-3 py-2.5 flex flex-col ${s.bg} ${s.border}`}>
                            <p className={`text-[10px] font-bold uppercase tracking-wider leading-tight ${s.text}`}>
                                {t(s.labelKey)}
                            </p>
                            <p className={`text-2xl font-black mt-auto ${s.text}`}>{count}</p>
                        </div>
                    );
                })}
            </div>

            {/* ── Reports view ── */}
            {view === 'reports' && <ReportsView prospects={prospects} t={t} />}

            {/* ── Board view ── */}
            {view === 'board' && (
                <>
                    {/* Filters */}
                    <div className="flex flex-wrap gap-3">
                        <div className="relative flex-1 min-w-48">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder={t('prospects.search')}
                                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-slate-400" />
                            <select
                                value={posFilter}
                                onChange={e => setPosFilter(e.target.value)}
                                className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                            >
                                <option value="">{t('prospects.filterPosition')}</option>
                                {FOOTBALL_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <select
                                value={priFilter}
                                onChange={e => setPriFilter(e.target.value)}
                                className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                            >
                                <option value="">Prioridade</option>
                                {(['urgent', 'high', 'normal', 'low'] as ProspectPriority[]).map(p => (
                                    <option key={p} value={p}>{t(PRIORITY_META[p].labelKey)}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Kanban board */}
                    <div className="overflow-x-auto pb-4">
                        <div className="flex gap-2 min-w-max">
                            {FUNNEL_STATUSES.map(status => (
                                <KanbanColumn
                                    key={status.value}
                                    status={status}
                                    prospects={byStatus(status.value as ProspectStatus)}
                                    onEdit={p => navigate(`/prospects/${p.id}`)}
                                    onAdvance={handleAdvance}
                                    onDelete={handleDelete}
                                    t={t}
                                />
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Prospects;
