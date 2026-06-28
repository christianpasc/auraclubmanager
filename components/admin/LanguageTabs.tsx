import React from 'react';
import { AVAILABLE_LANGUAGES, Language } from '../../contexts/LanguageContext';

interface LanguageTabsProps {
    activeLang: Language;
    onChange: (lang: Language) => void;
    // Optional: mark tabs whose content is still empty, so the admin can spot
    // untranslated languages at a glance.
    filledLanguages?: Set<Language>;
}

const LanguageTabs: React.FC<LanguageTabsProps> = ({ activeLang, onChange, filledLanguages }) => {
    return (
        <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
            {AVAILABLE_LANGUAGES.map(({ value, label }) => {
                const isFilled = !filledLanguages || filledLanguages.has(value);
                return (
                    <button
                        key={value}
                        type="button"
                        onClick={() => onChange(value)}
                        className={`px-3 py-2 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 ${
                            activeLang === value
                                ? 'border-primary text-primary'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {label}
                        {!isFilled && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Sem tradução" />}
                    </button>
                );
            })}
        </div>
    );
};

export default LanguageTabs;
