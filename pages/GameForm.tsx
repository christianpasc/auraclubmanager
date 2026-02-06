
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Calendar, Save, ArrowLeft, Loader2, Users, Trophy, MapPin, Clock, Plus, Trash2, UserPlus
} from 'lucide-react';
import {
    gameService, gamePlayerService, competitionService, Game, GamePlayer, Competition,
    gameStatuses
} from '../services/competitionService';
import { athleteService, Athlete } from '../services/athleteService';

type TabType = 'general' | 'lineup';

const GameForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEditing = !!id;

    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [game, setGame] = useState<Partial<Game>>({
        status: 'scheduled',
        is_home_game: true,
        home_team: 'Aura FC',
    });
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [players, setPlayers] = useState<Partial<GamePlayer>[]>([]);
    const [athletes, setAthletes] = useState<Athlete[]>([]);
    const [showAthleteSelector, setShowAthleteSelector] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('');

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
            }
        } catch (err) {
            setError('Erro ao carregar dados');
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
        setPlayers(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!game.competition_id) {
            setError('Selecione uma competição');
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

            // Save players
            if (gameId) {
                const playersToSave = players.map(p => ({
                    game_id: gameId,
                    athlete_id: p.athlete_id,
                    position: p.position || p.athlete?.position,
                    is_starter: p.is_starter,
                    minutes_played: p.minutes_played,
                    goals: p.goals,
                    assists: p.assists,
                    yellow_cards: p.yellow_cards,
                    red_cards: p.red_cards,
                }));
                await gamePlayerService.upsertMany(gameId, playersToSave);
            }

            navigate('/games');
        } catch (err) {
            setError('Erro ao salvar jogo');
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
        { id: 'general' as TabType, label: 'Geral', icon: Calendar },
        { id: 'lineup' as TabType, label: 'Relacionados', icon: Users },
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
                        <h1 className="text-2xl font-bold text-slate-800">{isEditing ? 'Editar Jogo' : 'Novo Jogo'}</h1>
                        <p className="text-sm text-slate-500">{isEditing ? 'Atualize os dados do jogo' : 'Preencha os dados e adicione os relacionados'}</p>
                    </div>
                </div>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg shadow-lg shadow-primary/20 transition-all disabled:opacity-50">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Salvar
                </button>
            </div>

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
                            Competição e Rodada
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Competição *</label>
                                <select value={game.competition_id || ''} onChange={(e) => updateGame('competition_id', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                                    <option value="">Selecione</option>
                                    {competitions.map(c => <option key={c.id} value={c.id}>{c.name} {c.season ? `(${c.season})` : ''}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Rodada / Fase</label>
                                <input type="text" value={game.round || ''} onChange={(e) => updateGame('round', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="Ex: Rodada 1, Quartas de Final" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
                                <select value={game.status || 'scheduled'} onChange={(e) => updateGame('status', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                                    {gameStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-primary" />
                            Data e Horário
                        </h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Data</label>
                                    <input type="date" value={game.game_date || ''} onChange={(e) => updateGame('game_date', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Horário</label>
                                    <input type="time" value={game.game_time || ''} onChange={(e) => updateGame('game_time', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Local</label>
                                <input type="text" value={game.venue || ''} onChange={(e) => updateGame('venue', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="Estádio / Campo" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Endereço</label>
                                <input type="text" value={game.address || ''} onChange={(e) => updateGame('address', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="Endereço completo" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:col-span-2">
                        <h3 className="text-lg font-bold text-slate-800 mb-6">Confronto</h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Mandante</label>
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
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Visitante</label>
                                <input type="text" value={game.away_team || ''} onChange={(e) => updateGame('away_team', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="Adversário" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={game.is_home_game ?? true} onChange={(e) => updateGame('is_home_game', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary" />
                                <span className="text-sm text-slate-600">Jogo em casa (somos o mandante)</span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* Lineup Tab */}
            {activeTab === 'lineup' && (
                <div className="space-y-6">
                    {/* Add Players */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <UserPlus className="w-5 h-5 text-primary" />
                                Adicionar Jogadores
                            </h3>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <div className="flex items-center gap-2">
                                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                                    <option value="">Selecione uma categoria</option>
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <button onClick={() => selectedCategory && addPlayersByCategory(selectedCategory)} disabled={!selectedCategory} className="px-4 py-2 bg-primary text-white font-semibold text-sm rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed">
                                    Adicionar Categoria
                                </button>
                            </div>

                            <div className="h-8 w-px bg-slate-200" />

                            <button onClick={() => setShowAthleteSelector(!showAthleteSelector)} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-200">
                                {showAthleteSelector ? 'Fechar' : 'Adicionar Individual'}
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
                                    <p className="text-center text-slate-400 py-4">Todos os atletas já foram adicionados</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Players List */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-800">Relacionados ({players.length})</h3>
                        </div>

                        {players.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p className="font-medium">Nenhum jogador relacionado</p>
                                <p className="text-sm">Adicione jogadores usando as opções acima</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                                            <th className="px-4 py-3 text-left font-bold">Jogador</th>
                                            <th className="px-3 py-3 text-left font-bold w-36">Posição</th>
                                            <th className="px-3 py-3 text-center font-bold w-16">Titular</th>
                                            <th className="px-3 py-3 text-center font-bold w-20">Min</th>
                                            <th className="px-3 py-3 text-center font-bold w-16">⚽</th>
                                            <th className="px-3 py-3 text-center font-bold w-16">🅰️</th>
                                            <th className="px-3 py-3 text-center font-bold w-16">🟨</th>
                                            <th className="px-3 py-3 text-center font-bold w-16">🟥</th>
                                            <th className="px-3 py-3 text-center font-bold w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {players.map((player, index) => (
                                            <tr key={index} className="hover:bg-slate-50">
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
                                                            <p className="text-xs text-slate-500">{player.athlete?.category}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <select
                                                        value={player.position || player.athlete?.position || ''}
                                                        onChange={(e) => updatePlayer(index, 'position', e.target.value)}
                                                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm"
                                                    >
                                                        <option value="">Selecione</option>
                                                        {positions.map(p => <option key={p} value={p}>{p}</option>)}
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
                                                <td className="px-3 py-3">
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
                                                <td className="px-3 py-3">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={player.goals ?? ''}
                                                        onChange={(e) => updatePlayer(index, 'goals', e.target.value ? parseInt(e.target.value) : 0)}
                                                        className="w-full px-2 py-1 bg-green-50 border border-green-200 rounded text-center text-sm font-semibold text-green-700"
                                                        placeholder="0"
                                                    />
                                                </td>
                                                <td className="px-3 py-3">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={player.assists ?? ''}
                                                        onChange={(e) => updatePlayer(index, 'assists', e.target.value ? parseInt(e.target.value) : 0)}
                                                        className="w-full px-2 py-1 bg-blue-50 border border-blue-200 rounded text-center text-sm font-semibold text-blue-700"
                                                        placeholder="0"
                                                    />
                                                </td>
                                                <td className="px-3 py-3">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={player.yellow_cards ?? ''}
                                                        onChange={(e) => updatePlayer(index, 'yellow_cards', e.target.value ? parseInt(e.target.value) : 0)}
                                                        className="w-full px-2 py-1 bg-yellow-50 border border-yellow-200 rounded text-center text-sm font-semibold text-yellow-700"
                                                        placeholder="0"
                                                    />
                                                </td>
                                                <td className="px-3 py-3">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={player.red_cards ?? ''}
                                                        onChange={(e) => updatePlayer(index, 'red_cards', e.target.value ? parseInt(e.target.value) : 0)}
                                                        className="w-full px-2 py-1 bg-red-50 border border-red-200 rounded text-center text-sm font-semibold text-red-700"
                                                        placeholder="0"
                                                    />
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    <button onClick={() => removePlayer(index)} className="p-1 text-slate-400 hover:text-red-500">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameForm;
