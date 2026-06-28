import React, { useEffect, useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import { AVAILABLE_LANGUAGES, Language } from '../../contexts/LanguageContext';

const HELP_LANG_KEY = 'aura_help_lang';

// Shared rich-text rendering rules for article HTML — used both by the live
// Tiptap editor and the public article page, so authored content looks the
// same in both places. No @tailwindcss/typography plugin installed, so this
// uses Tailwind v4 arbitrary-variant selectors instead of `prose`.
export const HELP_CONTENT_CLASS = 'max-w-none text-slate-700 leading-relaxed '
    + '[&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-800 [&_h2]:mt-6 [&_h2]:mb-2 '
    + '[&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-slate-800 [&_h3]:mt-4 [&_h3]:mb-2 '
    + '[&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3 '
    + '[&_li]:mb-1 [&_a]:text-primary [&_a]:underline [&_img]:rounded-lg [&_img]:my-3 [&_strong]:font-bold';

// Independent from the logged-in user's saved language (LanguageContext) —
// a logged-out visitor browsing the Help Center has no session, and a
// logged-in user switching language here shouldn't affect their app session.
export function useHelpLanguage(): [Language, (lang: Language) => void] {
    const [language, setLanguageState] = useState<Language>(() => {
        const stored = localStorage.getItem(HELP_LANG_KEY) as Language | null;
        if (stored) return stored;
        const browserLang = navigator.language?.toLowerCase() || '';
        if (browserLang.startsWith('pt-pt')) return 'pt-PT';
        if (browserLang.startsWith('pt')) return 'pt-BR';
        if (browserLang.startsWith('es')) return 'es-ES';
        if (browserLang.startsWith('fr')) return 'fr-FR';
        if (browserLang.startsWith('en')) return 'en-US';
        return 'pt-BR';
    });

    useEffect(() => {
        localStorage.setItem(HELP_LANG_KEY, language);
    }, [language]);

    return [language, setLanguageState];
}

// Static UI strings for the public Help Center pages — kept local (not in the
// main app's LanguageContext) since this UI follows its own language
// selector, independent from a logged-in user's saved app language.
export const HELP_UI: Record<Language, {
    title: string; heroTitle: string; heroSubtitle: string; searchPlaceholder: string;
    loading: string; noArticlesFound: string; backToHelp: string; articleNotFound: string;
}> = {
    'pt-BR': {
        title: 'Central de Ajuda', heroTitle: 'Como podemos ajudar?',
        heroSubtitle: 'Artigos passo a passo sobre cada funcionalidade do Aura Club Manager',
        searchPlaceholder: 'Buscar um artigo...', loading: 'Carregando...',
        noArticlesFound: 'Nenhum artigo encontrado.', backToHelp: 'Central de Ajuda',
        articleNotFound: 'Artigo não encontrado.',
    },
    'pt-PT': {
        title: 'Central de Ajuda', heroTitle: 'Como podemos ajudar?',
        heroSubtitle: 'Artigos passo a passo sobre cada funcionalidade do Aura Club Manager',
        searchPlaceholder: 'Pesquisar um artigo...', loading: 'A carregar...',
        noArticlesFound: 'Nenhum artigo encontrado.', backToHelp: 'Central de Ajuda',
        articleNotFound: 'Artigo não encontrado.',
    },
    'en-US': {
        title: 'Help Center', heroTitle: 'How can we help?',
        heroSubtitle: 'Step-by-step articles for every Aura Club Manager feature',
        searchPlaceholder: 'Search an article...', loading: 'Loading...',
        noArticlesFound: 'No articles found.', backToHelp: 'Help Center',
        articleNotFound: 'Article not found.',
    },
    'es-ES': {
        title: 'Centro de Ayuda', heroTitle: '¿Cómo podemos ayudarte?',
        heroSubtitle: 'Artículos paso a paso sobre cada función de Aura Club Manager',
        searchPlaceholder: 'Buscar un artículo...', loading: 'Cargando...',
        noArticlesFound: 'No se encontraron artículos.', backToHelp: 'Centro de Ayuda',
        articleNotFound: 'Artículo no encontrado.',
    },
    'fr-FR': {
        title: "Centre d'Aide", heroTitle: 'Comment pouvons-nous vous aider ?',
        heroSubtitle: "Des articles pas-à-pas pour chaque fonctionnalité d'Aura Club Manager",
        searchPlaceholder: 'Rechercher un article...', loading: 'Chargement...',
        noArticlesFound: 'Aucun article trouvé.', backToHelp: "Centre d'Aide",
        articleNotFound: 'Article introuvable.',
    },
};

interface HelpPublicLayoutProps {
    language: Language;
    onLanguageChange: (lang: Language) => void;
    children: React.ReactNode;
}

const HelpPublicLayout: React.FC<HelpPublicLayoutProps> = ({ language, onLanguageChange, children }) => {
    const ui = HELP_UI[language] ?? HELP_UI['pt-BR'];
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <a href="#/help" className="flex items-center gap-2 font-bold text-slate-800">
                        <LifeBuoy className="w-5 h-5 text-primary" />
                        {ui.title}
                    </a>
                    <select
                        value={language}
                        onChange={e => onLanguageChange(e.target.value as Language)}
                        className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
                    >
                        {AVAILABLE_LANGUAGES.map(l => (
                            <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                    </select>
                </div>
            </header>

            <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
                {children}
            </main>

            <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
                Aura Club Manager
            </footer>
        </div>
    );
};

export default HelpPublicLayout;
