
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Save, Loader2, AlertCircle, Radar,
    User, MapPin, Phone, ClipboardList, Star, UserPlus, ExternalLink, CheckCircle2,
} from 'lucide-react';
import {
    prospectService,
    Prospect, ProspectStatus, ProspectPriority, ProspectSource, ProspectScores,
    FUNNEL_STATUSES, PRIORITY_META, SOURCE_META, FOOTBALL_POSITIONS,
    calcAge, calcOverallScore,
} from '../services/prospectService';
import ProspectEvaluation from '../components/ProspectEvaluation';
import { useLanguage } from '../contexts/LanguageContext';

// ── Section wrapper ───────────────────────────────────────────────────────────

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <span className="text-primary">{icon}</span>
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{title}</h2>
        </div>
        <div className="space-y-4">{children}</div>
    </div>
);

const Label: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required }) => (
    <label className="block text-xs font-semibold text-slate-600 mb-1">
        {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
);

const inputCls  = "w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors";
const selectCls = inputCls + " appearance-none";

// ── Main Form ─────────────────────────────────────────────────────────────────

type Tab = 'data' | 'evaluation';

const ProspectForm: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEdit = !!id && id !== 'new';
    const { t } = useLanguage();

    const [tab, setTab]               = useState<Tab>('data');
    const [saving, setSaving]         = useState(false);
    const [loading, setLoading]       = useState(isEdit);
    const [error, setError]           = useState<string | null>(null);
    const [showConvert, setShowConvert]   = useState(false);
    const [converting, setConverting]     = useState(false);
    const [convertedId, setConvertedId]   = useState<string | null>(null);
    const [convertSuccess, setConvertSuccess] = useState(false);

    const [form, setForm] = useState<Omit<Prospect, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>>({
        full_name:     '',
        birth_date:    '',
        position:      '',
        preferred_foot:'',
        height_cm:     undefined,
        weight_kg:     undefined,
        city:          '',
        state:         '',
        current_club:  '',
        contact_name:  '',
        contact_phone: '',
        contact_email: '',
        source:        'other',
        status:        'observation',
        priority:      'normal',
        video_url:     '',
        notes:         '',
        scores:        {},
    });

    useEffect(() => {
        if (!isEdit) return;
        (async () => {
            try {
                const p = await prospectService.getById(id!);
                setForm({
                    full_name:     p.full_name      ?? '',
                    birth_date:    p.birth_date     ?? '',
                    position:      p.position       ?? '',
                    preferred_foot:p.preferred_foot ?? '',
                    height_cm:     p.height_cm,
                    weight_kg:     p.weight_kg,
                    city:          p.city           ?? '',
                    state:         p.state          ?? '',
                    current_club:  p.current_club   ?? '',
                    contact_name:  p.contact_name   ?? '',
                    contact_phone: p.contact_phone  ?? '',
                    contact_email: p.contact_email  ?? '',
                    source:        p.source         ?? 'other',
                    status:        p.status         ?? 'observation',
                    priority:      p.priority       ?? 'normal',
                    video_url:     p.video_url      ?? '',
                    notes:         p.notes          ?? '',
                    scores:        p.scores         ?? {},
                });
                if (p.converted_athlete_id) setConvertedId(p.converted_athlete_id);
            } catch (err: any) {
                setError(err.message || 'Erro ao carregar prospecto');
            } finally {
                setLoading(false);
            }
        })();
    }, [id, isEdit]);

    const set = (field: keyof typeof form, value: any) =>
        setForm(prev => ({ ...prev, [field]: value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.full_name.trim()) {
            setError(t('prospects.field.fullName') + ' é obrigatório');
            return;
        }
        try {
            setSaving(true);
            setError(null);
            const payload = {
                ...form,
                height_cm:     form.height_cm  ? Number(form.height_cm)  : undefined,
                weight_kg:     form.weight_kg  ? Number(form.weight_kg)  : undefined,
                birth_date:    form.birth_date || undefined,
                video_url:     form.video_url  || undefined,
                overall_score: calcOverallScore(form.scores) ?? undefined,
            };
            if (isEdit) {
                await prospectService.update(id!, payload);
            } else {
                await prospectService.create(payload);
            }
            navigate('/prospects');
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    const handleConvert = async () => {
        try {
            setConverting(true);
            const athleteId = await prospectService.convertToAthlete(id!);
            setConvertedId(athleteId);
            setConvertSuccess(true);
            setShowConvert(false);
        } catch (err: any) {
            setError(err.message || 'Erro ao converter');
            setShowConvert(false);
        } finally {
            setConverting(false);
        }
    };

    const age     = calcAge(form.birth_date);
    const overall = calcOverallScore(form.scores);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/prospects')}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Radar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">
                            {isEdit ? t('prospects.editProspect') : t('prospects.newProspect')}
                        </h1>
                        {isEdit && form.full_name && (
                            <p className="text-sm text-slate-500 flex items-center gap-2">
                                {form.full_name}{age ? ` · ${age} anos` : ''}
                                {overall !== null && (
                                    <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                        {overall.toFixed(1)}
                                    </span>
                                )}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isEdit && (
                        convertedId ? (
                            <button
                                type="button"
                                onClick={() => navigate('/athletes')}
                                className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
                            >
                                <ExternalLink className="w-4 h-4" />
                                {t('prospects.convert.alreadyDone')}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowConvert(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
                            >
                                <UserPlus className="w-4 h-4" />
                                {t('prospects.convert.button')}
                            </button>
                        )
                    )}
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {t('common.save')}
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

            {/* Convert success banner */}
            {convertSuccess && (
                <div className="flex items-center justify-between gap-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-green-800">{t('prospects.convert.successTitle')}</p>
                            <p className="text-xs text-green-600">{t('prospects.convert.successDesc')}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/athletes')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors shrink-0"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {t('prospects.convert.viewAthlete')}
                    </button>
                </div>
            )}

            {/* Tabs (only for edit) */}
            {isEdit && (
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                    {(['data', 'evaluation'] as Tab[]).map(k => (
                        <button
                            key={k}
                            type="button"
                            onClick={() => setTab(k)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                tab === k
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {k === 'data' ? t('prospects.tab.data') : t('prospects.tab.evaluation')}
                        </button>
                    ))}
                </div>
            )}

            {/* ── Tab: Dados ── */}
            {tab === 'data' && (
                <>
                    {/* Athlete data */}
                    <Section icon={<User className="w-4 h-4" />} title={t('prospects.section.personal')}>
                        <div>
                            <Label required>{t('prospects.field.fullName')}</Label>
                            <input
                                type="text"
                                value={form.full_name}
                                onChange={e => set('full_name', e.target.value)}
                                className={inputCls}
                                placeholder="João Silva"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Label>{t('prospects.field.birthDate')}</Label>
                                <input
                                    type="date"
                                    value={form.birth_date}
                                    onChange={e => set('birth_date', e.target.value)}
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <Label>{t('prospects.field.position')}</Label>
                                <select
                                    value={form.position}
                                    onChange={e => set('position', e.target.value)}
                                    className={selectCls}
                                >
                                    <option value="">— {t('prospects.filterPosition')} —</option>
                                    {FOOTBALL_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <Label>{t('prospects.field.preferredFoot')}</Label>
                                <select
                                    value={form.preferred_foot}
                                    onChange={e => set('preferred_foot', e.target.value)}
                                    className={selectCls}
                                >
                                    <option value="">—</option>
                                    <option value="right">{t('prospects.foot.right')}</option>
                                    <option value="left">{t('prospects.foot.left')}</option>
                                    <option value="both">{t('prospects.foot.both')}</option>
                                </select>
                            </div>
                            <div>
                                <Label>{t('prospects.field.height')}</Label>
                                <input
                                    type="number"
                                    min={100} max={230} step={0.5}
                                    value={form.height_cm ?? ''}
                                    onChange={e => set('height_cm', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                    className={inputCls}
                                    placeholder="175"
                                />
                            </div>
                            <div>
                                <Label>{t('prospects.field.weight')}</Label>
                                <input
                                    type="number"
                                    min={30} max={150} step={0.5}
                                    value={form.weight_kg ?? ''}
                                    onChange={e => set('weight_kg', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                    className={inputCls}
                                    placeholder="70"
                                />
                            </div>
                        </div>
                    </Section>

                    {/* Location */}
                    <Section icon={<MapPin className="w-4 h-4" />} title={t('prospects.section.location')}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Label>{t('prospects.field.city')}</Label>
                                <input
                                    type="text"
                                    value={form.city}
                                    onChange={e => set('city', e.target.value)}
                                    className={inputCls}
                                    placeholder="São Paulo"
                                />
                            </div>
                            <div>
                                <Label>{t('prospects.field.state')}</Label>
                                <input
                                    type="text"
                                    value={form.state}
                                    onChange={e => set('state', e.target.value)}
                                    className={inputCls}
                                    placeholder="SP"
                                    maxLength={2}
                                />
                            </div>
                        </div>
                        <div>
                            <Label>{t('prospects.field.currentClub')}</Label>
                            <input
                                type="text"
                                value={form.current_club}
                                onChange={e => set('current_club', e.target.value)}
                                className={inputCls}
                                placeholder="Clube Atual"
                            />
                        </div>
                    </Section>

                    {/* Contact */}
                    <Section icon={<Phone className="w-4 h-4" />} title={t('prospects.section.contact')}>
                        <div>
                            <Label>{t('prospects.field.contactName')}</Label>
                            <input
                                type="text"
                                value={form.contact_name}
                                onChange={e => set('contact_name', e.target.value)}
                                className={inputCls}
                                placeholder="Nome do responsável"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Label>{t('prospects.field.contactPhone')}</Label>
                                <input
                                    type="tel"
                                    value={form.contact_phone}
                                    onChange={e => set('contact_phone', e.target.value)}
                                    className={inputCls}
                                    placeholder="+55 11 99999-9999"
                                />
                            </div>
                            <div>
                                <Label>{t('prospects.field.contactEmail')}</Label>
                                <input
                                    type="email"
                                    value={form.contact_email}
                                    onChange={e => set('contact_email', e.target.value)}
                                    className={inputCls}
                                    placeholder="email@exemplo.com"
                                />
                            </div>
                        </div>
                    </Section>

                    {/* Scouting info */}
                    <Section icon={<ClipboardList className="w-4 h-4" />} title={t('prospects.section.scouting')}>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <Label>{t('prospects.field.source')}</Label>
                                <select
                                    value={form.source}
                                    onChange={e => set('source', e.target.value as ProspectSource)}
                                    className={selectCls}
                                >
                                    {(Object.keys(SOURCE_META) as ProspectSource[]).map(s => (
                                        <option key={s} value={s}>{t(SOURCE_META[s].labelKey)}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label>{t('prospects.field.status')}</Label>
                                <select
                                    value={form.status}
                                    onChange={e => set('status', e.target.value as ProspectStatus)}
                                    className={selectCls}
                                >
                                    {FUNNEL_STATUSES.map(s => (
                                        <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label>{t('prospects.field.priority')}</Label>
                                <select
                                    value={form.priority}
                                    onChange={e => set('priority', e.target.value as ProspectPriority)}
                                    className={selectCls}
                                >
                                    {(['low', 'normal', 'high', 'urgent'] as ProspectPriority[]).map(p => (
                                        <option key={p} value={p}>{t(PRIORITY_META[p].labelKey)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <Label>{t('prospects.field.videoUrl')}</Label>
                            <input
                                type="url"
                                value={form.video_url}
                                onChange={e => set('video_url', e.target.value)}
                                className={inputCls}
                                placeholder="https://youtube.com/..."
                            />
                        </div>
                        <div>
                            <Label>{t('prospects.field.notes')}</Label>
                            <textarea
                                value={form.notes}
                                onChange={e => set('notes', e.target.value)}
                                rows={4}
                                className={inputCls + ' resize-none'}
                                placeholder={t('prospects.field.notesPlaceholder')}
                            />
                        </div>
                    </Section>
                </>
            )}

            {/* ── Tab: Avaliação ── */}
            {tab === 'evaluation' && (
                <ProspectEvaluation
                    scores={form.scores ?? {}}
                    onChange={scores => set('scores', scores)}
                    t={t}
                />
            )}

            {/* Bottom save */}
            <div className="flex justify-end pb-6">
                <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {t('common.save')}
                </button>
            </div>
            {/* Confirmation modal */}
            {showConvert && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                                <UserPlus className="w-5 h-5 text-emerald-600" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-800">{t('prospects.convert.title')}</h2>
                        </div>

                        <p className="text-sm text-slate-600 mb-1">
                            <span className="font-bold text-slate-800">{form.full_name}</span> {t('prospects.convert.desc')}
                        </p>

                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-4 mb-2">
                            {t('prospects.convert.willTransfer')}
                        </p>
                        <ul className="space-y-1.5 mb-6">
                            {[1, 2, 3, 4].map(n => (
                                <li key={n} className="flex items-center gap-2 text-sm text-slate-600">
                                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">✓</span>
                                    {t(`prospects.convert.item${n}` as any)}
                                </li>
                            ))}
                        </ul>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowConvert(false)}
                                disabled={converting}
                                className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={handleConvert}
                                disabled={converting}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 rounded-xl transition-colors"
                            >
                                {converting
                                    ? <><Loader2 className="w-4 h-4 animate-spin" />{t('prospects.convert.converting')}</>
                                    : <><UserPlus className="w-4 h-4" />{t('prospects.convert.confirm')}</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </form>
    );
};

export default ProspectForm;
