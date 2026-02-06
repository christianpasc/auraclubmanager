
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Calendar, Save, ArrowLeft, Loader2, Users, Clock, MapPin, Plus, Trash2, UserPlus,
    Dumbbell, ListChecks, GripVertical
} from 'lucide-react';
import {
    trainingService, trainingParticipantService, trainingActivityService,
    Training, TrainingParticipant, TrainingActivity,
    trainingStatuses, trainingIntensities, trainingPhases
} from '../services/trainingService';
import { athleteService, Athlete } from '../services/athleteService';

type TabType = 'general' | 'athletes' | 'activities';

const TrainingForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEditing = !!id;

    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [training, setTraining] = useState<Partial<Training>>({
        status: 'scheduled',
        intensity: 'medium',
    });
    const [participants, setParticipants] = useState<Partial<TrainingParticipant>[]>([]);
    const [activities, setActivities] = useState<Partial<TrainingActivity>[]>([]);
    const [athletes, setAthletes] = useState<Athlete[]>([]);
    const [showAthleteSelector, setShowAthleteSelector] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('');

    const categories = ['Sub-7', 'Sub-9', 'Sub-11', 'Sub-13', 'Sub-15', 'Sub-17', 'Sub-20', 'Profissional'];

    useEffect(() => {
        loadInitialData();
    }, [id]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const athletesData = await athleteService.getAll();
            setAthletes(athletesData.filter(a => a.status === 'active'));

            if (id) {
                const [trainingData, participantsData, activitiesData] = await Promise.all([
                    trainingService.getById(id),
                    trainingParticipantService.getByTraining(id),
                    trainingActivityService.getByTraining(id),
                ]);
                setTraining(trainingData);
                setParticipants(participantsData);
                setActivities(activitiesData);
            }
        } catch (err) {
            setError('Erro ao carregar dados');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const updateTraining = (field: keyof Training, value: any) => {
        setTraining(prev => ({ ...prev, [field]: value }));
    };

    // Participants functions
    const addParticipant = (athlete: Athlete) => {
        if (participants.some(p => p.athlete_id === athlete.id)) return;
        setParticipants(prev => [...prev, {
            athlete_id: athlete.id,
            athlete: {
                id: athlete.id!,
                full_name: athlete.full_name,
                photo_url: athlete.photo_url,
                category: athlete.category,
                position: athlete.position,
            },
            attended: false,
            performance_rating: undefined,
            effort_rating: undefined,
            notes: '',
        }]);
    };

    const addParticipantsByCategory = (category: string) => {
        const categoryAthletes = athletes.filter(a => a.category === category && !participants.some(p => p.athlete_id === a.id));
        categoryAthletes.forEach(athlete => addParticipant(athlete));
        setShowAthleteSelector(false);
    };

    const updateParticipant = (index: number, field: keyof TrainingParticipant, value: any) => {
        setParticipants(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
    };

    const removeParticipant = (index: number) => {
        setParticipants(prev => prev.filter((_, i) => i !== index));
    };

    // Activities functions
    const addActivity = () => {
        setActivities(prev => [...prev, {
            phase: 'main',
            activity_name: '',
            duration_minutes: 15,
            description: '',
            order_index: prev.length,
        }]);
    };

    const updateActivity = (index: number, field: keyof TrainingActivity, value: any) => {
        setActivities(prev => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
    };

    const removeActivity = (index: number) => {
        setActivities(prev => prev.filter((_, i) => i !== index));
    };

    const moveActivity = (index: number, direction: 'up' | 'down') => {
        if ((direction === 'up' && index === 0) || (direction === 'down' && index === activities.length - 1)) return;
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        setActivities(prev => {
            const newArr = [...prev];
            [newArr[index], newArr[newIndex]] = [newArr[newIndex], newArr[index]];
            return newArr;
        });
    };

    const handleSave = async () => {
        if (!training.training_date) {
            setError('Selecione uma data para o treino');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            let trainingId = id;

            if (isEditing && id) {
                await trainingService.update(id, training);
            } else {
                const created = await trainingService.create(training as Training);
                trainingId = created.id;
            }

            // Save participants
            if (trainingId) {
                const participantsToSave = participants.map(p => ({
                    training_id: trainingId,
                    athlete_id: p.athlete_id,
                    attended: p.attended,
                    performance_rating: p.performance_rating,
                    effort_rating: p.effort_rating,
                    notes: p.notes,
                }));
                await trainingParticipantService.upsertMany(trainingId, participantsToSave);

                const activitiesToSave = activities.map((a, index) => ({
                    training_id: trainingId,
                    phase: a.phase,
                    activity_name: a.activity_name,
                    duration_minutes: a.duration_minutes,
                    description: a.description,
                    order_index: index,
                }));
                await trainingActivityService.upsertMany(trainingId, activitiesToSave);
            }

            navigate('/training');
        } catch (err) {
            setError('Erro ao salvar treino');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const availableAthletes = athletes.filter(a => !participants.some(p => p.athlete_id === a.id));

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    const tabs = [
        { id: 'general' as TabType, label: 'Geral', icon: Calendar },
        { id: 'athletes' as TabType, label: 'Atletas', icon: Users },
        { id: 'activities' as TabType, label: 'Atividades', icon: ListChecks },
    ];

    const getPhaseLabel = (phase?: string) => {
        return trainingPhases.find(p => p.value === phase)?.label || phase;
    };

    const getPhaseColor = (phase?: string) => {
        switch (phase) {
            case 'warmup': return 'bg-orange-100 text-orange-700';
            case 'main': return 'bg-blue-100 text-blue-700';
            case 'cooldown': return 'bg-green-100 text-green-700';
            case 'tactical': return 'bg-purple-100 text-purple-700';
            case 'physical': return 'bg-red-100 text-red-700';
            case 'technical': return 'bg-cyan-100 text-cyan-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/training')} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{isEditing ? 'Editar Treino' : 'Novo Treino'}</h1>
                        <p className="text-sm text-slate-500">{isEditing ? 'Atualize os dados do treino' : 'Preencha os dados e adicione atletas e atividades'}</p>
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
                        {tab.id === 'athletes' && participants.length > 0 && (
                            <span className="ml-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">{participants.length}</span>
                        )}
                        {tab.id === 'activities' && activities.length > 0 && (
                            <span className="ml-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">{activities.length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* General Tab */}
            {activeTab === 'general' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-primary" />
                            Data e Horário
                        </h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Data *</label>
                                    <input type="date" value={training.training_date || ''} onChange={(e) => updateTraining('training_date', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Hora Início</label>
                                    <input type="time" value={training.training_time || ''} onChange={(e) => updateTraining('training_time', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Hora Fim</label>
                                    <input type="time" value={training.end_time || ''} onChange={(e) => updateTraining('end_time', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Local</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input type="text" value={training.location || ''} onChange={(e) => updateTraining('location', e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="Campo A, Academia, etc." />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Dumbbell className="w-5 h-5 text-primary" />
                            Detalhes do Treino
                        </h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Categoria</label>
                                    <select value={training.category || ''} onChange={(e) => updateTraining('category', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                                        <option value="">Selecione</option>
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Intensidade</label>
                                    <select value={training.intensity || 'medium'} onChange={(e) => updateTraining('intensity', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                                        {trainingIntensities.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Foco Principal</label>
                                <input type="text" value={training.focus || ''} onChange={(e) => updateTraining('focus', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="Ex: Tático, Físico, Finalização" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
                                <select value={training.status || 'scheduled'} onChange={(e) => updateTraining('status', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                                    {trainingStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:col-span-2">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Descrição e Observações</h3>
                        <textarea value={training.description || ''} onChange={(e) => updateTraining('description', e.target.value)} rows={3} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" placeholder="Descreva os objetivos e observações do treino..." />
                    </div>
                </div>
            )}

            {/* Athletes Tab */}
            {activeTab === 'athletes' && (
                <div className="space-y-6">
                    {/* Add Participants */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <UserPlus className="w-5 h-5 text-primary" />
                                Adicionar Atletas
                            </h3>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <div className="flex items-center gap-2">
                                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                                    <option value="">Selecione uma categoria</option>
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <button onClick={() => selectedCategory && addParticipantsByCategory(selectedCategory)} disabled={!selectedCategory} className="px-4 py-2 bg-primary text-white font-semibold text-sm rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed">
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
                                            onClick={() => addParticipant(athlete)}
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

                    {/* Participants List */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-800">Lista de Presença ({participants.length})</h3>
                        </div>

                        {participants.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p className="font-medium">Nenhum atleta adicionado</p>
                                <p className="text-sm">Adicione atletas usando as opções acima</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                                            <th className="px-4 py-3 text-left font-bold">Atleta</th>
                                            <th className="px-3 py-3 text-center font-bold w-20">Presente</th>
                                            <th className="px-3 py-3 text-center font-bold w-32">Desempenho</th>
                                            <th className="px-3 py-3 text-center font-bold w-32">Esforço</th>
                                            <th className="px-3 py-3 text-left font-bold w-48">Observações</th>
                                            <th className="px-3 py-3 text-center font-bold w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {participants.map((participant, index) => (
                                            <tr key={index} className="hover:bg-slate-50">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        {participant.athlete?.photo_url ? (
                                                            <img src={participant.athlete.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                                                        ) : (
                                                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                                                {participant.athlete?.full_name?.charAt(0) || '?'}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="font-semibold text-slate-800">{participant.athlete?.full_name}</p>
                                                            <p className="text-xs text-slate-500">{participant.athlete?.category} • {participant.athlete?.position}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={participant.attended || false}
                                                        onChange={(e) => updateParticipant(index, 'attended', e.target.checked)}
                                                        className="w-5 h-5 rounded border-slate-300 text-green-600 focus:ring-green-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-3">
                                                    <select
                                                        value={participant.performance_rating || ''}
                                                        onChange={(e) => updateParticipant(index, 'performance_rating', e.target.value ? parseInt(e.target.value) : undefined)}
                                                        className="w-full px-2 py-1.5 bg-blue-50 border border-blue-200 rounded text-sm text-center"
                                                    >
                                                        <option value="">—</option>
                                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <select
                                                        value={participant.effort_rating || ''}
                                                        onChange={(e) => updateParticipant(index, 'effort_rating', e.target.value ? parseInt(e.target.value) : undefined)}
                                                        className="w-full px-2 py-1.5 bg-orange-50 border border-orange-200 rounded text-sm text-center"
                                                    >
                                                        <option value="">—</option>
                                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <input
                                                        type="text"
                                                        value={participant.notes || ''}
                                                        onChange={(e) => updateParticipant(index, 'notes', e.target.value)}
                                                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm"
                                                        placeholder="Observações..."
                                                    />
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    <button onClick={() => removeParticipant(index)} className="p-1 text-slate-400 hover:text-red-500">
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

            {/* Activities Tab */}
            {activeTab === 'activities' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <ListChecks className="w-5 h-5 text-primary" />
                                Atividades do Treino
                            </h3>
                            <button onClick={addActivity} className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-semibold text-sm rounded-lg hover:bg-primary-dark">
                                <Plus className="w-4 h-4" />
                                Adicionar Atividade
                            </button>
                        </div>

                        {activities.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                <ListChecks className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p className="font-medium">Nenhuma atividade cadastrada</p>
                                <p className="text-sm mb-4">Adicione atividades para montar o plano do treino</p>
                                <button onClick={addActivity} className="px-4 py-2 bg-primary text-white font-semibold text-sm rounded-lg hover:bg-primary-dark">
                                    Adicionar Primeira Atividade
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {activities.map((activity, index) => (
                                    <div key={index} className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                        <div className="flex flex-col items-center gap-1">
                                            <button onClick={() => moveActivity(index, 'up')} disabled={index === 0} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                                                <GripVertical className="w-4 h-4" />
                                            </button>
                                            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                                                {index + 1}
                                            </span>
                                            <button onClick={() => moveActivity(index, 'down')} disabled={index === activities.length - 1} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                                                <GripVertical className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Fase</label>
                                                <select
                                                    value={activity.phase || 'main'}
                                                    onChange={(e) => updateActivity(index, 'phase', e.target.value)}
                                                    className={`w-full px-3 py-2 rounded-lg text-sm font-semibold ${getPhaseColor(activity.phase)}`}
                                                >
                                                    {trainingPhases.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                                </select>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Nome da Atividade</label>
                                                <input
                                                    type="text"
                                                    value={activity.activity_name || ''}
                                                    onChange={(e) => updateActivity(index, 'activity_name', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                                    placeholder="Ex: Rondo 4x2, Corrida intervalada..."
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Duração (min)</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={activity.duration_minutes || ''}
                                                    onChange={(e) => updateActivity(index, 'duration_minutes', e.target.value ? parseInt(e.target.value) : undefined)}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                                    placeholder="15"
                                                />
                                            </div>
                                            <div className="md:col-span-4">
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Descrição (opcional)</label>
                                                <input
                                                    type="text"
                                                    value={activity.description || ''}
                                                    onChange={(e) => updateActivity(index, 'description', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                                    placeholder="Detalhes sobre a atividade..."
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-start">
                                            <button onClick={() => removeActivity(index)} className="p-2 text-slate-400 hover:text-red-500">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activities.length > 0 && (
                            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                                <p className="text-sm text-blue-700">
                                    <strong>Tempo Total:</strong> {activities.reduce((sum, a) => sum + (a.duration_minutes || 0), 0)} minutos
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrainingForm;
