import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, UserMinus, UserPlus, Search } from 'lucide-react';
import { groupService, Group, AthleteGroup } from '../services/groupService';
import { seasonService, Season } from '../services/seasonService';
import { ageCategoryService, AgeCategory } from '../services/ageCategoryService';
import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';
import { useLanguage } from '../contexts/LanguageContext';

interface AthleteOption { id: string; full_name: string; photo_url: string | null; category: string | null; }

const GroupForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEditing = !!id;
    const { language } = useLanguage();
    const t = (pt: string, en: string) => language === 'en-US' ? en : pt;

    const [form, setForm] = useState<Partial<Group>>({
        name: '', description: '', season_id: null, age_category_id: null,
        coach_user_id: null, max_athletes: null, is_active: true,
    });
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [categories, setCategories] = useState<AgeCategory[]>([]);
    const [groupAthletes, setGroupAthletes] = useState<AthleteGroup[]>([]);
    const [allAthletes, setAllAthletes] = useState<AthleteOption[]>([]);
    const [athleteSearch, setAthleteSearch] = useState('');
    const [loading, setLoading] = useState(isEditing);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadMeta = useCallback(async () => {
        const [s, c] = await Promise.all([seasonService.list(), ageCategoryService.list()]);
        setSeasons(s);
        setCategories(c);

        const tenantId = getCurrentTenantIdSync();
        const { data } = await supabase
            .from('athletes')
            .select('id, full_name, photo_url, category')
            .eq('tenant_id', tenantId)
            .order('full_name');
        setAllAthletes(data ?? []);
    }, []);

    const loadGroup = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [g, members] = await Promise.all([groupService.getById(id), groupService.getAthletes(id)]);
            if (g) setForm(g);
            setGroupAthletes(members);
        } catch { setError(t('Erro ao carregar turma', 'Error loading group')); }
        finally { setLoading(false); }
    }, [id]);

    useEffect(() => {
        loadMeta();
        if (isEditing) loadGroup();
    }, [loadMeta, loadGroup, isEditing]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name?.trim()) return;
        setSaving(true);
        setError(null);
        try {
            const payload = {
                name: form.name!,
                description: form.description ?? null,
                season_id: form.season_id ?? null,
                age_category_id: form.age_category_id ?? null,
                coach_user_id: form.coach_user_id ?? null,
                max_athletes: form.max_athletes ?? null,
                is_active: form.is_active ?? true,
            };
            if (isEditing) { await groupService.update(id!, payload); }
            else { await groupService.create(payload); }
            navigate('/groups');
        } catch (e: any) {
            setError(e.message ?? t('Erro ao salvar', 'Error saving'));
        } finally { setSaving(false); }
    };

    const handleAddAthlete = async (athleteId: string) => {
        try {
            await groupService.addAthlete(id!, athleteId);
            setGroupAthletes(await groupService.getAthletes(id!));
        } catch { setError(t('Erro ao adicionar atleta', 'Error adding athlete')); }
    };

    const handleRemoveAthlete = async (athleteId: string) => {
        try {
            await groupService.removeAthlete(id!, athleteId);
            setGroupAthletes(await groupService.getAthletes(id!));
        } catch { setError(t('Erro ao remover atleta', 'Error removing athlete')); }
    };

    const memberIds = new Set(groupAthletes.map(a => a.athlete_id));
    const availableAthletes = allAthletes.filter(a =>
        !memberIds.has(a.id) &&
        (!athleteSearch || a.full_name.toLowerCase().includes(athleteSearch.toLowerCase()))
    );

    if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <button onClick={() => navigate('/groups')} className="flex items-center gap-2 text-slate-500 hover:text-primary mb-6 text-sm font-semibold transition-colors">
                <ArrowLeft className="w-4 h-4" />
                {t('Voltar para Turmas', 'Back to Groups')}
            </button>

            <h1 className="text-2xl font-bold text-slate-800 mb-6">
                {isEditing ? t('Editar Turma', 'Edit Group') : t('Nova Turma', 'New Group')}
            </h1>

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

            <form onSubmit={handleSave} className="space-y-6">
                <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-4">
                    <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide">{t('Dados da Turma', 'Group Details')}</h2>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Nome da turma', 'Group name')} *</label>
                        <input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Sub-17 A"
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" required />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Temporada', 'Season')}</label>
                            <select value={form.season_id ?? ''} onChange={e => setForm(f => ({ ...f, season_id: e.target.value || null }))}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white">
                                <option value="">{t('Selecionar...', 'Select...')}</option>
                                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Categoria', 'Category')}</label>
                            <select value={form.age_category_id ?? ''} onChange={e => setForm(f => ({ ...f, age_category_id: e.target.value || null }))}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white">
                                <option value="">{t('Selecionar...', 'Select...')}</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Descrição', 'Description')}</label>
                        <textarea value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            rows={2} placeholder={t('Informações adicionais sobre a turma...', 'Additional group info...')}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Máximo de atletas', 'Max athletes')}</label>
                        <input type="number" value={form.max_athletes ?? ''}
                            onChange={e => setForm(f => ({ ...f, max_athletes: e.target.value ? Number(e.target.value) : null }))}
                            placeholder={t('Ilimitado', 'Unlimited')}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.is_active ?? true} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                            className="w-4 h-4 accent-primary" />
                        <span className="text-sm text-slate-700">{t('Turma ativa', 'Active group')}</span>
                    </label>
                </div>

                <div className="flex gap-3">
                    <button type="button" onClick={() => navigate('/groups')} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors">
                        {t('Cancelar', 'Cancel')}
                    </button>
                    <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {t('Salvar', 'Save')}
                    </button>
                </div>
            </form>

            {/* Athlete management — only visible when editing */}
            {isEditing && (
                <div className="mt-8 bg-white rounded-xl border border-slate-100 p-6">
                    <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-4">{t('Atletas da Turma', 'Group Athletes')}</h2>

                    {groupAthletes.length === 0 ? (
                        <p className="text-sm text-slate-400 mb-4">{t('Nenhum atleta nesta turma ainda.', 'No athletes in this group yet.')}</p>
                    ) : (
                        <div className="space-y-2 mb-4">
                            {groupAthletes.map(ag => (
                                <div key={ag.athlete_id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                    {ag.athlete_photo
                                        ? <img src={ag.athlete_photo} alt={ag.athlete_name} className="w-8 h-8 rounded-full object-cover" />
                                        : <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">{ag.athlete_name.charAt(0)}</div>}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 truncate">{ag.athlete_name}</p>
                                        {ag.athlete_position && <p className="text-xs text-slate-400">{ag.athlete_position}</p>}
                                    </div>
                                    <button onClick={() => handleRemoveAthlete(ag.athlete_id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                        <UserMinus className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="border-t pt-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-2">{t('Adicionar atleta', 'Add athlete')}</p>
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input value={athleteSearch} onChange={e => setAthleteSearch(e.target.value)}
                                placeholder={t('Buscar atleta...', 'Search athlete...')}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                            {availableAthletes.slice(0, 20).map(a => (
                                <button key={a.id} onClick={() => handleAddAthlete(a.id)}
                                    className="w-full flex items-center gap-3 p-2.5 hover:bg-primary/5 rounded-lg transition-colors text-left">
                                    {a.photo_url
                                        ? <img src={a.photo_url} alt={a.full_name} className="w-7 h-7 rounded-full object-cover" />
                                        : <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">{a.full_name.charAt(0)}</div>}
                                    <span className="text-sm text-slate-700 flex-1 truncate">{a.full_name}</span>
                                    {a.category && <span className="text-xs text-slate-400">{a.category}</span>}
                                    <UserPlus className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100" />
                                </button>
                            ))}
                            {availableAthletes.length === 0 && (
                                <p className="text-xs text-slate-400 p-2">{t('Nenhum atleta disponível', 'No athletes available')}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupForm;
