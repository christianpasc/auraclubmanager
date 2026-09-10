import React from 'react';
import { Globe, Coins } from 'lucide-react';
import { useLanguage, AVAILABLE_CURRENCIES, AVAILABLE_LANGUAGES, Language } from '../../../contexts/LanguageContext';

export interface PreferencesValues {
    /** Interface language — profiles.language. */
    uiLanguage: Language;
    /** Display currency — tenants.settings.currency. */
    currency: string;
}

interface Props {
    values: PreferencesValues;
    onChange: (patch: Partial<PreferencesValues>) => void;
}

const StepPreferences: React.FC<Props> = ({ values, onChange }) => {
    const { t } = useLanguage();
    const symbol = AVAILABLE_CURRENCIES.find(c => c.code === values.currency)?.symbol;

    return (
        <div className="space-y-5">
            {/* Interface language. Changing it here re-renders the wizard in the new
                language straight away, so the choice is visible immediately. */}
            <div className="p-4 rounded-xl border border-slate-200">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 shrink-0 bg-primary/10 rounded-xl flex items-center justify-center">
                        <Globe className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <label className="block text-sm font-bold text-slate-800">
                            {t('onboarding.preferences.languageLabel')}
                        </label>
                        <p className="text-xs text-slate-500 mt-0.5 mb-3">
                            {t('onboarding.preferences.languageHint')}
                        </p>
                        <select
                            value={values.uiLanguage}
                            onChange={e => onChange({ uiLanguage: e.target.value as Language })}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        >
                            {AVAILABLE_LANGUAGES.map(l => (
                                <option key={l.value} value={l.value}>{l.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Display currency */}
            <div className="p-4 rounded-xl border border-slate-200">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 shrink-0 bg-primary/10 rounded-xl flex items-center justify-center">
                        <Coins className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <label className="block text-sm font-bold text-slate-800">
                            {t('onboarding.preferences.currencyLabel')}
                        </label>
                        <p className="text-xs text-slate-500 mt-0.5 mb-3">
                            {t('onboarding.preferences.currencyHint')}
                        </p>
                        <select
                            value={values.currency}
                            onChange={e => onChange({ currency: e.target.value })}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        >
                            {AVAILABLE_CURRENCIES.map(c => (
                                <option key={c.code} value={c.code}>{c.label}</option>
                            ))}
                        </select>
                        {symbol && (
                            <p className="text-xs text-slate-400 mt-2">
                                {t('onboarding.preferences.currencyExample').replace('{symbol}', symbol)}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <p className="text-xs text-slate-400">{t('onboarding.preferences.changeLater')}</p>
        </div>
    );
};

export default StepPreferences;
