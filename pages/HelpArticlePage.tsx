import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import HelpPublicLayout, { useHelpLanguage, HELP_CONTENT_CLASS, HELP_UI } from '../components/help/HelpPublicLayout';
import { helpCenterService, HelpArticle, HelpCategory, pickI18n } from '../services/helpCenterService';

const HelpArticlePage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const [language, setLanguage] = useHelpLanguage();
    const [article, setArticle] = useState<HelpArticle | null>(null);
    const [category, setCategory] = useState<HelpCategory | null>(null);
    const [loading, setLoading] = useState(true);
    const ui = HELP_UI[language] ?? HELP_UI['pt-BR'];

    useEffect(() => {
        if (!slug) return;
        setLoading(true);
        (async () => {
            try {
                const art = await helpCenterService.getArticleBySlug(slug);
                setArticle(art);
                if (art) {
                    const cats = await helpCenterService.getCategories();
                    setCategory(cats.find(c => c.id === art.category_id) || null);
                }
            } finally {
                setLoading(false);
            }
        })();
    }, [slug]);

    return (
        <HelpPublicLayout language={language} onLanguageChange={setLanguage}>
            <a href="#/help" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary mb-6">
                <ArrowLeft className="w-4 h-4" /> {ui.backToHelp}
            </a>

            {loading ? (
                <p className="text-center text-slate-400 py-12">{ui.loading}</p>
            ) : !article ? (
                <div className="text-center py-16">
                    <p className="text-slate-500">{ui.articleNotFound}</p>
                    <a href="#/help" className="text-primary text-sm font-semibold hover:underline mt-3 inline-block">{ui.backToHelp}</a>
                </div>
            ) : (
                <article className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10">
                    {category && (
                        <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">
                            {pickI18n(category.name_i18n, language)}
                        </p>
                    )}
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-6">
                        {pickI18n(article.title_i18n, language)}
                    </h1>
                    <div
                        className={HELP_CONTENT_CLASS}
                        dangerouslySetInnerHTML={{ __html: pickI18n(article.content_i18n, language) }}
                    />
                </article>
            )}
        </HelpPublicLayout>
    );
};

export default HelpArticlePage;
