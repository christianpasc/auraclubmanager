import React from 'react';
import { GraduationCap, Shield, Check } from 'lucide-react';
import { useLanguage, AVAILABLE_LANGUAGES } from '../../../contexts/LanguageContext';
import { buildCountryOptions } from '../../../constants/countries';

export interface OrganizationValues {
    organizationType: 'school' | 'club';
    name: string;
    country: string;
    commsLanguage: string;
}

interface Props {
    values: OrganizationValues;
    onChange: (patch: Partial<OrganizationValues>) => void;
    /** The organization exists already (the user came back to this step). */
    locked?: boolean;
}

const TYPE_OPTIONS: { value: 'school' | 'club'; icon: React.ElementType }[] = [
    { value: 'school', icon: GraduationCap },
    { value: 'club', icon: Shield },
];

const StepOrganization: React.FC<Props> = ({ values, onChange, locked }) => {
    const { t } = useLanguage();
    const countryOptions = React.useMemo(() => buildCountryOptions(t), [t]);

    return (
        <div className="space-y-5">
            {/* Organization type */}
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                    {t('onboarding.organization.typeLabel')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                    {TYPE_OPTIONS.map(option => {
                        const Icon = option.icon;
                        const selected = values.organizationType === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                disabled={locked}
                                onClick={() => onChange({ organizationType: option.value })}
                                className={`relative text-left p-4 rounded-xl border-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                                    selected
                                        ? 'border-primary bg-primary/5'
                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                }`}
                            >
                                {selected && (
                                    <span className="absolute top-3 right-3 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                                        <Check className="w-3 h-3 text-white" />
                                    </span>
                                )}
                                <Icon className={`w-6 h-6 mb-2 ${selected ? 'text-primary' : 'text-slate-400'}`} />
                                <p className="text-sm font-bold text-slate-800">
                                    {t(`onboarding.organization.type.${option.value}`)}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                                    {t(`onboarding.organization.type.${option.value}.hint`)}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Name */}
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                    {t('onboarding.organization.nameLabel')}
                </label>
                <input
                    type="text"
                    value={values.name}
                    disabled={locked}
                    onChange={e => onChange({ name: e.target.value })}
                    placeholder={t('onboarding.organization.namePlaceholder')}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-60"
                />
            </div>

            {/* Country */}
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                    {t('onboarding.organization.countryLabel')}
                </label>
                <select
                    value={values.country}
                    onChange={e => onChange({ country: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                >
                    {countryOptions.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                </select>
                <p className="text-xs text-slate-400 mt-1.5">
                    {t('onboarding.organization.countryHint')}
                </p>
            </div>

            {/* Language used to write to families. Distinct from the interface
                language, which the person picks for themselves on the next step. */}
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                    {t('onboarding.organization.commsLanguageLabel')}
                </label>
                <select
                    value={values.commsLanguage}
                    onChange={e => onChange({ commsLanguage: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                >
                    {AVAILABLE_LANGUAGES.map(l => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                </select>
                <p className="text-xs text-slate-400 mt-1.5">
                    {t('onboarding.organization.commsLanguageHint')}
                </p>
            </div>
        </div>
    );
};

export default StepOrganization;
