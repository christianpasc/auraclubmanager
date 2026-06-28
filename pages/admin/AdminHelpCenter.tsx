import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Loader2, AlertTriangle, Plus, Pencil, Trash2, X, Check,
    ToggleLeft, ToggleRight, LifeBuoy, ChevronDown, ChevronUp,
} from 'lucide-react';
import { adminHelpCenterService } from '../../services/adminHelpCenterService';
import { auditService } from '../../services/auditService';
import { HelpCategory, HelpArticle, pickI18n } from '../../services/helpCenterService';
import { AVAILABLE_LANGUAGES, Language } from '../../contexts/LanguageContext';
import LanguageTabs from '../../components/admin/LanguageTabs';

const EMPTY_NAME_I18N: Partial<Record<Language, string>> = {};

const AdminHelpCenter: React.FC = () => {
    const navigate = useNavigate();
    const [categories, setCategories] = useState<HelpCategory[]>([]);
    const [articles, setArticles] = useState<HelpArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<HelpCategory | null>(null);
    const [activeLang, setActiveLang] = useState<Language>('pt-BR');
    const [slug, setSlug] = useState('');
    const [nameI18n, setNameI18n] = useState<Partial<Record<Language, string>>>(EMPTY_NAME_I18N);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const load = async () => {
        try {
            setLoading(true);
            const [cats, arts] = await Promise.all([
                adminHelpCenterService.getAllCategories(),
                adminHelpCenterService.getAllArticles(),
            ]);
            setCategories(cats);
            setArticles(arts);
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar a Central de Ajuda.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const toggleExpanded = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const openCreateCategory = () => {
        setEditingCategory(null);
        setSlug('');
        setNameI18n({});
        setActiveLang('pt-BR');
        setShowModal(true);
    };

    const openEditCategory = (cat: HelpCategory) => {
        setEditingCategory(cat);
        setSlug(cat.slug);
        setNameI18n(cat.name_i18n || {});
        setActiveLang('pt-BR');
        setShowModal(true);
    };

    const handleSaveCategory = async () => {
        if (!slug.trim() || !nameI18n['pt-BR']?.trim()) return;
        setSaving(true);
        try {
            if (editingCategory) {
                await adminHelpCenterService.updateCategory(editingCategory.id, { slug: slug.trim(), name_i18n: nameI18n });
                await auditService.log('help_category.update', 'help_category', editingCategory.id, { slug });
            } else {
                const created = await adminHelpCenterService.createCategory(slug.trim(), nameI18n, null, categories.length);
                await auditService.log('help_category.create', 'help_category', created.id, { slug });
            }
            setShowModal(false);
            await load();
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar categoria.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteCategory = async (id: string) => {
        try {
            await adminHelpCenterService.deleteCategory(id);
            await auditService.log('help_category.delete', 'help_category', id, {});
            setDeleteConfirm(null);
            await load();
        } catch (err: any) {
            setError(err.message || 'Erro ao excluir categoria.');
        }
    };

    const handleToggleArticleStatus = async (article: HelpArticle) => {
        try {
            await adminHelpCenterService.updateArticle(article.id, {
                status: article.status === 'published' ? 'draft' : 'published',
            });
            await load();
        } catch (err: any) {
            setError(err.message || 'Erro ao alterar status do artigo.');
        }
    };

    const handleDeleteArticle = async (id: string) => {
        try {
            await adminHelpCenterService.deleteArticle(id);
            await auditService.log('help_article.delete', 'help_article', id, {});
            setDeleteConfirm(null);
            await load();
        } catch (err: any) {
            setError(err.message || 'Erro ao excluir artigo.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Central de Ajuda</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Categorias e artigos exibidos publicamente em /help.</p>
                </div>
                <button
                    onClick={openCreateCategory}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-4 h-4" /> Nova Categoria
                </button>
            </div>

            {error && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
                </div>
            )}

            <div className="space-y-3">
                {categories.map(cat => {
                    const catArticles = articles.filter(a => a.category_id === cat.id);
                    const isOpen = expanded.has(cat.id);
                    return (
                        <div key={cat.id} className="bg-white rounded-xl border border-slate-200">
                            <div className="flex items-center justify-between p-4">
                                <button onClick={() => toggleExpanded(cat.id)} className="flex items-center gap-2 text-left flex-1">
                                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                    <span className="font-semibold text-slate-800">{pickI18n(cat.name_i18n, 'pt-BR')}</span>
                                    <span className="text-xs text-slate-400">({catArticles.length} artigos)</span>
                                </button>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => navigate(`/admin/help/articles/new?category=${cat.id}`)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
                                        <Plus className="w-3.5 h-3.5" /> Artigo
                                    </button>
                                    <button onClick={() => openEditCategory(cat)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    {deleteConfirm === cat.id ? (
                                        <button onClick={() => handleDeleteCategory(cat.id)} className="p-1.5 text-white bg-red-600 rounded-lg">
                                            <Check className="w-4 h-4" />
                                        </button>
                                    ) : (
                                        <button onClick={() => setDeleteConfirm(cat.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {isOpen && (
                                <div className="border-t border-slate-100 divide-y divide-slate-100">
                                    {catArticles.length === 0 ? (
                                        <p className="p-4 text-sm text-slate-400 text-center">Nenhum artigo nesta categoria ainda.</p>
                                    ) : catArticles.map(article => (
                                        <div key={article.id} className="flex items-center justify-between gap-3 p-4">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <button onClick={() => handleToggleArticleStatus(article)} title={article.status === 'published' ? 'Publicado — clique para tornar rascunho' : 'Rascunho — clique para publicar'}>
                                                    {article.status === 'published'
                                                        ? <ToggleRight className="w-6 h-6 text-green-500 shrink-0" />
                                                        : <ToggleLeft className="w-6 h-6 text-slate-300 shrink-0" />}
                                                </button>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-slate-800 truncate">{pickI18n(article.title_i18n, 'pt-BR')}</p>
                                                    <p className="text-xs text-slate-400">/help/{article.slug} · {article.status === 'published' ? 'Publicado' : 'Rascunho'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button onClick={() => navigate(`/admin/help/articles/${article.id}`)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                {deleteConfirm === article.id ? (
                                                    <button onClick={() => handleDeleteArticle(article.id)} className="p-1.5 text-white bg-red-600 rounded-lg">
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                ) : (
                                                    <button onClick={() => setDeleteConfirm(article.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {categories.length === 0 && (
                    <div className="text-center py-16 text-slate-400">
                        <LifeBuoy className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Nenhuma categoria cadastrada ainda.</p>
                    </div>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-800">{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</h3>
                            <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Slug</label>
                            <input
                                value={slug}
                                onChange={e => setSlug(e.target.value)}
                                placeholder="ex: equipe-esporte"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Nome</label>
                            <LanguageTabs activeLang={activeLang} onChange={setActiveLang}
                                filledLanguages={new Set(AVAILABLE_LANGUAGES.map(l => l.value).filter(v => !!nameI18n[v]))} />
                            <input
                                value={nameI18n[activeLang] || ''}
                                onChange={e => setNameI18n(prev => ({ ...prev, [activeLang]: e.target.value }))}
                                placeholder="Nome da categoria"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveCategory}
                                disabled={saving || !slug.trim() || !nameI18n['pt-BR']?.trim()}
                                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {editingCategory ? 'Salvar' : 'Criar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminHelpCenter;
