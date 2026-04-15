import React, { useEffect, useState } from 'react';
import { adminPlanService, StripePlan, PlanLanguage, PlanI18nRecord, PlanFeaturesI18nRecord } from '../../services/adminPlanService';
import { stripeConfig } from '../../lib/stripe';
import {
    Search, Loader2, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
    CreditCard, Star, X, AlertTriangle, Check, Users, UserCheck, Infinity, Globe
} from 'lucide-react';

const INTERVAL_LABELS: Record<string, string> = {
    monthly: 'Mensal',
    quarterly: 'Trimestral',
    yearly: 'Anual',
    lifetime: 'Vitalício',
};

const LANGUAGES: { code: PlanLanguage; label: string; flag: string }[] = [
    { code: 'pt-BR', label: 'PT Brasil', flag: '🇧🇷' },
    { code: 'pt-PT', label: 'PT Portugal', flag: '🇵🇹' },
    { code: 'en-US', label: 'English', flag: '🇺🇸' },
    { code: 'es-ES', label: 'Español', flag: '🇪🇸' },
    { code: 'fr-FR', label: 'Français', flag: '🇫🇷' },
];

// Per-language fields
interface LangFields {
    name: string;
    description: string;
    features: string[];
    features_school: string[];
    features_club: string[];
}

type LangFormData = Record<PlanLanguage, LangFields>;

interface PlanFormData {
    // Language-specific
    langs: LangFormData;
    // Non-language
    stripe_price_id_test: string;
    stripe_price_id_live: string;
    interval: 'monthly' | 'quarterly' | 'yearly' | 'lifetime';
    price: string;
    currency: string;
    is_active: boolean;
    sort_order: string;
    is_popular: boolean;
    max_users: string;
    max_athletes: string;
    unlimited_users: boolean;
    unlimited_athletes: boolean;
}

const emptyLangFields = (): LangFields => ({
    name: '',
    description: '',
    features: [''],
    features_school: [''],
    features_club: [''],
});

const emptyLangFormData = (): LangFormData => ({
    'pt-BR': emptyLangFields(),
    'pt-PT': emptyLangFields(),
    'en-US': emptyLangFields(),
    'es-ES': emptyLangFields(),
    'fr-FR': emptyLangFields(),
});

const emptyForm: PlanFormData = {
    langs: emptyLangFormData(),
    stripe_price_id_test: '',
    stripe_price_id_live: '',
    interval: 'monthly',
    price: '',
    currency: 'brl',
    is_active: true,
    sort_order: '0',
    is_popular: false,
    max_users: '',
    max_athletes: '',
    unlimited_users: true,
    unlimited_athletes: true,
};

const parseJsonArray = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch { return []; }
};

const parseJsonObj = (val: any): Record<string, any> => {
    if (!val) return {};
    if (typeof val === 'object' && !Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch { return {}; }
};

const AdminPlans: React.FC = () => {
    const [plans, setPlans] = useState<StripePlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingPlan, setEditingPlan] = useState<StripePlan | null>(null);
    const [form, setForm] = useState<PlanFormData>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [activeLang, setActiveLang] = useState<PlanLanguage>('pt-BR');

    useEffect(() => {
        loadPlans();
    }, []);

    const loadPlans = async () => {
        try {
            setLoading(true);
            const data = await adminPlanService.getAllPlans();
            setPlans(data);
        } catch (err: any) {
            console.error('Error loading plans:', err);
            setError('Erro ao carregar planos.');
        } finally {
            setLoading(false);
        }
    };

    const filteredPlans = plans.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        INTERVAL_LABELS[p.interval]?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const openCreateModal = () => {
        setEditingPlan(null);
        setForm(emptyForm);
        setActiveLang('pt-BR');
        setShowModal(true);
    };

    const openEditModal = (plan: StripePlan) => {
        setEditingPlan(plan);
        setActiveLang('pt-BR');

        const nameI18n = parseJsonObj(plan.name_i18n);
        const descI18n = parseJsonObj(plan.description_i18n);
        const featI18n = parseJsonObj(plan.features_i18n);
        const featSchoolI18n = parseJsonObj(plan.features_school_i18n);
        const featClubI18n = parseJsonObj(plan.features_club_i18n);

        // Legacy fallbacks for pt-BR
        const legacyFeatures = (() => { const f = parseJsonArray(plan.features); return f.length > 0 ? f : ['']; })();
        const legacySchool = (() => { const f = parseJsonArray(plan.features_school); return f.length > 0 ? f : ['']; })();
        const legacyClub = (() => { const f = parseJsonArray(plan.features_club); return f.length > 0 ? f : ['']; })();

        const buildLangFields = (lang: PlanLanguage): LangFields => {
            const isPtBr = lang === 'pt-BR';
            const featArr = parseJsonArray(featI18n[lang]);
            const schoolArr = parseJsonArray(featSchoolI18n[lang]);
            const clubArr = parseJsonArray(featClubI18n[lang]);
            return {
                name: nameI18n[lang] || (isPtBr ? plan.name : ''),
                description: descI18n[lang] || (isPtBr ? (plan.description || '') : ''),
                features: featArr.length > 0 ? featArr : (isPtBr ? legacyFeatures : ['']),
                features_school: schoolArr.length > 0 ? schoolArr : (isPtBr ? legacySchool : ['']),
                features_club: clubArr.length > 0 ? clubArr : (isPtBr ? legacyClub : ['']),
            };
        };

        const langs: LangFormData = {
            'pt-BR': buildLangFields('pt-BR'),
            'pt-PT': buildLangFields('pt-PT'),
            'en-US': buildLangFields('en-US'),
            'es-ES': buildLangFields('es-ES'),
            'fr-FR': buildLangFields('fr-FR'),
        };

        setForm({
            langs,
            stripe_price_id_test: plan.stripe_price_id_test || '',
            stripe_price_id_live: plan.stripe_price_id_live || '',
            interval: plan.interval,
            price: plan.price.toString(),
            currency: plan.currency || 'brl',
            is_active: plan.is_active,
            sort_order: (plan.sort_order || 0).toString(),
            is_popular: plan.is_popular || false,
            max_users: plan.max_users !== null && plan.max_users !== undefined ? plan.max_users.toString() : '',
            max_athletes: plan.max_athletes !== null && plan.max_athletes !== undefined ? plan.max_athletes.toString() : '',
            unlimited_users: plan.max_users === null || plan.max_users === undefined,
            unlimited_athletes: plan.max_athletes === null || plan.max_athletes === undefined,
        });
        setShowModal(true);
    };

    const updateLangField = <K extends keyof LangFields>(lang: PlanLanguage, field: K, value: LangFields[K]) => {
        setForm(prev => ({
            ...prev,
            langs: {
                ...prev.langs,
                [lang]: { ...prev.langs[lang], [field]: value },
            },
        }));
    };

    const updateFeatureInLang = (lang: PlanLanguage, field: 'features' | 'features_school' | 'features_club', index: number, value: string) => {
        setForm(prev => {
            const arr = [...prev.langs[lang][field]];
            arr[index] = value;
            return { ...prev, langs: { ...prev.langs, [lang]: { ...prev.langs[lang], [field]: arr } } };
        });
    };

    const addFeatureInLang = (lang: PlanLanguage, field: 'features' | 'features_school' | 'features_club') => {
        setForm(prev => ({
            ...prev,
            langs: { ...prev.langs, [lang]: { ...prev.langs[lang], [field]: [...prev.langs[lang][field], ''] } },
        }));
    };

    const removeFeatureInLang = (lang: PlanLanguage, field: 'features' | 'features_school' | 'features_club', index: number) => {
        setForm(prev => ({
            ...prev,
            langs: { ...prev.langs, [lang]: { ...prev.langs[lang], [field]: prev.langs[lang][field].filter((_, i) => i !== index) } },
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            // Build i18n objects
            const nameI18n: PlanI18nRecord = {};
            const descI18n: PlanI18nRecord = {};
            const featI18n: PlanFeaturesI18nRecord = {};
            const featSchoolI18n: PlanFeaturesI18nRecord = {};
            const featClubI18n: PlanFeaturesI18nRecord = {};

            LANGUAGES.forEach(({ code }) => {
                const l = form.langs[code];
                if (l.name.trim()) nameI18n[code] = l.name.trim();
                if (l.description.trim()) descI18n[code] = l.description.trim();
                const feats = l.features.filter(f => f.trim() !== '');
                if (feats.length > 0) featI18n[code] = feats;
                const school = l.features_school.filter(f => f.trim() !== '');
                if (school.length > 0) featSchoolI18n[code] = school;
                const club = l.features_club.filter(f => f.trim() !== '');
                if (club.length > 0) featClubI18n[code] = club;
            });

            // pt-BR is canonical for legacy fields
            const ptBr = form.langs['pt-BR'];

            const planData = {
                name: ptBr.name || form.langs['en-US'].name || 'Plano',
                description: ptBr.description || null,
                stripe_price_id_test: form.stripe_price_id_test || null,
                stripe_price_id_live: form.stripe_price_id_live || null,
                interval: form.interval,
                price: parseFloat(form.price) || 0,
                currency: form.currency,
                is_active: form.is_active,
                features: ptBr.features.filter(f => f.trim() !== ''),
                features_school: ptBr.features_school.filter(f => f.trim() !== ''),
                features_club: ptBr.features_club.filter(f => f.trim() !== ''),
                sort_order: parseInt(form.sort_order) || 0,
                is_popular: form.is_popular,
                max_users: form.unlimited_users ? null : (parseInt(form.max_users) || 1),
                max_athletes: form.unlimited_athletes ? null : (parseInt(form.max_athletes) || 1),
                name_i18n: nameI18n,
                description_i18n: descI18n,
                features_i18n: featI18n,
                features_school_i18n: featSchoolI18n,
                features_club_i18n: featClubI18n,
            };

            if (editingPlan?.id) {
                await adminPlanService.updatePlan(editingPlan.id, planData);
            } else {
                await adminPlanService.createPlan(planData);
            }

            setShowModal(false);
            await loadPlans();
        } catch (err: any) {
            console.error('Error saving plan:', err);
            setError(err.message || 'Erro ao salvar plano.');
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (plan: StripePlan) => {
        try {
            await adminPlanService.togglePlanActive(plan.id!, !plan.is_active);
            await loadPlans();
        } catch (err: any) {
            console.error('Error toggling plan:', err);
            setError('Erro ao alterar status do plano.');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await adminPlanService.deletePlan(id);
            setDeleteConfirm(null);
            await loadPlans();
        } catch (err: any) {
            console.error('Error deleting plan:', err);
            setError('Erro ao excluir plano.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    const currentLangData = form.langs[activeLang];

    return (
        <div className="space-y-6">
            {/* Environment Badge */}
            <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-800">Planos Stripe</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${stripeConfig.isProduction
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                    }`}>
                    {stripeConfig.isProduction ? '🔴 Produção' : '🟡 Modo Teste'}
                </span>
            </div>

            {error && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Main Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou tipo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full sm:w-64"
                        />
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Plano
                    </button>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Ordem</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Plano</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Intervalo</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Preço</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Limites</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Stripe Price ID</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {filteredPlans.map((plan) => {
                                const currentPriceId = stripeConfig.getPriceId(plan);
                                return (
                                    <tr key={plan.id} className={`hover:bg-slate-50 transition-colors ${!plan.is_active ? 'opacity-50' : ''}`}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            {plan.sort_order}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="font-medium text-slate-900">{plan.name}</div>
                                                {plan.is_popular && (
                                                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                                )}
                                            </div>
                                            {plan.description && (
                                                <div className="text-xs text-slate-500 mt-0.5 max-w-xs truncate">{plan.description}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                                                {INTERVAL_LABELS[plan.interval] || plan.interval}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-800">
                                            R$ {Number(plan.price).toFixed(2).replace('.', ',')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-xs space-y-0.5">
                                                <div className="flex items-center gap-1 text-slate-600">
                                                    <Users className="w-3 h-3" />
                                                    {plan.max_users === null || plan.max_users === undefined ? (
                                                        <span className="flex items-center gap-0.5"><Infinity className="w-3 h-3" /> Ilimitado</span>
                                                    ) : (
                                                        <span>{plan.max_users} usuários</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 text-slate-600">
                                                    <UserCheck className="w-3 h-3" />
                                                    {plan.max_athletes === null || plan.max_athletes === undefined ? (
                                                        <span className="flex items-center gap-0.5"><Infinity className="w-3 h-3" /> Ilimitado</span>
                                                    ) : (
                                                        <span>{plan.max_athletes} atletas</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {currentPriceId ? (
                                                <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono text-slate-600">
                                                    {currentPriceId.substring(0, 20)}...
                                                </code>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Não configurado</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button
                                                onClick={() => handleToggle(plan)}
                                                className="flex items-center gap-1.5 text-sm"
                                                title={plan.is_active ? 'Desativar plano' : 'Ativar plano'}
                                            >
                                                {plan.is_active ? (
                                                    <>
                                                        <ToggleRight className="w-6 h-6 text-green-500" />
                                                        <span className="text-green-700 font-semibold text-xs">Ativo</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <ToggleLeft className="w-6 h-6 text-slate-400" />
                                                        <span className="text-slate-500 font-semibold text-xs">Inativo</span>
                                                    </>
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => openEditModal(plan)}
                                                    className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 transition-colors"
                                                    title="Editar"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                {deleteConfirm === plan.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleDelete(plan.id!)}
                                                            className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                                            title="Confirmar exclusão"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm(null)}
                                                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                                                            title="Cancelar"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setDeleteConfirm(plan.id!)}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {filteredPlans.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center">
                                        <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-slate-500 font-medium">Nenhum plano cadastrado.</p>
                                        <p className="text-sm text-slate-400 mt-1">Clique em "Novo Plano" para criar o primeiro.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
                            <h3 className="text-lg font-bold text-slate-800">
                                {editingPlan ? 'Editar Plano' : 'Novo Plano'}
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">

                            {/* ── Language Tabs Section ── */}
                            <div className="rounded-xl border border-indigo-100 overflow-hidden">
                                {/* Tab Bar */}
                                <div className="flex items-center bg-indigo-50 border-b border-indigo-100 overflow-x-auto">
                                    <div className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-indigo-600 whitespace-nowrap border-r border-indigo-100 flex-shrink-0">
                                        <Globe className="w-3.5 h-3.5" />
                                        Idioma
                                    </div>
                                    {LANGUAGES.map(({ code, label, flag }) => (
                                        <button
                                            key={code}
                                            type="button"
                                            onClick={() => setActiveLang(code)}
                                            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap flex-shrink-0 border-b-2 ${
                                                activeLang === code
                                                    ? 'bg-white text-indigo-700 border-indigo-500'
                                                    : 'text-slate-500 hover:text-slate-700 hover:bg-indigo-100/50 border-transparent'
                                            }`}
                                        >
                                            <span>{flag}</span>
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                {/* Tab Content */}
                                <div className="p-4 space-y-4 bg-white">
                                    {/* Nome */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                                            Nome do Plano {activeLang === 'pt-BR' && <span className="text-red-500">*</span>}
                                        </label>
                                        <input
                                            type="text"
                                            required={activeLang === 'pt-BR'}
                                            value={currentLangData.name}
                                            onChange={(e) => updateLangField(activeLang, 'name', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="Ex: Plano Básico"
                                        />
                                    </div>

                                    {/* Descrição */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                                            Descrição
                                        </label>
                                        <textarea
                                            value={currentLangData.description}
                                            onChange={(e) => updateLangField(activeLang, 'description', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                            rows={2}
                                            placeholder="Descrição curta do plano..."
                                        />
                                    </div>

                                    {/* Features */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Features (recursos inclusos)
                                        </label>
                                        <div className="space-y-2">
                                            {currentLangData.features.map((feature, i) => (
                                                <div key={i} className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={feature}
                                                        onChange={(e) => updateFeatureInLang(activeLang, 'features', i, e.target.value)}
                                                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        placeholder={`Feature ${i + 1}...`}
                                                    />
                                                    {currentLangData.features.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeFeatureInLang(activeLang, 'features', i)}
                                                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => addFeatureInLang(activeLang, 'features')}
                                            className="mt-2 text-sm text-indigo-600 font-semibold hover:text-indigo-700 flex items-center gap-1"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Adicionar feature
                                        </button>
                                    </div>

                                    {/* Features School */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            🎓 Funcionalidades Escolinha
                                        </label>
                                        <div className="space-y-2">
                                            {currentLangData.features_school.map((feature, i) => (
                                                <div key={i} className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={feature}
                                                        onChange={(e) => updateFeatureInLang(activeLang, 'features_school', i, e.target.value)}
                                                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        placeholder={`Feature escolinha ${i + 1}...`}
                                                    />
                                                    {currentLangData.features_school.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeFeatureInLang(activeLang, 'features_school', i)}
                                                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => addFeatureInLang(activeLang, 'features_school')}
                                            className="mt-2 text-sm text-indigo-600 font-semibold hover:text-indigo-700 flex items-center gap-1"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Adicionar feature escolinha
                                        </button>
                                    </div>

                                    {/* Features Club */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            🛡️ Funcionalidades Clube
                                        </label>
                                        <div className="space-y-2">
                                            {currentLangData.features_club.map((feature, i) => (
                                                <div key={i} className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={feature}
                                                        onChange={(e) => updateFeatureInLang(activeLang, 'features_club', i, e.target.value)}
                                                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        placeholder={`Feature clube ${i + 1}...`}
                                                    />
                                                    {currentLangData.features_club.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeFeatureInLang(activeLang, 'features_club', i)}
                                                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => addFeatureInLang(activeLang, 'features_club')}
                                            className="mt-2 text-sm text-indigo-600 font-semibold hover:text-indigo-700 flex items-center gap-1"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Adicionar feature clube
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* ── Non-language fields ── */}

                            {/* Preço, Moeda, Ordem e Intervalo */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                                        Preço (R$) *
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        step="0.01"
                                        min="0"
                                        value={form.price}
                                        onChange={(e) => setForm(prev => ({ ...prev, price: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="49.90"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                                        Moeda
                                    </label>
                                    <select
                                        value={form.currency}
                                        onChange={(e) => setForm(prev => ({ ...prev, currency: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                    >
                                        <option value="brl">BRL (R$)</option>
                                        <option value="usd">USD ($)</option>
                                        <option value="eur">EUR (€)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                                        Intervalo *
                                    </label>
                                    <select
                                        value={form.interval}
                                        onChange={(e) => setForm(prev => ({ ...prev, interval: e.target.value as any }))}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                    >
                                        <option value="monthly">Mensal</option>
                                        <option value="quarterly">Trimestral</option>
                                        <option value="yearly">Anual</option>
                                        <option value="lifetime">Vitalício</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                                        Ordem
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.sort_order}
                                        onChange={(e) => setForm(prev => ({ ...prev, sort_order: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Stripe Price IDs */}
                            <div className="p-4 bg-slate-50 rounded-xl space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <CreditCard className="w-4 h-4 text-slate-500" />
                                    <span className="text-sm font-bold text-slate-700">Stripe Price IDs</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-amber-700 mb-1">
                                            🟡 Teste (test mode)
                                        </label>
                                        <input
                                            type="text"
                                            value={form.stripe_price_id_test}
                                            onChange={(e) => setForm(prev => ({ ...prev, stripe_price_id_test: e.target.value }))}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                                            placeholder="price_test_..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-green-700 mb-1">
                                            🟢 Produção (live mode)
                                        </label>
                                        <input
                                            type="text"
                                            value={form.stripe_price_id_live}
                                            onChange={(e) => setForm(prev => ({ ...prev, stripe_price_id_live: e.target.value }))}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                                            placeholder="price_live_..."
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500">
                                    Em localhost usa o Price ID de teste. Em produção usa o de produção automaticamente.
                                </p>
                            </div>

                            {/* Limites do Plano */}
                            <div className="p-4 bg-slate-50 rounded-xl space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Users className="w-4 h-4 text-slate-500" />
                                    <span className="text-sm font-bold text-slate-700">Limites do Plano</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                                            Máx. Usuários
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min="1"
                                                value={form.max_users}
                                                onChange={(e) => setForm(prev => ({ ...prev, max_users: e.target.value }))}
                                                disabled={form.unlimited_users}
                                                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                                                placeholder="Ex: 5"
                                            />
                                            <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                                                <input
                                                    type="checkbox"
                                                    checked={form.unlimited_users}
                                                    onChange={(e) => setForm(prev => ({
                                                        ...prev,
                                                        unlimited_users: e.target.checked,
                                                        max_users: e.target.checked ? '' : prev.max_users,
                                                    }))}
                                                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                                />
                                                <Infinity className="w-3.5 h-3.5 text-slate-500" />
                                                <span className="text-xs font-medium text-slate-600">Ilimitado</span>
                                            </label>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                                            Máx. Atletas
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min="1"
                                                value={form.max_athletes}
                                                onChange={(e) => setForm(prev => ({ ...prev, max_athletes: e.target.value }))}
                                                disabled={form.unlimited_athletes}
                                                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                                                placeholder="Ex: 50"
                                            />
                                            <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                                                <input
                                                    type="checkbox"
                                                    checked={form.unlimited_athletes}
                                                    onChange={(e) => setForm(prev => ({
                                                        ...prev,
                                                        unlimited_athletes: e.target.checked,
                                                        max_athletes: e.target.checked ? '' : prev.max_athletes,
                                                    }))}
                                                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                                />
                                                <Infinity className="w-3.5 h-3.5 text-slate-500" />
                                                <span className="text-xs font-medium text-slate-600">Ilimitado</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500">
                                    Defina quantos usuários e atletas cada clube pode cadastrar com este plano. Marque "Ilimitado" para sem restrição.
                                </p>
                            </div>

                            {/* Toggles */}
                            <div className="flex flex-wrap gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.is_active}
                                        onChange={(e) => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
                                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700">Ativo</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.is_popular}
                                        onChange={(e) => setForm(prev => ({ ...prev, is_popular: e.target.checked }))}
                                        className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700">⭐ Destacar como Popular</span>
                                </label>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {editingPlan ? 'Salvar Alterações' : 'Criar Plano'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPlans;
