import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, AlertTriangle } from 'lucide-react';
import { adminHelpCenterService } from '../../services/adminHelpCenterService';
import { auditService } from '../../services/auditService';
import { HelpCategory, I18nText } from '../../services/helpCenterService';
import { AVAILABLE_LANGUAGES, Language } from '../../contexts/LanguageContext';
import { PLAN_MODULES } from '../../services/featureFlagService';
import LanguageTabs from '../../components/admin/LanguageTabs';
import HelpArticleEditor from '../../components/admin/HelpArticleEditor';

function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

const AdminHelpArticleEditor: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const isNew = !id;

    const [categories, setCategories] = useState<HelpCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeLang, setActiveLang] = useState<Language>('pt-BR');
    const [slugTouched, setSlugTouched] = useState(false);

    const [categoryId, setCategoryId] = useState(searchParams.get('category') || '');
    const [slug, setSlug] = useState('');
    const [featureKey, setFeatureKey] = useState('');
    const [routeKey, setRouteKey] = useState('');
    const [status, setStatus] = useState<'draft' | 'published'>('draft');
    const [searchKeywords, setSearchKeywords] = useState('');
    const [titleI18n, setTitleI18n] = useState<I18nText>({});
    const [excerptI18n, setExcerptI18n] = useState<I18nText>({});
    const [contentI18n, setContentI18n] = useState<I18nText>({});

    useEffect(() => {
        (async () => {
            try {
                const cats = await adminHelpCenterService.getAllCategories();
                setCategories(cats);
                if (!isNew && id) {
                    const article = await adminHelpCenterService.getArticleById(id);
                    if (article) {
                        setCategoryId(article.category_id);
                        setSlug(article.slug);
                        setFeatureKey(article.feature_key || '');
                        setRouteKey(article.route_key || '');
                        setStatus(article.status);
                        setSearchKeywords(article.search_keywords || '');
                        setTitleI18n(article.title_i18n || {});
                        setExcerptI18n(article.excerpt_i18n || {});
                        setContentI18n(article.content_i18n || {});
                        setSlugTouched(true);
                    }
                } else if (cats.length > 0 && !categoryId) {
                    setCategoryId(cats[0].id);
                }
            } catch (err: any) {
                setError(err.message || 'Erro ao carregar artigo.');
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        if (!slugTouched && titleI18n['pt-BR']) {
            setSlug(slugify(titleI18n['pt-BR']));
        }
    }, [titleI18n, slugTouched]);

    const handleSave = async () => {
        if (!categoryId || !slug.trim() || !titleI18n['pt-BR']?.trim()) {
            setError('Categoria, slug e título em pt-BR são obrigatórios.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const payload = {
                category_id: categoryId,
                slug: slug.trim(),
                title_i18n: titleI18n,
                excerpt_i18n: excerptI18n,
                content_i18n: contentI18n,
                feature_key: featureKey || null,
                route_key: routeKey || null,
                status,
                search_keywords: searchKeywords || null,
            };
            if (isNew) {
                const created = await adminHelpCenterService.createArticle(payload as any);
                await auditService.log('help_article.create', 'help_article', created.id, { slug: created.slug });
                navigate(`/admin/help/articles/${created.id}`, { replace: true });
            } else if (id) {
                await adminHelpCenterService.updateArticle(id, payload);
                await auditService.log('help_article.update', 'help_article', id, { slug });
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar artigo.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    const filledTitles = new Set(AVAILABLE_LANGUAGES.map(l => l.value).filter(v => !!titleI18n[v]));

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/admin/help')} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-bold text-slate-800">{isNew ? 'Novo Artigo' : 'Editar Artigo'}</h2>
            </div>

            {error && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Categoria</label>
                    <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name_i18n['pt-BR'] || c.slug}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Slug (URL)</label>
                    <input value={slug} onChange={e => { setSlug(e.target.value); setSlugTouched(true); }}
                        placeholder="ex: cadastro-de-atletas"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Vincular a módulo (feature_key)</label>
                    <select value={featureKey} onChange={e => setFeatureKey(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                        <option value="">Nenhum</option>
                        {PLAN_MODULES.map(m => <option key={m.key} value={m.key}>{m.labelPt}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Vincular a rota (route_key)</label>
                    <input value={routeKey} onChange={e => setRouteKey(e.target.value)}
                        placeholder="ex: dashboard, settings, monthly_fees"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
                    <select value={status} onChange={e => setStatus(e.target.value as 'draft' | 'published')}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                        <option value="draft">Rascunho</option>
                        <option value="published">Publicado</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Palavras-chave (busca)</label>
                    <input value={searchKeywords} onChange={e => setSearchKeywords(e.target.value)}
                        placeholder="termos extras separados por vírgula"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <LanguageTabs activeLang={activeLang} onChange={setActiveLang} filledLanguages={filledTitles} />

                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Título</label>
                    <input
                        value={titleI18n[activeLang] || ''}
                        onChange={e => setTitleI18n(prev => ({ ...prev, [activeLang]: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Resumo (aparece na busca/listagem)</label>
                    <textarea
                        value={excerptI18n[activeLang] || ''}
                        onChange={e => setExcerptI18n(prev => ({ ...prev, [activeLang]: e.target.value }))}
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Conteúdo</label>
                    <HelpArticleEditor
                        content={contentI18n[activeLang] || ''}
                        onChange={html => setContentI18n(prev => ({ ...prev, [activeLang]: html }))}
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3">
                <button onClick={() => navigate('/admin/help')} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                    Cancelar
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar
                </button>
            </div>
        </div>
    );
};

export default AdminHelpArticleEditor;
