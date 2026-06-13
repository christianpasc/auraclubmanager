
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Calendar, Save, ArrowLeft, Loader2, Users, Clock, MapPin, Plus, Trash2, UserPlus,
    Dumbbell, ListChecks, GripVertical, BookOpen, Search, Zap,
} from 'lucide-react';
import { drillService, Drill, DrillCategory, INTENSITY_LABELS, INTENSITY_COLORS } from '../services/drillService';
import TacticalBoardModal from '../components/TacticalBoardModal';
import {
    trainingService, trainingParticipantService, trainingActivityService,
    Training, TrainingParticipant, TrainingActivity,
    trainingStatuses, trainingIntensities, trainingPhases
} from '../services/trainingService';
import { athleteService, Athlete } from '../services/athleteService';
import { useLanguage } from '../contexts/LanguageContext';
import { useSubscription } from '../contexts/SubscriptionContext';

type TabType = 'general' | 'athletes' | 'activities' | 'drills';

const TrainingForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEditing = !!id;
    const { t } = useLanguage();
    const { hasFeature } = useSubscription();

    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    const [training, setTraining] = useState<Partial<Training>>({
        status: 'scheduled',
        intensity: 'medium',
    });
    const [participants, setParticipants] = useState<Partial<TrainingParticipant>[]>([]);
    const [activities, setActivities] = useState<Partial<TrainingActivity>[]>([]);
    const [athletes, setAthletes] = useState<Athlete[]>([]);
    const [showAthleteSelector, setShowAthleteSelector] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [tacticalBoardIdx, setTacticalBoardIdx] = useState<number | null>(null);

    const [allDrills,       setAllDrills]       = useState<Drill[]>([]);
    const [drillCategories, setDrillCategories] = useState<DrillCategory[]>([]);
    const [selectedDrillIds, setSelectedDrillIds] = useState<string[]>([]);
    const [drillSearch,     setDrillSearch]     = useState('');
    const [drillFilterCat,  setDrillFilterCat]  = useState('');
    const [drillFilterInt,  setDrillFilterInt]  = useState('');

    const categories = ['Sub-7', 'Sub-9', 'Sub-11', 'Sub-13', 'Sub-15', 'Sub-17', 'Sub-20', 'Profissional'];

    useEffect(() => {
        loadInitialData();
    }, [id]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [athletesData, drillsData, drillCatsData] = await Promise.all([
                athleteService.getAll(),
                drillService.getAll(),
                drillService.getCategories(),
            ]);
            setAthletes(athletesData.filter(a => a.status === 'active'));
            setAllDrills(drillsData);
            setDrillCategories(drillCatsData);

            if (id) {
                const [trainingData, participantsData, activitiesData, trainingDrillsData] = await Promise.all([
                    trainingService.getById(id),
                    trainingParticipantService.getByTraining(id),
                    trainingActivityService.getByTraining(id),
                    drillService.getByTraining(id),
                ]);
                setTraining(trainingData);
                setParticipants(participantsData);
                setActivities(activitiesData);
                setSelectedDrillIds(trainingDrillsData.map(td => td.drill_id));
            }
        } catch (err) {
            setError(t('trainingForm.error.loading'));
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
            setError(t('trainingForm.error.selectDate'));
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
                    tactical_board: a.tactical_board || null,
                }));
                await trainingActivityService.upsertMany(trainingId, activitiesToSave);
                await drillService.attachToTraining(trainingId, selectedDrillIds);
            }

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            setError(t('trainingForm.error.saving'));
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
        { id: 'general' as TabType, label: t('trainingForm.tab.general'), icon: Calendar },
        { id: 'athletes' as TabType, label: t('trainingForm.tab.athletes'), icon: Users },
        { id: 'activities' as TabType, label: t('trainingForm.tab.activities'), icon: ListChecks },
        { id: 'drills' as TabType, label: t('trainingForm.tab.drills'), icon: BookOpen },
    ];

    const toggleDrill = (drillId: string) => {
        setSelectedDrillIds(prev =>
            prev.includes(drillId) ? prev.filter(id => id !== drillId) : [...prev, drillId]
        );
    };

    const filteredDrills = allDrills.filter(d => {
        if (drillFilterCat && d.category_id !== drillFilterCat) return false;
        if (drillFilterInt && d.intensity  !== drillFilterInt)  return false;
        if (drillSearch) {
            const q = drillSearch.toLowerCase();
            return d.name.toLowerCase().includes(q)
                || (d.tags ?? []).some(t => t.toLowerCase().includes(q));
        }
        return true;
    });

    const getPhaseLabel = (phase?: string) => {
        const phaseKeyMap: Record<string, string> = { warmup: 'training.phase.warmup', main: 'training.phase.main', cooldown: 'training.phase.cooldown', tactical: 'training.phase.tactical', physical: 'training.phase.physical', technical: 'training.phase.technical' };
        return phase && phaseKeyMap[phase] ? t(phaseKeyMap[phase]) : phase;
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
                        <h1 className="text-2xl font-bold text-slate-800">{isEditing ? t('trainingForm.editTitle') : t('trainingForm.newTitle')}</h1>
                        <p className="text-sm text-slate-500">{isEditing ? t('trainingForm.editSubtitle') : t('trainingForm.newSubtitle')}</p>
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
                    <p className="text-sm text-green-700 font-medium">Treino salvo com sucesso!</p>
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
                            {t('trainingForm.section.dateTime')}
                        </h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('trainingForm.field.date')} *</label>
                                    <input type="date" value={training.training_date || ''} onChange={(e) => updateTraining('training_date', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('trainingForm.field.startTime')}</label>
                                    <input type="time" value={training.training_time || ''} onChange={(e) => updateTraining('training_time', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('trainingForm.field.endTime')}</label>
                                    <input type="time" value={training.end_time || ''} onChange={(e) => updateTraining('end_time', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('trainingForm.field.location')}</label>
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
                            {t('trainingForm.section.details')}
                        </h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('trainingForm.field.category')}</label>
                                    <select value={training.category || ''} onChange={(e) => updateTraining('category', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                                        <option value="">{t('trainingForm.field.select')}</option>
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('trainingForm.field.intensity')}</label>
                                    <select value={training.intensity || 'medium'} onChange={(e) => updateTraining('intensity', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                                        {trainingIntensities.map(i => { const intensityKey: Record<string,string> = { low: 'training.intensity.low', medium: 'training.intensity.medium', high: 'training.intensity.high', recovery: 'training.intensity.recovery' }; return <option key={i.value} value={i.value}>{t(intensityKey[i.value]) || i.label}</option>; })}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('trainingForm.field.focus')}</label>
                                <input type="text" value={training.focus || ''} onChange={(e) => updateTraining('focus', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="Ex: Tático, Físico, Finalização" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('trainingForm.field.status')}</label>
                                <select value={training.status || 'scheduled'} onChange={(e) => updateTraining('status', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                                    {trainingStatuses.map(s => { const statusKey: Record<string,string> = { scheduled: 'training.status.scheduled', in_progress: 'training.status.inProgress', completed: 'training.status.completed', cancelled: 'training.status.cancelled' }; return <option key={s.value} value={s.value}>{t(statusKey[s.value]) || s.label}</option>; })}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:col-span-2">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">{t('trainingForm.section.description')}</h3>
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
                                {t('trainingForm.athletes.add')}
                            </h3>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <div className="flex items-center gap-2">
                                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                                    <option value="">{t('trainingForm.athletes.selectCategory')}</option>
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <button onClick={() => selectedCategory && addParticipantsByCategory(selectedCategory)} disabled={!selectedCategory} className="px-4 py-2 bg-primary text-white font-semibold text-sm rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed">
                                    {t('trainingForm.athletes.addCategory')}
                                </button>
                            </div>

                            <div className="h-8 w-px bg-slate-200" />

                            <button onClick={() => setShowAthleteSelector(!showAthleteSelector)} className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-200">
                                {showAthleteSelector ? t('common.close') || 'Fechar' : t('trainingForm.athletes.addIndividual')}
                            </button>
                        </div>

                        {showAthleteSelector && (
                            <div className="mt-4 p-4 bg-slate-50 rounded-lg max-h-48 sm:max-h-60 overflow-y-auto">
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
                                    <p className="text-center text-slate-400 py-4">{t('trainingForm.athletes.allAdded')}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Participants List */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-800">{t('trainingForm.athletes.attendanceList')} ({participants.length})</h3>
                        </div>

                        {participants.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p className="font-medium">{t('trainingForm.athletes.noAdded')}</p>
                                <p className="text-sm">{t('trainingForm.athletes.useOptions')}</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                                            <th className="px-4 py-3 text-left font-bold">{t('athletes.athlete')}</th>
                                            <th className="px-3 py-3 text-center font-bold w-20">{t('trainingForm.athletes.col.present')}</th>
                                            <th className="hidden sm:table-cell px-3 py-3 text-center font-bold w-32">{t('trainingForm.athletes.col.performance')}</th>
                                            <th className="hidden sm:table-cell px-3 py-3 text-center font-bold w-32">{t('trainingForm.athletes.col.effort')}</th>
                                            <th className="hidden md:table-cell px-3 py-3 text-left font-bold w-48">{t('athleteForm.wardrobe.notes')}</th>
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
                                                <td className="hidden sm:table-cell px-3 py-3">
                                                    <select
                                                        value={participant.performance_rating || ''}
                                                        onChange={(e) => updateParticipant(index, 'performance_rating', e.target.value ? parseInt(e.target.value) : undefined)}
                                                        className="w-full px-2 py-1.5 bg-blue-50 border border-blue-200 rounded text-sm text-center"
                                                    >
                                                        <option value="">—</option>
                                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}</option>)}
                                                    </select>
                                                </td>
                                                <td className="hidden sm:table-cell px-3 py-3">
                                                    <select
                                                        value={participant.effort_rating || ''}
                                                        onChange={(e) => updateParticipant(index, 'effort_rating', e.target.value ? parseInt(e.target.value) : undefined)}
                                                        className="w-full px-2 py-1.5 bg-orange-50 border border-orange-200 rounded text-sm text-center"
                                                    >
                                                        <option value="">—</option>
                                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}</option>)}
                                                    </select>
                                                </td>
                                                <td className="hidden md:table-cell px-3 py-3">
                                                    <input
                                                        type="text"
                                                        value={participant.notes || ''}
                                                        onChange={(e) => updateParticipant(index, 'notes', e.target.value)}
                                                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm"
                                                        placeholder={t('trainingForm.athletes.observationsPlaceholder')}
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

            {/* Tactical Board Modal */}
            {tacticalBoardIdx !== null && (
                <TacticalBoardModal
                    activityName={activities[tacticalBoardIdx]?.activity_name || `Atividade ${tacticalBoardIdx + 1}`}
                    participants={participants as any[]}
                    initialData={activities[tacticalBoardIdx]?.tactical_board}
                    onSave={(data: string) => {
                        updateActivity(tacticalBoardIdx, 'tactical_board', data);
                        setTacticalBoardIdx(null);
                    }}
                    onClose={() => setTacticalBoardIdx(null)}
                />
            )}

            {/* Activities Tab */}
            {activeTab === 'activities' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <ListChecks className="w-5 h-5 text-primary" />
                                {t('trainingForm.activities.title')}
                            </h3>
                            <button onClick={addActivity} className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-semibold text-sm rounded-lg hover:bg-primary-dark">
                                <Plus className="w-4 h-4" />
                                {t('trainingForm.activities.add')}
                            </button>
                        </div>

                        {activities.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                <ListChecks className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p className="font-medium">{t('trainingForm.activities.none')}</p>
                                <p className="text-sm mb-4">{t('trainingForm.activities.noneDesc')}</p>
                                <button onClick={addActivity} className="px-4 py-2 bg-primary text-white font-semibold text-sm rounded-lg hover:bg-primary-dark">
                                    {t('trainingForm.activities.addFirst')}
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
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('trainingForm.activities.field.phase')}</label>
                                                <select
                                                    value={activity.phase || 'main'}
                                                    onChange={(e) => updateActivity(index, 'phase', e.target.value)}
                                                    className={`w-full px-3 py-2 rounded-lg text-sm font-semibold ${getPhaseColor(activity.phase)}`}
                                                >
                                                    {trainingPhases.map(p => { const phaseKey2: Record<string,string> = { warmup: 'training.phase.warmup', main: 'training.phase.main', cooldown: 'training.phase.cooldown', tactical: 'training.phase.tactical', physical: 'training.phase.physical', technical: 'training.phase.technical' }; return <option key={p.value} value={p.value}>{t(phaseKey2[p.value]) || p.label}</option>; })}
                                                </select>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('trainingForm.activities.field.name')}</label>
                                                <input
                                                    type="text"
                                                    value={activity.activity_name || ''}
                                                    onChange={(e) => updateActivity(index, 'activity_name', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                                    placeholder="Ex: Rondo 4x2, Corrida intervalada..."
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('trainingForm.activities.field.duration')}</label>
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
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('trainingForm.activities.field.description')}</label>
                                                <input
                                                    type="text"
                                                    value={activity.description || ''}
                                                    onChange={(e) => updateActivity(index, 'description', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                                    placeholder="Detalhes sobre a atividade..."
                                                />
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-center gap-2">
                                            <button
                                                onClick={() => hasFeature('tactical') ? setTacticalBoardIdx(index) : navigate('/subscription')}
                                                title={hasFeature('tactical') ? 'Mesa Tática' : 'Mesa Tática — disponível no plano Pro'}
                                                className={`p-2 rounded-lg transition-colors ${!hasFeature('tactical') ? 'text-slate-300 cursor-not-allowed' : activity.tactical_board ? 'text-green-700 bg-green-100 hover:bg-green-200' : 'text-green-600 hover:bg-green-50'}`}
                                            >
                                                <svg viewBox="0 0 20 13" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                                                    {/* field boundary */}
                                                    <rect x="1" y="1" width="18" height="11" rx="0.5" />
                                                    {/* center line */}
                                                    <line x1="10" y1="1" x2="10" y2="12" />
                                                    {/* center circle */}
                                                    <circle cx="10" cy="6.5" r="2.2" />
                                                    {/* left penalty area */}
                                                    <rect x="1" y="3.5" width="3.5" height="6" />
                                                    {/* right penalty area */}
                                                    <rect x="15.5" y="3.5" width="3.5" height="6" />
                                                    {/* left goal */}
                                                    <rect x="1" y="5" width="1.2" height="3" />
                                                    {/* right goal */}
                                                    <rect x="17.8" y="5" width="1.2" height="3" />
                                                </svg>
                                            </button>
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
                                    <strong>{t('trainingForm.activities.totalTime')}:</strong> {activities.reduce((sum, a) => sum + (a.duration_minutes || 0), 0)} {t('trainingForm.activities.minutes')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Drills tab ── */}
            {activeTab === 'drills' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
                    <div className="flex flex-wrap gap-3">
                        <div className="relative flex-1 min-w-48">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                            <input value={drillSearch} onChange={e => setDrillSearch(e.target.value)}
                                placeholder={t('trainingForm.drills.search')}
                                className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm w-full"/>
                        </div>
                        <select value={drillFilterCat} onChange={e => setDrillFilterCat(e.target.value)}
                            className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                            <option value="">{t('trainingForm.drills.allCategories')}</option>
                            {drillCategories.map(c => <option key={c.id} value={c.id!}>{c.name}</option>)}
                        </select>
                        <select value={drillFilterInt} onChange={e => setDrillFilterInt(e.target.value)}
                            className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                            <option value="">{t('trainingForm.drills.allIntensities')}</option>
                            {Object.entries(INTENSITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                    </div>

                    {selectedDrillIds.length > 0 && (
                        <p className="text-xs text-indigo-600 font-medium">
                            {selectedDrillIds.length} exercício{selectedDrillIds.length !== 1 ? 's' : ''} selecionado{selectedDrillIds.length !== 1 ? 's' : ''}
                        </p>
                    )}

                    {allDrills.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <BookOpen className="w-10 h-10 mb-2 opacity-30"/>
                            <p className="text-sm">{t('trainingForm.drills.empty')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredDrills.map(drill => {
                                const selected = selectedDrillIds.includes(drill.id!);
                                const catColor = drill.category?.color ?? '#6366f1';
                                return (
                                    <button key={drill.id} onClick={() => toggleDrill(drill.id!)}
                                        className={`text-left rounded-xl border-2 p-4 transition-all ${selected
                                            ? 'border-indigo-500 bg-indigo-50'
                                            : 'border-slate-200 hover:border-slate-300 bg-white'
                                        }`}>
                                        <div className="flex items-start gap-2 mb-2">
                                            {drill.category && (
                                                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: catColor }}/>
                                            )}
                                            <p className="font-semibold text-sm text-slate-800 leading-tight">{drill.name}</p>
                                            {selected && (
                                                <span className="ml-auto shrink-0 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {drill.intensity && (
                                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${INTENSITY_COLORS[drill.intensity]}`}>
                                                    <Zap className="w-2.5 h-2.5 inline mr-0.5"/>{INTENSITY_LABELS[drill.intensity]}
                                                </span>
                                            )}
                                            {drill.duration_minutes && (
                                                <span className="text-xs text-slate-400">{drill.duration_minutes}min</span>
                                            )}
                                            {drill.category && (
                                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: catColor + '20', color: catColor }}>
                                                    {drill.category.name}
                                                </span>
                                            )}
                                        </div>
                                        {drill.tags && drill.tags.length > 0 && (
                                            <div className="mt-1.5 flex flex-wrap gap-1">
                                                {drill.tags.slice(0, 3).map((tag, i) => (
                                                    <span key={i} className="text-xs text-slate-400">#{tag}</span>
                                                ))}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TrainingForm;
