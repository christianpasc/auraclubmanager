
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Calendar, Save, ArrowLeft, Loader2, Users, Trophy, MapPin, Clock, Plus, Trash2, UserPlus, LayoutDashboard,
    ArrowUpFromLine, ArrowDownToLine, RefreshCw, Share2
} from 'lucide-react';
import GameTacticalBoard from '../components/GameTacticalBoard';
import FeatureGate from '../components/FeatureGate';
import {
    gameService, gamePlayerService, competitionService, Game, GamePlayer, Competition,
    gameStatuses
} from '../services/competitionService';
import { athleteService, Athlete } from '../services/athleteService';
import { useLanguage } from '../contexts/LanguageContext';
import { useTenant } from '../contexts/TenantContext';

type TabType = 'general' | 'lineup' | 'tactical';

interface LocalSubstitution {
    localId: string;
    minute: number;
    outAthleteId: string;
    inAthleteId: string;
}

let subCounter = 0;
const newLocalId = () => `sub-${++subCounter}`;

const GameForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEditing = !!id;
    const { t } = useLanguage();
    const { currentTenant } = useTenant();

    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    const [game, setGame] = useState<Partial<Game>>({
        status: 'scheduled',
        is_home_game: true,
        home_team: currentTenant?.name || '',
    });

    useEffect(() => {
        if (!isEditing && currentTenant?.name) {
            setGame(prev => ({
                ...prev,
                home_team: prev.home_team || currentTenant.name,
            }));
        }
    }, [currentTenant?.name, isEditing]);

    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [players, setPlayers] = useState<Partial<GamePlayer>[]>([]);
    const [athletes, setAthletes] = useState<Athlete[]>([]);
    const [showAthleteSelector, setShowAthleteSelector] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('');

    // Substitutions
    const [substitutions, setSubstitutions] = useState<LocalSubstitution[]>([]);
    const [addingSubstitution, setAddingSubstitution] = useState(false);
    const [newSub, setNewSub] = useState<{ minute: number; outAthleteId: string; inAthleteId: string }>({
        minute: 0,
        outAthleteId: '',
        inAthleteId: '',
    });

    const categories = ['Sub-7', 'Sub-9', 'Sub-11', 'Sub-13', 'Sub-15', 'Sub-17', 'Sub-20', 'Profissional'];
    const positions = ['Goleiro', 'Zagueiro', 'Lateral Direito', 'Lateral Esquerdo', 'Volante', 'Meia', 'Meia Atacante', 'Ponta Direita', 'Ponta Esquerda', 'Centroavante', 'Atacante'];

    useEffect(() => {
        loadInitialData();
    }, [id]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [compsData, athletesData] = await Promise.all([
                competitionService.getAll(),
                athleteService.getAll(),
            ]);
            setCompetitions(compsData);
            setAthletes(athletesData.filter(a => a.status === 'active'));

            if (id) {
                const [gameData, playersData] = await Promise.all([
                    gameService.getById(id),
                    gamePlayerService.getByGame(id),
                ]);
                setGame(gameData);
                setPlayers(playersData);

                // Reconstruct substitutions from player data
                const subs: LocalSubstitution[] = [];
                for (const p of playersData) {
                    if (p.replaced_player_id && p.sub_in_minute != null && p.athlete_id) {
                        subs.push({
                            localId: newLocalId(),
                            minute: p.sub_in_minute,
                            outAthleteId: p.replaced_player_id,
                            inAthleteId: p.athlete_id,
                        });
                    }
                }
                // Sort by minute
                subs.sort((a, b) => a.minute - b.minute);
                setSubstitutions(subs);
            }
        } catch (err) {
            setError(t('gameForm.error.loading'));
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const updateGame = (field: keyof Game, value: any) => {
        setGame(prev => ({ ...prev, [field]: value }));
    };

    const addPlayer = (athlete: Athlete) => {
        if (players.some(p => p.athlete_id === athlete.id)) return;
        setPlayers(prev => [...prev, {
            athlete_id: athlete.id,
            athlete: {
                id: athlete.id!,
                full_name: athlete.full_name,
                photo_url: athlete.photo_url,
                category: athlete.category,
                position: athlete.position,
            },
            is_starter: false,
            position: athlete.position || '',
            minutes_played: 0,
            goals: 0,
            assists: 0,
            yellow_cards: 0,
            red_cards: 0,
        }]);
    };

    const addPlayersByCategory = (category: string) => {
        const categoryAthletes = athletes.filter(a => a.category === category && !players.some(p => p.athlete_id === a.id));
        categoryAthletes.forEach(athlete => addPlayer(athlete));
        setShowAthleteSelector(false);
    };

    const updatePlayer = (index: number, field: keyof GamePlayer, value: any) => {
        setPlayers(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
    };

    const removePlayer = (index: number) => {
        const athleteId = players[index]?.athlete_id;
        setPlayers(prev => prev.filter((_, i) => i !== index));
        if (athleteId) {
            setSubstitutions(prev => prev.filter(s => s.outAthleteId !== athleteId && s.inAthleteId !== athleteId));
        }
    };

    // Substitution helpers
    const startersAvailableToGoOff = players.filter(p =>
        p.is_starter && !substitutions.some(s => s.outAthleteId === p.athlete_id)
    );

    const benchAvailableToComeon = players.filter(p =>
        !p.is_starter && !substitutions.some(s => s.inAthleteId === p.athlete_id)
    );

    const confirmAddSubstitution = () => {
        if (!newSub.outAthleteId || !newSub.inAthleteId || newSub.minute < 0) return;
        setSubstitutions(prev => [
            ...prev,
            { ...newSub, localId: newLocalId() },
        ].sort((a, b) => a.minute - b.minute));
        setNewSub({ minute: 0, outAthleteId: '', inAthleteId: '' });
        setAddingSubstitution(false);
    };

    const removeSubstitution = (localId: string) => {
        setSubstitutions(prev => prev.filter(s => s.localId !== localId));
    };

    const getPlayerName = (athleteId: string) =>
        players.find(p => p.athlete_id === athleteId)?.athlete?.full_name || athleteId;

    const handleSave = async () => {
        if (!game.competition_id) {
            setError(t('gameForm.error.selectCompetition'));
            return;
        }

        setSaving(true);
        setError(null);

        try {
            let gameId = id;

            if (isEditing && id) {
                await gameService.update(id, game);
            } else {
                const created = await gameService.create(game as Game);
                gameId = created.id;
            }

            if (gameId) {
                const playersToSave = players.map(p => {
                    const inSub = substitutions.find(s => s.inAthleteId === p.athlete_id);
                    const outSub = substitutions.find(s => s.outAthleteId === p.athlete_id);
                    return {
                        game_id: gameId,
                        athlete_id: p.athlete_id,
                        position: p.position || p.athlete?.position,
                        is_starter: p.is_starter,
                        minutes_played: p.minutes_played,
                        goals: p.goals,
                        assists: p.assists,
                        yellow_cards: p.yellow_cards,
                        red_cards: p.red_cards,
                        sub_in_minute: inSub?.minute ?? null,
                        replaced_player_id: inSub?.outAthleteId ?? null,
                        sub_out_minute: outSub?.minute ?? null,
                    };
                });
                await gamePlayerService.upsertMany(gameId, playersToSave);
            }

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            setError(t('gameForm.error.saving'));
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const availableAthletes = athletes.filter(a => !players.some(p => p.athlete_id === a.id));

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    const tabs = [
        { id: 'general'  as TabType, label: t('gameForm.tab.general'), icon: Calendar },
        { id: 'lineup'   as TabType, label: t('gameForm.tab.lineup'), icon: Users },
        { id: 'tactical' as TabType, label: t('gameForm.tab.tactical'), icon: LayoutDashboard },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/games')} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{isEditing ? t('gameForm.editTitle') : t('gameForm.newTitle')}</h1>
                        <p className="text-sm text-slate-500">{isEditing ? t('gameForm.editSubtitle') : t('gameForm.newSubtitle')}</p>
                    </div>
                </div>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg shadow-lg shadow-primary/20 transition-all disabled:opacity-50">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {t('common.save')}
                </button>
            </div>

            {saved && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <p className="text-sm text-green-700 font-medium">Jogo salvo com sucesso!</p>
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === tab.id
                            ? 'bg-white text-primary shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                        {tab.id === 'lineup' && players.length > 0 && (
                            <span className="ml-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">{players.length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* General Tab */}
            {activeTab === 'general' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-primary" />
                            {t('gameForm.section.competition')}
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('gameForm.field.competition')} *</label>
                                <select value={game.competition_id || ''} onChange={(e) => updateGame('competition_id', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                                    <option value="">{t('gameForm.field.select')}</option>
                                    {competitions.map(c => <option key={c.id} value={c.id}>{c.name} {c.season ? `(${c.season})` : ''}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('gameForm.field.round')}</label>
                                <input type="text" value={game.round || ''} onChange={(e) => updateGame('round', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder={t('gameForm.field.round')} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('gameForm.field.status')}</label>
                                <select value={game.status || 'scheduled'} onChange={(e) => updateGame('status', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                                    {gameStatuses.map(s => { const statusKey: Record<string,string> = { scheduled: 'game.status.scheduled', in_progress: 'game.status.inProgress', finished: 'game.status.finished', postponed: 'game.status.postponed', cancelled: 'game.status.cancelled' }; return <option key={s.value} value={s.value}>{t(statusKey[s.value]) || s.label}</option>; })}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-primary" />
                            {t('trainingForm.section.dateTime')}
                        </h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('gameForm.field.date')}</label>
                                    <input type="date" value={game.game_date || ''} onChange={(e) => updateGame('game_date', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('gameForm.field.time')}</label>
                                    <input type="time" value={game.game_time || ''} onChange={(e) => updateGame('game_time', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('gameForm.field.venue')}</label>
                                <input type="text" value={game.venue || ''} onChange={(e) => updateGame('venue', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder={t('gameForm.field.venue')} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('gameForm.field.address')}</label>
                                <input type="text" value={game.address || ''} onChange={(e) => updateGame('address', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder={t('gameForm.field.address')} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:col-span-2">
                        <h3 className="text-lg font-bold text-slate-800 mb-6">{t('gameForm.section.matchup')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('gameForm.field.homeTeam')}</label>
                                <input type="text" value={game.home_team || ''} onChange={(e) => updateGame('home_team', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="Aura FC" />
                            </div>
                            <div className="flex items-center justify-center">
                                <div className="flex items-center gap-2">
                                    <input type="number" min="0" value={game.home_score ?? ''} onChange={(e) => updateGame('home_score', e.target.value ? parseInt(e.target.value) : undefined)} className="w-16 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold text-lg" placeholder="-" />
                                    <span className="text-slate-400 font-bold text-xl">x</span>
                                    <input type="number" min="0" value={game.away_score ?? ''} onChange={(e) => updateGame('away_score', e.target.value ? parseInt(e.target.value) : undefined)} className="w-16 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold text-lg" placeholder="-" />
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('gameForm.field.awayTeam')}</label>
                                <input type="text" value={game.away_team || ''} onChange={(e) => updateGame('away_team', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="Adversário" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={game.is_home_game ?? true} onChange={(e) => updateGame('is_home_game', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary" />
                                <span className="text-sm text-slate-600">{t('gameForm.field.homeGame')}</span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* Tactical Tab */}
            {activeTab === 'tactical' && (
                <FeatureGate feature="tactical">
                    <GameTacticalBoard
                        starters={players.filter(p => p.is_starter)}
                        allPlayers={players}
                        substitutions={substitutions}
                        homeTeamName={game.home_team || 'Nosso Time'}
                        awayTeamName={game.away_team || 'Adversário'}
                        isHomeGame={game.is_home_game ?? true}
                        initialData={game.tactical_board}
                        onChange={(data) => updateGame('tactical_board', data)}
                    />
                </FeatureGate>
            )}

            {/* Lineup Tab */}
            {activeTab === 'lineup' && (
                <div className="space-y-6">
                    {/* Add Players */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <UserPlus className="w-5 h-5 text-primary" />
                                {t('gameForm.lineup.addPlayers')}
                            </h3>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <div className="flex items-center gap-2">
                                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                                    <option value="">{t('gameForm.lineup.selectCategory')}</option>
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <button onClick={() => selectedCategory && addPlayersByCategory(selectedCategory)} disabled={!selectedCategory} className="px-4 py-2 bg-primary text-white font-semibold text-sm rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed">
                                    {t('gameForm.lineup.addCategory')}
                                </button>
                            </div>

                            <div className="h-8 w-px bg-slate-200" />

                            <button onClick={() => setShowAthleteSelector(!showAthleteSelector)} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-200">
                                {showAthleteSelector ? t('common.close') || 'Fechar' : t('gameForm.lineup.addIndividual')}
                            </button>
                        </div>

                        {showAthleteSelector && (
                            <div className="mt-4 p-4 bg-slate-50 rounded-lg max-h-60 overflow-y-auto">
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {availableAthletes.map(athlete => (
                                        <button
                                            key={athlete.id}
                                            onClick={() => addPlayer(athlete)}
                                            className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-primary hover:bg-primary/5 transition-colors text-left"
                                        >
                                            {athlete.photo_url ? (
                                                <img src={athlete.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                                    {athlete.full_name.charAt(0)}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 truncate">{athlete.full_name}</p>
                                                <p className="text-xs text-slate-500">{athlete.category}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                {availableAthletes.length === 0 && (
                                    <p className="text-center text-slate-400 py-4">{t('gameForm.lineup.allAdded')}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Players List */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-800">{t('gameForm.lineup.related')} ({players.length})</h3>
                        </div>

                        {players.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p className="font-medium">{t('gameForm.lineup.noPlayers')}</p>
                                <p className="text-sm">{t('gameForm.lineup.useOptions')}</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                                            <th className="px-4 py-3 text-left font-bold">{t('gameForm.lineup.col.player')}</th>
                                            <th className="hidden sm:table-cell px-3 py-3 text-left font-bold w-36">{t('gameForm.lineup.col.position')}</th>
                                            <th className="px-3 py-3 text-center font-bold w-16">{t('gameForm.lineup.col.starter')}</th>
                                            <th className="hidden sm:table-cell px-3 py-3 text-center font-bold w-20">{t('gameForm.lineup.col.minutes')}</th>
                                            <th className="hidden md:table-cell px-3 py-3 text-center w-20">
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <svg viewBox="0 0 20 20" className="w-5 h-5 text-green-600" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.3"/>
                                                        <polygon points="10,6.2 12.9,8.3 11.8,11.8 8.2,11.8 7.1,8.3" fill="currentColor"/>
                                                        <line x1="10" y1="6.2" x2="10" y2="1.5" stroke="currentColor" strokeWidth="1.1"/>
                                                        <line x1="12.9" y1="8.3" x2="17.5" y2="5.8" stroke="currentColor" strokeWidth="1.1"/>
                                                        <line x1="11.8" y1="11.8" x2="15.8" y2="15.8" stroke="currentColor" strokeWidth="1.1"/>
                                                        <line x1="8.2" y1="11.8" x2="4.2" y2="15.8" stroke="currentColor" strokeWidth="1.1"/>
                                                        <line x1="7.1" y1="8.3" x2="2.5" y2="5.8" stroke="currentColor" strokeWidth="1.1"/>
                                                    </svg>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">{t('gameForm.lineup.col.goals')}</span>
                                                </div>
                                            </th>
                                            <th className="hidden md:table-cell px-3 py-3 text-center w-20">
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <Share2 className="w-5 h-5 text-blue-500" />
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">{t('gameForm.lineup.col.assists')}</span>
                                                </div>
                                            </th>
                                            <th className="hidden md:table-cell px-3 py-3 text-center w-20">
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <div className="w-4 h-[22px] bg-yellow-400 rounded-[3px] shadow-sm border border-yellow-500" />
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">{t('gameForm.lineup.col.yellowCard')}</span>
                                                </div>
                                            </th>
                                            <th className="hidden md:table-cell px-3 py-3 text-center w-20">
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <div className="w-4 h-[22px] bg-red-500 rounded-[3px] shadow-sm border border-red-600" />
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">{t('gameForm.lineup.col.redCard')}</span>
                                                </div>
                                            </th>
                                            <th className="px-3 py-3 text-center font-bold w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {players.map((player, index) => {
                                            const isSubbedOut = substitutions.some(s => s.outAthleteId === player.athlete_id);
                                            const isSubbedIn  = substitutions.some(s => s.inAthleteId  === player.athlete_id);
                                            const subOutMin   = substitutions.find(s => s.outAthleteId === player.athlete_id)?.minute;
                                            const subInMin    = substitutions.find(s => s.inAthleteId  === player.athlete_id)?.minute;
                                            return (
                                                <tr key={index} className={`hover:bg-slate-50 ${isSubbedOut ? 'opacity-60' : ''}`}>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            {player.athlete?.photo_url ? (
                                                                <img src={player.athlete.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                                                            ) : (
                                                                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                                                    {player.athlete?.full_name?.charAt(0) || '?'}
                                                                </div>
                                                            )}
                                                            <div>
                                                                <p className="font-semibold text-slate-800">{player.athlete?.full_name}</p>
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <p className="text-xs text-slate-400">{player.athlete?.category}</p>
                                                                    {isSubbedOut && (
                                                                        <span className="inline-flex items-center gap-0.5 text-xs text-red-500 font-semibold">
                                                                            <ArrowUpFromLine className="w-3 h-3" />{subOutMin}'
                                                                        </span>
                                                                    )}
                                                                    {isSubbedIn && (
                                                                        <span className="inline-flex items-center gap-0.5 text-xs text-green-600 font-semibold">
                                                                            <ArrowDownToLine className="w-3 h-3" />{subInMin}'
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="hidden sm:table-cell px-3 py-3">
                                                        <select
                                                            value={player.position || player.athlete?.position || ''}
                                                            onChange={(e) => updatePlayer(index, 'position', e.target.value)}
                                                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm"
                                                        >
                                                            <option value="">{t('gameForm.field.select')}</option>
                                                            {positions.map(p => <option key={p} value={p}>{t(`positions.${p}`) || p}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-3 py-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={player.is_starter || false}
                                                            onChange={(e) => updatePlayer(index, 'is_starter', e.target.checked)}
                                                            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                                        />
                                                    </td>
                                                    <td className="hidden sm:table-cell px-3 py-3">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="120"
                                                            value={player.minutes_played ?? ''}
                                                            onChange={(e) => updatePlayer(index, 'minutes_played', e.target.value ? parseInt(e.target.value) : 0)}
                                                            className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-center text-sm"
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td className="hidden md:table-cell px-2 py-3">
                                                        <input type="number" min="0" value={player.goals ?? ''} onChange={(e) => updatePlayer(index, 'goals', e.target.value ? parseInt(e.target.value) : 0)} className="w-full min-w-[56px] px-2 py-1.5 bg-green-50 border border-green-200 rounded-lg text-center text-sm font-bold text-green-700 focus:ring-2 focus:ring-green-200 outline-none" placeholder="0" />
                                                    </td>
                                                    <td className="hidden md:table-cell px-2 py-3">
                                                        <input type="number" min="0" value={player.assists ?? ''} onChange={(e) => updatePlayer(index, 'assists', e.target.value ? parseInt(e.target.value) : 0)} className="w-full min-w-[56px] px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-center text-sm font-bold text-blue-700 focus:ring-2 focus:ring-blue-200 outline-none" placeholder="0" />
                                                    </td>
                                                    <td className="hidden md:table-cell px-2 py-3">
                                                        <input type="number" min="0" value={player.yellow_cards ?? ''} onChange={(e) => updatePlayer(index, 'yellow_cards', e.target.value ? parseInt(e.target.value) : 0)} className="w-full min-w-[56px] px-2 py-1.5 bg-yellow-50 border border-yellow-200 rounded-lg text-center text-sm font-bold text-yellow-700 focus:ring-2 focus:ring-yellow-200 outline-none" placeholder="0" />
                                                    </td>
                                                    <td className="hidden md:table-cell px-2 py-3">
                                                        <input type="number" min="0" value={player.red_cards ?? ''} onChange={(e) => updatePlayer(index, 'red_cards', e.target.value ? parseInt(e.target.value) : 0)} className="w-full min-w-[56px] px-2 py-1.5 bg-red-50 border border-red-200 rounded-lg text-center text-sm font-bold text-red-700 focus:ring-2 focus:ring-red-200 outline-none" placeholder="0" />
                                                    </td>
                                                    <td className="px-3 py-3 text-center">
                                                        <button onClick={() => removePlayer(index)} className="p-1 text-slate-400 hover:text-red-500">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Substitutions */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 text-primary" />
                                Substituições
                                {substitutions.length > 0 && (
                                    <span className="ml-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">{substitutions.length}</span>
                                )}
                            </h3>
                            {!addingSubstitution && (
                                <button
                                    onClick={() => setAddingSubstitution(true)}
                                    disabled={startersAvailableToGoOff.length === 0 || benchAvailableToComeon.length === 0}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Adicionar
                                </button>
                            )}
                        </div>

                        <div className="p-4 space-y-3">
                            {substitutions.length === 0 && !addingSubstitution && (
                                <p className="text-sm text-slate-400 text-center py-4">Nenhuma substituição registrada</p>
                            )}

                            {/* Substitution rows */}
                            {substitutions.map(sub => (
                                <div key={sub.localId} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    {/* Minute badge */}
                                    <div className="flex-shrink-0 w-12 h-10 bg-slate-700 text-white rounded-lg flex flex-col items-center justify-center">
                                        <span className="text-xs font-bold leading-none">{sub.minute}'</span>
                                    </div>

                                    {/* Out player */}
                                    <div className="flex-1 flex items-center gap-2 min-w-0">
                                        <ArrowUpFromLine className="w-4 h-4 text-red-500 flex-shrink-0" />
                                        <span className="text-sm font-semibold text-slate-800 truncate">{getPlayerName(sub.outAthleteId)}</span>
                                    </div>

                                    {/* Divider */}
                                    <div className="flex-shrink-0 text-slate-300 font-bold">→</div>

                                    {/* In player */}
                                    <div className="flex-1 flex items-center gap-2 min-w-0">
                                        <ArrowDownToLine className="w-4 h-4 text-green-600 flex-shrink-0" />
                                        <span className="text-sm font-semibold text-slate-800 truncate">{getPlayerName(sub.inAthleteId)}</span>
                                    </div>

                                    <button onClick={() => removeSubstitution(sub.localId)} className="flex-shrink-0 p-1 text-slate-400 hover:text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}

                            {/* Add substitution form */}
                            {addingSubstitution && (
                                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                                    <p className="text-sm font-bold text-slate-700">Nova Substituição</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">Minuto</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="120"
                                                value={newSub.minute || ''}
                                                onChange={(e) => setNewSub(p => ({ ...p, minute: parseInt(e.target.value) || 0 }))}
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                                placeholder="Ex: 65"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                                                <ArrowUpFromLine className="w-3 h-3 text-red-500" /> Sai
                                            </label>
                                            <select
                                                value={newSub.outAthleteId}
                                                onChange={(e) => setNewSub(p => ({ ...p, outAthleteId: e.target.value }))}
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                            >
                                                <option value="">Selecionar titular</option>
                                                {startersAvailableToGoOff.map(p => (
                                                    <option key={p.athlete_id} value={p.athlete_id}>{p.athlete?.full_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                                                <ArrowDownToLine className="w-3 h-3 text-green-600" /> Entra
                                            </label>
                                            <select
                                                value={newSub.inAthleteId}
                                                onChange={(e) => setNewSub(p => ({ ...p, inAthleteId: e.target.value }))}
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                            >
                                                <option value="">Selecionar reserva</option>
                                                {benchAvailableToComeon.map(p => (
                                                    <option key={p.athlete_id} value={p.athlete_id}>{p.athlete?.full_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={() => { setAddingSubstitution(false); setNewSub({ minute: 0, outAthleteId: '', inAthleteId: '' }); }}
                                            className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={confirmAddSubstitution}
                                            disabled={!newSub.outAthleteId || !newSub.inAthleteId}
                                            className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50"
                                        >
                                            Confirmar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameForm;
