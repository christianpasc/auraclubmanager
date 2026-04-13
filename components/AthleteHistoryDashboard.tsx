
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Dumbbell, Trophy, Clock, Target, Filter, X } from 'lucide-react';
import { athleteTrainingStatsService } from '../services/athleteService';

type TrainingRow = Awaited<ReturnType<typeof athleteTrainingStatsService.getTrainings>>[number];
type GameRow    = Awaited<ReturnType<typeof athleteTrainingStatsService.getGames>>[number];

interface Props {
    athleteId: string;
    t: (key: string) => string;
    language: string;
}

const AthleteHistoryDashboard: React.FC<Props> = ({ athleteId, t, language }) => {
    const [trainings, setTrainings] = useState<TrainingRow[]>([]);
    const [games, setGames]         = useState<GameRow[]>([]);
    const [loading, setLoading]     = useState(true);

    // Filters
    const [dateFrom, setDateFrom]   = useState('');
    const [dateTo, setDateTo]       = useState('');
    const [year, setYear]           = useState('');
    const [competitionId, setCompetitionId] = useState('');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [tr, gm] = await Promise.all([
                    athleteTrainingStatsService.getTrainings(athleteId),
                    athleteTrainingStatsService.getGames(athleteId),
                ]);
                setTrainings(tr);
                setGames(gm);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [athleteId]);

    // ── helpers ───────────────────────────────────────────────────────────────

    const calcTrainingMinutes = (row: TrainingRow): number => {
        const t = row.training;
        if (!t.training_time || !t.end_time) return 0;
        const [sh, sm] = t.training_time.split(':').map(Number);
        const [eh, em] = t.end_time.split(':').map(Number);
        return (eh * 60 + em) - (sh * 60 + sm);
    };

    const matchDate = (dateStr: string | undefined) => {
        if (!dateStr) return false;
        const d = dateStr.substring(0, 10);
        if (year && !d.startsWith(year)) return false;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo   && d > dateTo)   return false;
        return true;
    };

    // ── competitions list for filter dropdown ─────────────────────────────────
    const competitions = useMemo(() => {
        const map = new Map<string, string>();
        games.forEach(g => {
            if (g.game.competition) {
                map.set(g.game.competition.id, `${g.game.competition.name}${g.game.competition.season ? ` (${g.game.competition.season})` : ''}`);
            }
        });
        return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
    }, [games]);

    // ── available years ───────────────────────────────────────────────────────
    const years = useMemo(() => {
        const ys = new Set<string>();
        trainings.forEach(r => ys.add(r.training.training_date.substring(0, 4)));
        games.forEach(r => { if (r.game.game_date) ys.add(r.game.game_date.substring(0, 4)); });
        return Array.from(ys).sort((a, b) => b.localeCompare(a));
    }, [trainings, games]);

    // ── filtered data ─────────────────────────────────────────────────────────
    const filteredTrainings = useMemo(() =>
        trainings.filter(r => r.attended && matchDate(r.training.training_date)),
    [trainings, year, dateFrom, dateTo]);

    const filteredGames = useMemo(() =>
        games.filter(r => {
            if (!matchDate(r.game.game_date)) return false;
            if (competitionId && r.game.competition?.id !== competitionId) return false;
            return true;
        }),
    [games, year, dateFrom, dateTo, competitionId]);

    // ── aggregated stats ──────────────────────────────────────────────────────
    const trainingMins  = filteredTrainings.reduce((s, r) => s + calcTrainingMinutes(r), 0);
    const gameMins      = filteredGames.reduce((s, r) => s + (r.minutes_played ?? 0), 0);
    const goals         = filteredGames.reduce((s, r) => s + (r.goals ?? 0), 0);
    const yellowCards   = filteredGames.reduce((s, r) => s + (r.yellow_cards ?? 0), 0);
    const redCards      = filteredGames.reduce((s, r) => s + (r.red_cards ?? 0), 0);

    const formatDate = (d?: string) => {
        if (!d) return '-';
        const locale = language === 'en-US' ? 'en-US' : language === 'es-ES' ? 'es-ES' : language === 'fr-FR' ? 'fr-FR' : 'pt-BR';
        return new Date(d + 'T00:00:00').toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const clearFilters = () => { setDateFrom(''); setDateTo(''); setYear(''); setCompetitionId(''); };
    const activeFilters = [dateFrom, dateTo, year, competitionId].filter(Boolean).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ── Filters ─────────────────────────────────────────────────── */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Filter className="w-4 h-4 text-primary" />
                        {t('athleteHistory.filters')}
                        {activeFilters > 0 && (
                            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">{activeFilters}</span>
                        )}
                    </div>
                    {activeFilters > 0 && (
                        <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-slate-500 hover:text-primary">
                            <X className="w-3 h-3" /> {t('common.clearFilters')}
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">{t('athleteHistory.dateFrom')}</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">{t('athleteHistory.dateTo')}</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">{t('athleteHistory.year')}</label>
                        <select value={year} onChange={e => setYear(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                            <option value="">{t('athleteHistory.allYears')}</option>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">{t('athleteHistory.competition')}</label>
                        <select value={competitionId} onChange={e => setCompetitionId(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                            <option value="">{t('athleteHistory.allCompetitions')}</option>
                            {competitions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* ── Stats Cards ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Trainings card */}
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-5 text-white shadow-lg">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                            <Dumbbell className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-lg">{t('athleteHistory.trainings')}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/15 rounded-lg p-3 text-center">
                            <p className="text-3xl font-extrabold">{filteredTrainings.length}</p>
                            <p className="text-xs text-emerald-100 mt-0.5">{t('athleteHistory.sessions')}</p>
                        </div>
                        <div className="bg-white/15 rounded-lg p-3 text-center">
                            <p className="text-3xl font-extrabold">{trainingMins}</p>
                            <p className="text-xs text-emerald-100 mt-0.5">{t('athleteHistory.minutes')}</p>
                        </div>
                    </div>
                </div>

                {/* Games card */}
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                            <Trophy className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-lg">{t('athleteHistory.games')}</h3>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                        <div className="bg-white/15 rounded-lg p-2 text-center">
                            <p className="text-2xl font-extrabold">{filteredGames.length}</p>
                            <p className="text-xs text-blue-100 mt-0.5">{t('athleteHistory.played')}</p>
                        </div>
                        <div className="bg-white/15 rounded-lg p-2 text-center">
                            <div className="flex items-center justify-center gap-0.5">
                                <Clock className="w-3 h-3 text-blue-200" />
                                <p className="text-2xl font-extrabold">{gameMins}</p>
                            </div>
                            <p className="text-xs text-blue-100 mt-0.5">{t('athleteHistory.minutes')}</p>
                        </div>
                        <div className="bg-white/15 rounded-lg p-2 text-center">
                            <p className="text-2xl font-extrabold">⚽ {goals}</p>
                            <p className="text-xs text-blue-100 mt-0.5">{t('athleteHistory.goals')}</p>
                        </div>
                        <div className="bg-yellow-400/30 rounded-lg p-2 text-center border border-yellow-300/30">
                            <p className="text-2xl font-extrabold">🟨 {yellowCards}</p>
                            <p className="text-xs text-blue-100 mt-0.5">{t('athleteHistory.yellow')}</p>
                        </div>
                        <div className="bg-red-400/30 rounded-lg p-2 text-center border border-red-300/30">
                            <p className="text-2xl font-extrabold">🟥 {redCards}</p>
                            <p className="text-xs text-blue-100 mt-0.5">{t('athleteHistory.red')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Games Table ──────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-primary" />
                    <h3 className="font-bold text-slate-800">{t('athleteHistory.gamesTable')} ({filteredGames.length})</h3>
                </div>
                {filteredGames.length === 0 ? (
                    <div className="py-10 text-center text-slate-400">
                        <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">{t('athleteHistory.noGames')}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                                <tr>
                                    <th className="px-4 py-3 text-left font-bold">{t('athleteHistory.col.date')}</th>
                                    <th className="px-4 py-3 text-left font-bold">{t('athleteHistory.col.match')}</th>
                                    <th className="px-4 py-3 text-left font-bold hidden sm:table-cell">{t('athleteHistory.col.competition')}</th>
                                    <th className="px-4 py-3 text-center font-bold w-16">{t('athleteHistory.col.min')}</th>
                                    <th className="px-4 py-3 text-center font-bold w-12">⚽</th>
                                    <th className="px-4 py-3 text-center font-bold w-12">🟨</th>
                                    <th className="px-4 py-3 text-center font-bold w-12">🟥</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredGames.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(r.game.game_date)}</td>
                                        <td className="px-4 py-3 font-semibold text-slate-800">
                                            {r.game.home_team} <span className="text-slate-400 font-normal text-xs mx-1">vs</span> {r.game.away_team}
                                            {r.game.home_score !== undefined && r.game.away_score !== undefined && (
                                                <span className="ml-2 text-xs text-slate-500">({r.game.home_score}–{r.game.away_score})</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                                            {r.game.competition?.name ?? '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center font-semibold text-slate-700">{r.minutes_played ?? '-'}</td>
                                        <td className="px-4 py-3 text-center font-semibold text-green-700">{r.goals ?? 0}</td>
                                        <td className="px-4 py-3 text-center font-semibold text-yellow-600">{r.yellow_cards ?? 0}</td>
                                        <td className="px-4 py-3 text-center font-semibold text-red-600">{r.red_cards ?? 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Trainings Table ──────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                    <Dumbbell className="w-4 h-4 text-primary" />
                    <h3 className="font-bold text-slate-800">{t('athleteHistory.trainingsTable')} ({filteredTrainings.length})</h3>
                </div>
                {filteredTrainings.length === 0 ? (
                    <div className="py-10 text-center text-slate-400">
                        <Dumbbell className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">{t('athleteHistory.noTrainings')}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                                <tr>
                                    <th className="px-4 py-3 text-left font-bold">{t('athleteHistory.col.date')}</th>
                                    <th className="px-4 py-3 text-left font-bold hidden sm:table-cell">{t('athleteHistory.col.category')}</th>
                                    <th className="px-4 py-3 text-left font-bold hidden md:table-cell">{t('athleteHistory.col.focus')}</th>
                                    <th className="px-4 py-3 text-left font-bold hidden md:table-cell">{t('athleteHistory.col.location')}</th>
                                    <th className="px-4 py-3 text-center font-bold w-16">
                                        <span className="flex items-center justify-center gap-1"><Clock className="w-3 h-3" />{t('athleteHistory.col.min')}</span>
                                    </th>
                                    <th className="px-4 py-3 text-center font-bold w-16 hidden sm:table-cell">{t('athleteHistory.col.perf')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredTrainings.map(r => {
                                    const mins = calcTrainingMinutes(r);
                                    return (
                                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(r.training.training_date)}</td>
                                            <td className="px-4 py-3 text-slate-700 hidden sm:table-cell">{r.training.category ?? '-'}</td>
                                            <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{r.training.focus ?? '-'}</td>
                                            <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{r.training.location ?? '-'}</td>
                                            <td className="px-4 py-3 text-center font-semibold text-slate-700">{mins > 0 ? mins : '-'}</td>
                                            <td className="px-4 py-3 text-center hidden sm:table-cell">
                                                {r.performance_rating
                                                    ? <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full">{r.performance_rating}/10</span>
                                                    : <span className="text-slate-300">-</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AthleteHistoryDashboard;
