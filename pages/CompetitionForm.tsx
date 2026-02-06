
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Trophy, Calendar, Save, ArrowLeft, Loader2, Plus, Trash2, MapPin, Clock
} from 'lucide-react';
import {
    competitionService, gameService, Competition, Game,
    competitionTypes, competitionStatuses, gameStatuses
} from '../services/competitionService';

const CompetitionForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEditing = !!id;

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [competition, setCompetition] = useState<Partial<Competition>>({
        name: '',
        status: 'upcoming',
        type: 'league',
    });
    const [games, setGames] = useState<Partial<Game>[]>([]);

    const categories = ['Sub-7', 'Sub-9', 'Sub-11', 'Sub-13', 'Sub-15', 'Sub-17', 'Sub-20', 'Profissional'];

    useEffect(() => {
        if (id) loadCompetition(id);
    }, [id]);

    const loadCompetition = async (compId: string) => {
        setLoading(true);
        try {
            const [compData, gamesData] = await Promise.all([
                competitionService.getById(compId),
                gameService.getByCompetition(compId),
            ]);
            setCompetition(compData);
            setGames(gamesData);
        } catch (err) {
            setError('Erro ao carregar competição');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const updateCompetition = (field: keyof Competition, value: any) => {
        setCompetition(prev => ({ ...prev, [field]: value }));
    };

    const addGame = () => {
        setGames(prev => [...prev, {
            home_team: 'Aura FC',
            away_team: '',
            is_home_game: true,
            status: 'scheduled',
        }]);
    };

    const updateGame = (index: number, field: keyof Game, value: any) => {
        setGames(prev => prev.map((g, i) => i === index ? { ...g, [field]: value } : g));
    };

    const removeGame = (index: number) => {
        setGames(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!competition.name?.trim()) {
            setError('O nome da competição é obrigatório');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            let competitionId = id;

            if (isEditing && id) {
                await competitionService.update(id, competition);
                // Delete existing games and recreate
                await gameService.deleteByCompetition(id);
            } else {
                const created = await competitionService.create(competition as Competition);
                competitionId = created.id;
            }

            // Save games
            if (competitionId && games.length > 0) {
                const gamesToSave = games.map(g => ({
                    ...g,
                    competition_id: competitionId,
                }));
                await gameService.createMany(gamesToSave as Game[]);
            }

            navigate('/competitions');
        } catch (err) {
            setError('Erro ao salvar competição');
            console.error(err);
        } finally {
            setSaving(false);
        }
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
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/competitions')} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{isEditing ? 'Editar Competição' : 'Nova Competição'}</h1>
                        <p className="text-sm text-slate-500">{isEditing ? 'Atualize os dados da competição' : 'Preencha os dados e adicione os jogos'}</p>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Competition Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-primary" />
                            Informações da Competição
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Nome *</label>
                                <input type="text" value={competition.name || ''} onChange={(e) => updateCompetition('name', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="Ex: Campeonato Paulista" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Tipo</label>
                                <select value={competition.type || 'league'} onChange={(e) => updateCompetition('type', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                                    {competitionTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Categoria</label>
                                <select value={competition.category || ''} onChange={(e) => updateCompetition('category', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                                    <option value="">Selecione</option>
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Temporada</label>
                                <input type="text" value={competition.season || ''} onChange={(e) => updateCompetition('season', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="2025" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Início</label>
                                    <input type="date" value={competition.start_date || ''} onChange={(e) => updateCompetition('start_date', e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Fim</label>
                                    <input type="date" value={competition.end_date || ''} onChange={(e) => updateCompetition('end_date', e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
                                <select value={competition.status || 'upcoming'} onChange={(e) => updateCompetition('status', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                                    {competitionStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Organizador</label>
                                <input type="text" value={competition.organizer || ''} onChange={(e) => updateCompetition('organizer', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="Federação Paulista" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Descrição</label>
                                <textarea value={competition.description || ''} onChange={(e) => updateCompetition('description', e.target.value)} rows={3} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" placeholder="Detalhes da competição..." />
                            </div>
                        </div>
                    </div>

                    {/* Final Stats - Show when status is 'finished' */}
                    {(competition.status === 'finished' || competition.final_position) && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                🏅 Resultado Final
                            </h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Colocação Final</label>
                                        <input type="number" min="1" value={competition.final_position || ''} onChange={(e) => updateCompetition('final_position', e.target.value ? parseInt(e.target.value) : undefined)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="1º" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Total de Equipes</label>
                                        <input type="number" min="1" value={competition.total_teams || ''} onChange={(e) => updateCompetition('total_teams', e.target.value ? parseInt(e.target.value) : undefined)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="16" />
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-slate-100">
                                    <label className="block text-sm font-semibold text-slate-700 mb-3">Estatísticas</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">Vitórias</label>
                                            <input type="number" min="0" value={competition.wins ?? ''} onChange={(e) => updateCompetition('wins', e.target.value ? parseInt(e.target.value) : undefined)} className="w-full px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-center font-semibold text-green-700" placeholder="0" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">Empates</label>
                                            <input type="number" min="0" value={competition.draws ?? ''} onChange={(e) => updateCompetition('draws', e.target.value ? parseInt(e.target.value) : undefined)} className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-center font-semibold text-slate-600" placeholder="0" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">Derrotas</label>
                                            <input type="number" min="0" value={competition.losses ?? ''} onChange={(e) => updateCompetition('losses', e.target.value ? parseInt(e.target.value) : undefined)} className="w-full px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-center font-semibold text-red-700" placeholder="0" />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Gols Pró</label>
                                        <input type="number" min="0" value={competition.goals_for ?? ''} onChange={(e) => updateCompetition('goals_for', e.target.value ? parseInt(e.target.value) : undefined)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center" placeholder="0" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Gols Contra</label>
                                        <input type="number" min="0" value={competition.goals_against ?? ''} onChange={(e) => updateCompetition('goals_against', e.target.value ? parseInt(e.target.value) : undefined)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center" placeholder="0" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Games */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-primary" />
                                Jogos ({games.length})
                            </h3>
                            <button onClick={addGame} className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary font-semibold text-sm rounded-lg hover:bg-primary/20 transition-colors">
                                <Plus className="w-4 h-4" />
                                Adicionar Jogo
                            </button>
                        </div>

                        {games.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p className="font-medium">Nenhum jogo cadastrado</p>
                                <p className="text-sm">Clique em "Adicionar Jogo" para começar</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {games.map((game, index) => (
                                    <div key={index} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="flex items-start justify-between gap-4 mb-4">
                                            <div className="flex items-center gap-2">
                                                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                                                    {index + 1}
                                                </span>
                                                <input type="text" value={game.round || ''} onChange={(e) => updateGame(index, 'round', e.target.value)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm w-40" placeholder="Ex: Rodada 1" />
                                            </div>
                                            <button onClick={() => removeGame(index)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Data</label>
                                                <input type="date" value={game.game_date || ''} onChange={(e) => updateGame(index, 'game_date', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Horário</label>
                                                <input type="time" value={game.game_time || ''} onChange={(e) => updateGame(index, 'game_time', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Mandante</label>
                                                <input type="text" value={game.home_team || ''} onChange={(e) => updateGame(index, 'home_team', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" placeholder="Aura FC" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Visitante</label>
                                                <input type="text" value={game.away_team || ''} onChange={(e) => updateGame(index, 'away_team', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" placeholder="Adversário" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
                                                <select value={game.status || 'scheduled'} onChange={(e) => updateGame(index, 'status', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
                                                    {gameStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Local</label>
                                                <input type="text" value={game.venue || ''} onChange={(e) => updateGame(index, 'venue', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" placeholder="Estádio / Campo" />
                                            </div>
                                            <div className="flex items-end gap-3">
                                                <div className="flex-1">
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Placar</label>
                                                    <div className="flex items-center gap-2">
                                                        <input type="number" min="0" value={game.home_score ?? ''} onChange={(e) => updateGame(index, 'home_score', e.target.value ? parseInt(e.target.value) : undefined)} className="w-16 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-center" placeholder="-" />
                                                        <span className="text-slate-400 font-bold">x</span>
                                                        <input type="number" min="0" value={game.away_score ?? ''} onChange={(e) => updateGame(index, 'away_score', e.target.value ? parseInt(e.target.value) : undefined)} className="w-16 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-center" placeholder="-" />
                                                    </div>
                                                </div>
                                                <label className="flex items-center gap-2 pb-2 cursor-pointer">
                                                    <input type="checkbox" checked={game.is_home_game ?? true} onChange={(e) => updateGame(index, 'is_home_game', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary" />
                                                    <span className="text-xs text-slate-600">Jogo em casa</span>
                                                </label>
                                            </div>
                                        </div>
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

export default CompetitionForm;
