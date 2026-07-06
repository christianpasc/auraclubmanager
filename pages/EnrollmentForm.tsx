
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    User, FileText, CreditCard, Save, ArrowLeft, Loader2,
    Calendar, DollarSign, Camera, X, Check, Search, UserCheck, ShieldAlert
} from 'lucide-react';
import { enrollmentService, Enrollment } from '../services/enrollmentService';
import { athleteService, Athlete } from '../services/athleteService';
import { storageService } from '../services/storageService';
import { schoolPlanService, SchoolPlan } from '../services/schoolPlanService';
import { useLanguage } from '../contexts/LanguageContext';
import { useTenant } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';
import { isMinorFromBirthDate } from '../lib/age';

const EnrollmentForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEditing = !!id;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const searchRef = useRef<HTMLDivElement>(null);
    const { t } = useLanguage();
    const { currentTenant } = useTenant();
    const { user } = useAuth();

    const planTypes = [
        { value: 'monthly',    label: t('planType.monthly') },
        { value: 'quarterly',  label: t('planType.quarterly') },
        { value: 'semiannual', label: t('planType.semiannual') },
        { value: 'annual',     label: t('planType.annual') },
    ];

    const schoolPlanIntervalLabel = (interval: string): string => {
        const key = interval === 'one_time' ? 'planType.oneTime' : `planType.${interval}`;
        return t(key);
    };

    const paymentMethods: Array<{ value: string; label: string }> = (() => {
        const settings = currentTenant?.settings as any;
        if (settings?.payment_methods && Array.isArray(settings.payment_methods) && settings.payment_methods.length > 0) {
            return settings.payment_methods;
        }
        return [
            { value: 'cash', label: t('paymentMethod.cash') },
            { value: 'card', label: t('paymentMethod.card') },
        ];
    })();

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    // Mode: 'new' = create new athlete, 'existing' = pick existing athlete
    const [mode, setMode] = useState<'new' | 'existing'>('new');

    // Athlete data (for new athlete mode)
    const [athlete, setAthlete] = useState<Partial<Athlete>>({
        full_name: '',
        status: 'active',
    });

    // Existing athlete picker state
    const [allAthletes, setAllAthletes] = useState<Athlete[]>([]);
    const [athleteSearch, setAthleteSearch] = useState('');
    const [selectedExistingAthlete, setSelectedExistingAthlete] = useState<Athlete | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loadingAthletes, setLoadingAthletes] = useState(false);

    // Enrollment data
    const [enrollment, setEnrollment] = useState<Partial<Enrollment>>({
        enrollment_date: new Date().toISOString().split('T')[0],
        status: 'pending',
        plan_type: 'monthly',
        payment_day: 10,
    });

    const categories = ['Sub-7', 'Sub-9', 'Sub-11', 'Sub-13', 'Sub-15', 'Sub-17', 'Sub-20', 'Profissional'];

    const [schoolPlans, setSchoolPlans] = useState<SchoolPlan[]>([]);

    useEffect(() => {
        schoolPlanService.getActive().then(setSchoolPlans).catch(err => console.error(err));
    }, []);

    useEffect(() => {
        if (id) loadEnrollment(id);
    }, [id]);

    // Load athletes list when switching to existing mode
    useEffect(() => {
        if (mode === 'existing' && allAthletes.length === 0) {
            loadAthletes();
        }
    }, [mode]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    const loadAthletes = async () => {
        setLoadingAthletes(true);
        try {
            const data = await athleteService.getAll();
            setAllAthletes(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingAthletes(false);
        }
    };

    const loadEnrollment = async (enrollmentId: string) => {
        setLoading(true);
        try {
            const data = await enrollmentService.getById(enrollmentId);
            setEnrollment(data);
            if (data.athlete) {
                setAthlete(data.athlete);
            }
        } catch (err) {
            setError(t('enrollmentForm.error.loading'));
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handlePhotoUpload = async (file: File) => {
        if (!file) return;
        setUploadingPhoto(true);
        try {
            const tempId = athlete.id || `temp-${Date.now()}`;
            const photoUrl = await storageService.uploadAthletePhoto(file, tempId);
            setAthlete(prev => ({ ...prev, photo_url: photoUrl }));
        } catch (err) {
            setError(t('enrollmentForm.error.photoUpload'));
            console.error(err);
        } finally {
            setUploadingPhoto(false);
        }
    };

    const isMinor = isMinorFromBirthDate(athlete.birth_date);

    const toggleGuardianConsent = (checked: boolean) => {
        setAthlete(prev => ({
            ...prev,
            guardian_consent_given: checked,
            guardian_consent_by: checked ? (user?.id ?? null) : null,
            guardian_consent_at: checked ? new Date().toISOString() : null,
        }));
    };

    const handleSave = async () => {
        // LGPD: registering/updating a minor's data requires documented guardian consent
        if (mode !== 'existing' && isMinor && !athlete.guardian_consent_given) {
            setError(t('athleteForm.error.guardianConsentRequired'));
            return;
        }
        setSaving(true);
        setError(null);

        try {
            if (isEditing && id) {
                if (enrollment.athlete_id) {
                    await athleteService.update(enrollment.athlete_id, athlete);
                }
                await enrollmentService.update(id, enrollment);
            } else if (mode === 'existing') {
                if (!selectedExistingAthlete?.id) {
                    setError('Selecione um atleta para criar a matrícula.');
                    setSaving(false);
                    return;
                }
                await enrollmentService.create({
                    ...enrollment,
                    athlete_id: selectedExistingAthlete.id,
                });
            } else {
                if (!athlete.full_name?.trim()) {
                    setError(t('enrollmentForm.error.nameRequired'));
                    setSaving(false);
                    return;
                }
                await enrollmentService.createWithAthlete(
                    athlete as Athlete,
                    enrollment
                );
            }
            navigate('/enrollments');
        } catch (err) {
            setError(t('enrollmentForm.error.saving'));
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const updateAthlete = (field: keyof Athlete, value: any) => {
        setAthlete(prev => ({ ...prev, [field]: value }));
    };

    const updateEnrollment = (field: keyof Enrollment, value: any) => {
        setEnrollment(prev => ({ ...prev, [field]: value }));
    };

    const filteredAthletes = allAthletes.filter(a =>
        a.full_name?.toLowerCase().includes(athleteSearch.toLowerCase())
    );

    const handleSelectAthlete = (a: Athlete) => {
        setSelectedExistingAthlete(a);
        setAthleteSearch(a.full_name || '');
        setShowDropdown(false);
    };

    const handleClearSelection = () => {
        setSelectedExistingAthlete(null);
        setAthleteSearch('');
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
                    <button onClick={() => navigate('/enrollments')} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{isEditing ? t('enrollmentForm.editTitle') : t('enrollmentForm.newTitle')}</h1>
                        <p className="text-sm text-slate-500">{isEditing ? t('enrollmentForm.editSubtitle') : t('enrollmentForm.newSubtitle')}</p>
                    </div>
                </div>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg shadow-lg shadow-primary/20 transition-all disabled:opacity-50">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {t('common.save')}
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            {/* Mode toggle (only for new enrollments) */}
            {!isEditing && (
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                    <button
                        onClick={() => setMode('new')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'new' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <User className="w-4 h-4" />
                        Novo Atleta
                    </button>
                    <button
                        onClick={() => setMode('existing')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'existing' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <UserCheck className="w-4 h-4" />
                        Atleta Existente
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                    {mode === 'existing' && !isEditing ? (
                        /* Existing athlete picker */
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <UserCheck className="w-5 h-5 text-primary" />
                                Selecionar Atleta
                            </h3>

                            <div ref={searchRef} className="relative">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Buscar atleta *</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={athleteSearch}
                                        onChange={(e) => {
                                            setAthleteSearch(e.target.value);
                                            setSelectedExistingAthlete(null);
                                            setShowDropdown(true);
                                        }}
                                        onFocus={() => setShowDropdown(true)}
                                        placeholder="Digite o nome do atleta..."
                                        className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    />
                                    {athleteSearch && (
                                        <button onClick={handleClearSelection} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {showDropdown && (
                                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                                        {loadingAthletes ? (
                                            <div className="flex items-center justify-center py-6">
                                                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                            </div>
                                        ) : filteredAthletes.length === 0 ? (
                                            <div className="px-4 py-6 text-sm text-slate-400 text-center">Nenhum atleta encontrado</div>
                                        ) : (
                                            filteredAthletes.map(a => (
                                                <button
                                                    key={a.id}
                                                    onMouseDown={() => handleSelectAthlete(a)}
                                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left transition-colors border-b border-slate-100 last:border-0"
                                                >
                                                    {a.photo_url ? (
                                                        <img src={a.photo_url} alt={a.full_name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                                                            <User className="w-4 h-4 text-slate-400" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-800">{a.full_name}</p>
                                                        {a.category && <p className="text-xs text-slate-400">{a.category}</p>}
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Selected athlete card */}
                            {selectedExistingAthlete && (
                                <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-4">
                                    {selectedExistingAthlete.photo_url ? (
                                        <img src={selectedExistingAthlete.photo_url} alt={selectedExistingAthlete.full_name} className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-sm flex-shrink-0" />
                                    ) : (
                                        <div className="w-14 h-14 rounded-xl bg-slate-200 flex items-center justify-center flex-shrink-0">
                                            <User className="w-7 h-7 text-slate-400" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-800">{selectedExistingAthlete.full_name}</p>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            {selectedExistingAthlete.category && <span className="text-xs text-slate-500">{selectedExistingAthlete.category}</span>}
                                            {selectedExistingAthlete.birth_date && <span className="text-xs text-slate-400">{new Date(selectedExistingAthlete.birth_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                                            <Check className="w-3 h-3" /> Selecionado
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* New athlete form */
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <User className="w-5 h-5 text-primary" />
                                {t('enrollmentForm.section.athleteData')}
                            </h3>

                            <div className="flex items-start gap-6 mb-6">
                                {/* Photo */}
                                <div className="flex-shrink-0">
                                    <div className="relative">
                                        {athlete.photo_url ? (
                                            <div className="relative w-24 h-24">
                                                <img src={athlete.photo_url} alt={t('athleteForm.photo')} className="w-24 h-24 rounded-xl object-cover border-2 border-slate-200" />
                                                <button type="button" onClick={() => setAthlete(prev => ({ ...prev, photo_url: undefined }))} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 text-xs">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto} className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 hover:border-primary hover:text-primary transition-colors disabled:opacity-50">
                                                {uploadingPhoto ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Camera className="w-6 h-6 mb-1" /><span className="text-[10px] font-medium">{t('athleteForm.addPhoto')}</span></>}
                                            </button>
                                        )}
                                        <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} className="hidden" />
                                    </div>
                                </div>

                                {/* Name and Birth Date */}
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.fullName')} *</label>
                                        <input type="text" value={athlete.full_name || ''} onChange={(e) => updateAthlete('full_name', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder={t('athleteForm.field.fullName')} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.birthDate')}</label>
                                        <input type="date" value={athlete.birth_date || ''} onChange={(e) => updateAthlete('birth_date', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athletes.category')}</label>
                                        <select value={athlete.category || ''} onChange={(e) => updateAthlete('category', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                                            <option value="">{t('trainingForm.field.select')}</option>
                                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athletes.cpf')}</label>
                                    <input type="text" value={athlete.cpf || ''} onChange={(e) => updateAthlete('cpf', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="000.000.000-00" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.phone')}</label>
                                    <input type="tel" value={athlete.phone || ''} onChange={(e) => updateAthlete('phone', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="(00) 00000-0000" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.email')}</label>
                                    <input type="email" value={athlete.email || ''} onChange={(e) => updateAthlete('email', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="atleta@email.com" />
                                </div>
                            </div>

                            {/* Guardian Info */}
                            <div className="mt-6 pt-6 border-t border-slate-100">
                                <h4 className="text-sm font-bold text-slate-700 mb-4">{t('enrollmentForm.field.guardianSection')}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('enrollmentForm.field.guardianName')}</label>
                                        <input type="text" value={athlete.guardian_name || ''} onChange={(e) => updateAthlete('guardian_name', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('enrollmentForm.field.guardianPhone')}</label>
                                        <input type="tel" value={athlete.guardian_phone || ''} onChange={(e) => updateAthlete('guardian_phone', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                                    </div>
                                </div>

                                {/* LGPD: guardian consent required for minors */}
                                {isMinor && (
                                    <div className="mt-4 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                        <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-amber-800">{t('athleteForm.lgpd.minorTitle')}</p>
                                            <p className="text-xs text-amber-600 mt-0.5">{t('athleteForm.lgpd.minorMessage')}</p>
                                            <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={!!athlete.guardian_consent_given}
                                                    onChange={(e) => toggleGuardianConsent(e.target.checked)}
                                                    className="rounded text-primary"
                                                />
                                                <span className="text-xs text-amber-800 font-medium">{t('athleteForm.lgpd.consent')}</span>
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column - Enrollment Data */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary" />
                            {t('enrollmentForm.section.enrollmentData')}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('enrollmentForm.field.enrollmentDate')}</label>
                                <input type="date" value={enrollment.enrollment_date || ''} onChange={(e) => updateEnrollment('enrollment_date', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('enrollmentForm.field.startDate')}</label>
                                <input type="date" value={enrollment.start_date || ''} onChange={(e) => updateEnrollment('start_date', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('common.status')}</label>
                                <select value={enrollment.status || 'pending'} onChange={(e) => updateEnrollment('status', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                                    <option value="pending">{t('enrollments.status.pending')}</option>
                                    <option value="active">{t('enrollments.status.active')}</option>
                                    <option value="cancelled">{t('enrollments.status.cancelled')}</option>
                                    <option value="expired">{t('enrollments.status.expired')}</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-primary" />
                            {t('enrollmentForm.section.payment')}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('enrollmentForm.field.stripePlan')}</label>
                                <select
                                    value={enrollment.school_plan_id || ''}
                                    onChange={(e) => updateEnrollment('school_plan_id', e.target.value || null)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                >
                                    <option value="">{t('enrollmentForm.field.stripePlanNone')}</option>
                                    {schoolPlans.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} — {p.currency || 'EUR'} {p.amount} ({schoolPlanIntervalLabel(p.interval)})
                                        </option>
                                    ))}
                                </select>
                                {enrollment.school_plan_id && (
                                    <p className="text-xs text-slate-400 mt-2">{t('enrollmentForm.field.stripePlanHint')}</p>
                                )}
                            </div>

                            {!enrollment.school_plan_id && (
                                <>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('enrollmentForm.field.planType')}</label>
                                        <select value={enrollment.plan_type || 'monthly'} onChange={(e) => updateEnrollment('plan_type', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                                            {planTypes.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('enrollmentForm.field.monthlyFee')}</label>
                                        <input type="number" step="0.01" value={enrollment.monthly_fee || ''} onChange={(e) => updateEnrollment('monthly_fee', parseFloat(e.target.value) || undefined)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="150.00" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('enrollmentForm.field.paymentDay')}</label>
                                        <select value={enrollment.payment_day || 10} onChange={(e) => updateEnrollment('payment_day', parseInt(e.target.value))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                                            {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('enrollmentForm.field.paymentMethod')}</label>
                                        <select value={enrollment.payment_method || ''} onChange={(e) => updateEnrollment('payment_method', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                                            <option value="">{t('trainingForm.field.select')}</option>
                                            {paymentMethods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                        </select>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h3 className="text-sm font-bold text-slate-700 mb-4">{t('enrollmentForm.contract.title')}</h3>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${enrollment.contract_signed ? 'bg-primary border-primary' : 'border-slate-300'}`}>
                                {enrollment.contract_signed && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <input type="checkbox" checked={enrollment.contract_signed || false} onChange={(e) => updateEnrollment('contract_signed', e.target.checked)} className="hidden" />
                            <span className="text-sm text-slate-700">{t('enrollmentForm.contract.signed')}</span>
                        </label>
                        {enrollment.contract_signed && (
                            <div className="mt-3">
                                <label className="block text-xs text-slate-500 mb-1">{t('enrollmentForm.contract.signatureDate')}</label>
                                <input type="date" value={enrollment.contract_signed_at || ''} onChange={(e) => updateEnrollment('contract_signed_at', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm" />
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('enrollmentForm.notes')}</label>
                        <textarea value={enrollment.notes || ''} onChange={(e) => updateEnrollment('notes', e.target.value)} rows={3} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" placeholder={t('enrollmentForm.notesPlaceholder')} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EnrollmentForm;
