import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, X, Search, UserPlus } from 'lucide-react';
import { guardianService, Guardian } from '../services/guardianService';
import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';
import { useLanguage } from '../contexts/LanguageContext';

interface AthleteOption { id: string; full_name: string; photo_url: string | null; }

const RELATIONSHIPS = ['pai', 'mãe', 'avô', 'avó', 'responsável legal', 'outro'];

const GuardianForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEditing = !!id;
    const { language } = useLanguage();
    const t = (pt: string, en: string) => language === 'en-US' ? en : pt;

    const [form, setForm] = useState<Partial<Guardian>>({
        full_name: '', cpf: null, rg: null, phone: null, email: null,
        address: null, city: null, state: null, zip_code: null, notes: null,
    });
    const [linkedAthletes, setLinkedAthletes] = useState<Guardian['athletes']>([]);
    const [allAthletes, setAllAthletes] = useState<AthleteOption[]>([]);
    const [athleteSearch, setAthleteSearch] = useState('');
    const [addingAthleteId, setAddingAthleteId] = useState<string | null>(null);
    const [addRelationship, setAddRelationship] = useState('pai');
    const [loading, setLoading] = useState(isEditing);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadAllAthletes = useCallback(async () => {
        const tenantId = getCurrentTenantIdSync();
        const { data } = await supabase
            .from('athletes')
            .select('id, full_name, photo_url')
            .eq('tenant_id', tenantId)
            .order('full_name');
        setAllAthletes(data ?? []);
    }, []);

    const loadGuardian = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const g = await guardianService.getById(id);
            if (g) {
                setForm(g);
                setLinkedAthletes(g.athletes ?? []);
            }
        } catch { setError(t('Erro ao carregar responsável', 'Error loading guardian')); }
        finally { setLoading(false); }
    }, [id]);

    useEffect(() => {
        loadAllAthletes();
        if (isEditing) loadGuardian();
    }, [loadAllAthletes, loadGuardian, isEditing]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.full_name?.trim()) return;
        setSaving(true);
        setError(null);
        try {
            if (isEditing) {
                await guardianService.update(id!, form);
            } else {
                await guardianService.create(form as any);
            }
            navigate('/guardians');
        } catch (e: any) {
            setError(e.message ?? t('Erro ao salvar', 'Error saving'));
        } finally { setSaving(false); }
    };

    const handleLinkAthlete = async (athleteId: string) => {
        if (!id) return;
        try {
            await guardianService.linkAthlete(id, athleteId, addRelationship, linkedAthletes?.length === 0);
            const g = await guardianService.getById(id);
            setLinkedAthletes(g?.athletes ?? []);
            setAddingAthleteId(null);
        } catch { setError(t('Erro ao vincular atleta', 'Error linking athlete')); }
    };

    const handleUnlinkAthlete = async (athleteId: string) => {
        if (!id) return;
        try {
            await guardianService.unlinkAthlete(id, athleteId);
            setLinkedAthletes(prev => prev?.filter(a => a.id !== athleteId) ?? []);
        } catch { setError(t('Erro ao desvincular atleta', 'Error unlinking athlete')); }
    };

    const field = (label: string, key: keyof Guardian, type: string = 'text', placeholder?: string) => (
        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">{label}</label>
            <input type={type} value={(form[key] as string) ?? ''}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value || null }))}
                placeholder={placeholder}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
        </div>
    );

    const linkedIds = new Set(linkedAthletes?.map(a => a.id) ?? []);
    const availableAthletes = allAthletes.filter(a =>
        !linkedIds.has(a.id) &&
        (!athleteSearch || a.full_name.toLowerCase().includes(athleteSearch.toLowerCase()))
    );

    if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <button onClick={() => navigate('/guardians')} className="flex items-center gap-2 text-slate-500 hover:text-primary mb-6 text-sm font-semibold transition-colors">
                <ArrowLeft className="w-4 h-4" />
                {t('Voltar para Responsáveis', 'Back to Guardians')}
            </button>

            <h1 className="text-2xl font-bold text-slate-800 mb-6">
                {isEditing ? t('Editar Responsável', 'Edit Guardian') : t('Novo Responsável', 'New Guardian')}
            </h1>

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

            <form onSubmit={handleSave} className="space-y-6">
                <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-4">
                    <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">{t('Dados Pessoais', 'Personal Info')}</h2>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Nome completo', 'Full name')} *</label>
                        <input value={form.full_name ?? ''} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                            placeholder={t('Nome do responsável', 'Guardian name')} required
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {field('CPF', 'cpf', 'text', '000.000.000-00')}
                        {field('RG', 'rg', 'text')}
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-4">
                    <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">{t('Contato', 'Contact')}</h2>
                    <div className="grid grid-cols-2 gap-4">
                        {field(t('Telefone', 'Phone'), 'phone', 'tel', '+55 11 99999-9999')}
                        {field('Email', 'email', 'email', 'email@exemplo.com')}
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-4">
                    <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">{t('Endereço', 'Address')}</h2>
                    {field(t('Endereço', 'Street'), 'address')}
                    <div className="grid grid-cols-3 gap-4">
                        {field(t('Cidade', 'City'), 'city')}
                        {field(t('Estado', 'State'), 'state', 'text', 'SP')}
                        {field('CEP', 'zip_code', 'text', '00000-000')}
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-100 p-6">
                    <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-4">{t('Observações', 'Notes')}</h2>
                    <textarea value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))}
                        rows={3} placeholder={t('Informações adicionais...', 'Additional info...')}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" />
                </div>

                <div className="flex gap-3">
                    <button type="button" onClick={() => navigate('/guardians')} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors">
                        {t('Cancelar', 'Cancel')}
                    </button>
                    <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {t('Salvar', 'Save')}
                    </button>
                </div>
            </form>

            {/* Athlete links — only when editing */}
            {isEditing && (
                <div className="mt-8 bg-white rounded-xl border border-slate-100 p-6">
                    <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-4">{t('Atletas Vinculados', 'Linked Athletes')}</h2>

                    {(linkedAthletes?.length ?? 0) === 0 ? (
                        <p className="text-sm text-slate-400 mb-4">{t('Nenhum atleta vinculado a este responsável.', 'No athletes linked to this guardian.')}</p>
                    ) : (
                        <div className="space-y-2 mb-4">
                            {linkedAthletes?.map(a => (
                                <div key={a.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                    {a.photo_url
                                        ? <img src={a.photo_url} alt={a.full_name} className="w-8 h-8 rounded-full object-cover" />
                                        : <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">{a.full_name.charAt(0)}</div>}
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-slate-800">{a.full_name}</p>
                                        <p className="text-xs text-slate-400">{a.relationship}{a.is_primary ? ` · ${t('Principal', 'Primary')}` : ''}</p>
                                    </div>
                                    <button onClick={() => handleUnlinkAthlete(a.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="border-t pt-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-2">{t('Vincular atleta', 'Link athlete')}</p>
                        <div className="flex gap-2 mb-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input value={athleteSearch} onChange={e => setAthleteSearch(e.target.value)}
                                    placeholder={t('Buscar atleta...', 'Search athlete...')}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                            </div>
                            <select value={addRelationship} onChange={e => setAddRelationship(e.target.value)}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                                {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                            {availableAthletes.slice(0, 20).map(a => (
                                <button key={a.id} onClick={() => handleLinkAthlete(a.id)}
                                    className="w-full flex items-center gap-3 p-2.5 hover:bg-primary/5 rounded-lg transition-colors text-left">
                                    {a.photo_url
                                        ? <img src={a.photo_url} alt={a.full_name} className="w-7 h-7 rounded-full object-cover" />
                                        : <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">{a.full_name.charAt(0)}</div>}
                                    <span className="text-sm text-slate-700 flex-1">{a.full_name}</span>
                                    <UserPlus className="w-4 h-4 text-primary opacity-60" />
                                </button>
                            ))}
                            {availableAthletes.length === 0 && (
                                <p className="text-xs text-slate-400 p-2">{t('Todos os atletas já estão vinculados', 'All athletes already linked')}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GuardianForm;
