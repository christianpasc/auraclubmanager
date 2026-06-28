import React, { useEffect, useState } from 'react';
import { Search, ChevronRight, LifeBuoy, Users, Briefcase, Settings, FileText, LucideIcon } from 'lucide-react';
import HelpPublicLayout, { useHelpLanguage, HELP_UI } from '../components/help/HelpPublicLayout';
import { helpCenterService, HelpCategory, HelpArticle, pickI18n } from '../services/helpCenterService';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
    'equipe-esporte': Users,
    'gestao': Briefcase,
    'conta-configuracoes': Settings,
};

const HelpCenter: React.FC = () => {
    const [language, setLanguage] = useHelpLanguage();
    const ui = HELP_UI[language] ?? HELP_UI['pt-BR'];
    const [categories, setCategories] = useState<HelpCategory[]>([]);
    const [articles, setArticles] = useState<HelpArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const [cats, arts] = await Promise.all([
                    helpCenterService.getCategories(),
                    helpCenterService.getAllPublishedArticles(),
                ]);
                setCategories(cats);
                setArticles(arts);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const filteredArticles = articles.filter(a => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return pickI18n(a.title_i18n, language).toLowerCase().includes(q)
            || pickI18n(a.excerpt_i18n, language).toLowerCase().includes(q)
            || (a.search_keywords || '').toLowerCase().includes(q);
    });

    return (
        <HelpPublicLayout language={language} onLanguageChange={setLanguage}>
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-4">
                    <LifeBuoy className="w-7 h-7" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">{ui.heroTitle}</h1>
                <p className="text-slate-500 mt-2">{ui.heroSubtitle}</p>
            </div>

            <div className="relative max-w-xl mx-auto mb-10">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={ui.searchPlaceholder}
                    className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-sm shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
            </div>

            {loading ? (
                <p className="text-center text-slate-400 py-12">{ui.loading}</p>
            ) : search.trim() ? (
                <div className="space-y-2 max-w-2xl mx-auto">
                    {filteredArticles.length === 0 ? (
                        <p className="text-center text-slate-400 py-12">{ui.noArticlesFound}</p>
                    ) : filteredArticles.map(a => (
                        <a key={a.id} href={`#/help/${a.slug}`}
                            className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all">
                            <div>
                                <p className="font-semibold text-slate-800">{pickI18n(a.title_i18n, language)}</p>
                                <p className="text-sm text-slate-500 mt-0.5">{pickI18n(a.excerpt_i18n, language)}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                        </a>
                    ))}
                </div>
            ) : (
                <div className="space-y-10">
                    {categories.map(cat => {
                        const catArticles = articles.filter(a => a.category_id === cat.id);
                        if (catArticles.length === 0) return null;
                        const CatIcon = CATEGORY_ICONS[cat.slug] || FileText;
                        return (
                            <section key={cat.id}>
                                <div className="flex items-center gap-2.5 mb-4">
                                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                        <CatIcon className="w-[18px] h-[18px]" />
                                    </div>
                                    <h2 className="text-lg font-bold text-slate-800">{pickI18n(cat.name_i18n, language)}</h2>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {catArticles.map(a => (
                                        <a key={a.id} href={`#/help/${a.slug}`}
                                            className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-primary/40 hover:shadow-md transition-all flex flex-col">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <FileText className="w-4 h-4 text-primary/70 shrink-0 mt-0.5" />
                                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                                            </div>
                                            <p className="font-semibold text-slate-800 leading-snug">{pickI18n(a.title_i18n, language)}</p>
                                            <p className="text-sm text-slate-500 mt-1.5 line-clamp-2">{pickI18n(a.excerpt_i18n, language)}</p>
                                        </a>
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}
        </HelpPublicLayout>
    );
};

export default HelpCenter;
