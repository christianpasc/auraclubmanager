
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, Loader2, Trophy, ChevronDown, X, Plus, Edit2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { gameService, Game, gameStatuses, competitionService, Competition } from '../services/competitionService';
import { useLanguage } from '../contexts/LanguageContext';

interface Filters {
    status: string;
    competition_id: string;
}

const Games: React.FC = () => {
    const navigate = useNavigate();
    const { t, language } = useLanguage();
    const [games, setGames] = useState<Game[]>([]);
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<Filters>({ status: '', competition_id: '' });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [gamesData, compsData] = await Promise.all([
                gameService.getAll(),
                competitionService.getAll(),
            ]);
            setGames(gamesData);
            setCompetitions(compsData);
        } catch (err) {
            setError(language === 'en-US' ? 'Error loading games' : language === 'es-ES' ? 'Error al cargar partidos' : 'Erro ao carregar jogos');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const filteredGames = games.filter(g => {
        const matchesSearch = !searchTerm ||
            g.home_team?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            g.away_team?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            g.competition?.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = !filters.status || g.status === filters.status;
        const matchesCompetition = !filters.competition_id || g.competition_id === filters.competition_id;
        return matchesSearch && matchesStatus && matchesCompetition;
    });

    const activeFiltersCount = [filters.status, filters.competition_id].filter(Boolean).length;
    const clearFilters = () => setFilters({ status: '', competition_id: '' });

    const getStatusVariant = (status?: string) => {
        switch (status) {
            case 'finished': return 'success';
            case 'in_progress': return 'warning';
            case 'scheduled': return 'neutral';
            case 'postponed': return 'warning';
            case 'cancelled': return 'error';
            default: return 'neutral';
        }
    };

    const getStatusLabel = (status?: string) => {
        const found = gameStatuses.find(s => s.value === status);
        return found?.label || status || 'N/A';
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        const locale = language === 'en-US' ? 'en-US' : language === 'es-ES' ? 'es-ES' : 'pt-BR';
        return new Date(dateStr).toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short' });
    };

    const formatTime = (timeStr?: string) => {
        if (!timeStr) return '-';
        return timeStr.slice(0, 5);
    };

    const getResultBadge = (game: Game) => {
        if (game.status !== 'finished' || game.home_score === undefined || game.away_score === undefined) return null;

        const isHome = game.is_home_game !== false;
        const ourScore = isHome ? game.home_score : game.away_score;
        const theirScore = isHome ? game.away_score : game.home_score;

        if (ourScore > theirScore) return <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">V</span>;
        if (ourScore < theirScore) return <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded">D</span>;
        return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded">E</span>;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                searchPlaceholder={t('games.searchPlaceholder')}
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                showFilters={true}
                onFilterClick={() => setShowFilters(!showFilters)}
                actionLabel={t('games.newGame')}
                actionIcon={Plus}
                onActionClick={() => navigate('/games/new')}
            />

            {/* Filter Panel */}
            {showFilters && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-700">{t('common.filters')}</h3>
                        {activeFiltersCount > 0 && (
                            <button onClick={clearFilters} className="text-xs text-primary hover:text-primary-dark font-medium flex items-center gap-1">
                                <X className="w-3 h-3" /> {t('common.clearFilters')} ({activeFiltersCount})
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                                {language === 'en-US' ? 'Competition' : language === 'es-ES' ? 'Competición' : 'Competição'}
                            </label>
                            <div className="relative">
                                <select value={filters.competition_id} onChange={(e) => setFilters({ ...filters, competition_id: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none pr-8">
                                    <option value="">{language === 'en-US' ? 'All competitions' : language === 'es-ES' ? 'Todas las competiciones' : 'Todas as competições'}</option>
                                    {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('common.status')}</label>
                            <div className="relative">
                                <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none pr-8">
                                    <option value="">{t('athletes.allStatuses')}</option>
                                    {gameStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            {/* Results count */}
            <div className="text-sm text-slate-500">
                {filteredGames.length} {filteredGames.length !== 1
                    ? (language === 'en-US' ? 'games' : language === 'es-ES' ? 'partidos' : 'jogos')
                    : (language === 'en-US' ? 'game' : language === 'es-ES' ? 'partido' : 'jogo')}
            </div>

            {filteredGames.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500 font-medium">
                        {searchTerm || activeFiltersCount > 0
                            ? (language === 'en-US' ? 'No games found' : language === 'es-ES' ? 'No se encontraron partidos' : 'Nenhum jogo encontrado')
                            : t('games.noGames')}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                        {language === 'en-US' ? 'Games are registered within competitions' : language === 'es-ES' ? 'Los partidos se registran dentro de las competiciones' : 'Os jogos são cadastrados dentro das competições'}
                    </p>
                    <button onClick={() => navigate('/competitions')} className="mt-4 text-sm font-bold text-primary hover:text-primary-dark">
                        {language === 'en-US' ? 'View Competitions' : language === 'es-ES' ? 'Ver Competiciones' : 'Ver Competições'} →
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('games.date')}</th>
                                    <th className="hidden sm:table-cell px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        {language === 'en-US' ? 'Competition' : language === 'es-ES' ? 'Competición' : 'Competição'}
                                    </th>
                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                                        {language === 'en-US' ? 'Match' : language === 'es-ES' ? 'Encuentro' : 'Confronto'}
                                    </th>
                                    <th className="hidden md:table-cell px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                                        {language === 'en-US' ? 'Score' : language === 'es-ES' ? 'Marcador' : 'Placar'}
                                    </th>
                                    <th className="hidden lg:table-cell px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('games.venue')}</th>
                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">{t('common.status')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredGames.map((game) => (
                                    <tr key={game.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/games/${game.id}`)}>
                                        <td className="px-3 md:px-6 py-3 md:py-4">
                                            <div className="flex items-center gap-2 md:gap-3">
                                                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                    <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-800">{formatDate(game.game_date)}</p>
                                                    <p className="text-xs text-slate-500 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {formatTime(game.game_time)}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="hidden sm:table-cell px-3 md:px-6 py-3 md:py-4">
                                            <div className="flex items-center gap-2">
                                                <Trophy className="w-4 h-4 text-slate-400" />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-slate-700 truncate">{game.competition?.name || '-'}</p>
                                                    {game.round && <p className="text-xs text-slate-400 truncate">{game.round}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                                            <div className="flex items-center justify-center gap-1 md:gap-3">
                                                <span className={`text-xs md:text-sm font-semibold truncate max-w-[60px] md:max-w-none ${game.is_home_game !== false ? 'text-primary' : 'text-slate-600'}`}>
                                                    {game.home_team || '-'}
                                                </span>
                                                <span className="text-slate-300 font-bold text-xs">{t('games.vs')}</span>
                                                <span className={`text-xs md:text-sm font-semibold truncate max-w-[60px] md:max-w-none ${game.is_home_game === false ? 'text-primary' : 'text-slate-600'}`}>
                                                    {game.away_team || '-'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="hidden md:table-cell px-6 py-4 text-center">
                                            {game.status === 'finished' && game.home_score !== undefined && game.away_score !== undefined ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className="text-lg font-bold text-slate-800">
                                                        {game.home_score} - {game.away_score}
                                                    </span>
                                                    {getResultBadge(game)}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="hidden lg:table-cell px-6 py-4">
                                            {game.venue ? (
                                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                                    <MapPin className="w-4 h-4 text-slate-400" />
                                                    <span className="truncate max-w-[120px]">{game.venue}</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                                            <div className="flex items-center justify-center gap-1 md:gap-2">
                                                <StatusBadge status={getStatusLabel(game.status)} variant={getStatusVariant(game.status)} />
                                                <button onClick={(e) => { e.stopPropagation(); navigate(`/games/${game.id}`); }} className="p-1 md:p-1.5 text-slate-400 hover:text-primary transition-colors">
                                                    <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Games;
