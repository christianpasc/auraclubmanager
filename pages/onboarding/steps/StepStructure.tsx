import React from 'react';
import { Check, CalendarDays } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { SuggestedAgeCategory, ageCategoryName } from '../../../constants/onboardingDefaults';

export interface StructureValues {
    seasonName: string;
    seasonYear: number;
    /** Ages (9, 11, ...) the user kept checked. */
    selectedAges: number[];
}

interface Props {
    values: StructureValues;
    onChange: (patch: Partial<StructureValues>) => void;
    suggestions: SuggestedAgeCategory[];
}

const StepStructure: React.FC<Props> = ({ values, onChange, suggestions }) => {
    const { t } = useLanguage();
    const prefix = t('onboarding.structure.categoryPrefix');

    const toggle = (age: number) => {
        const selected = values.selectedAges.includes(age)
            ? values.selectedAges.filter(a => a !== age)
            : [...values.selectedAges, age];
        onChange({ selectedAges: selected });
    };

    return (
        <div className="space-y-6">
            {/* Season */}
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                    {t('onboarding.structure.seasonLabel')}
                </label>
                <div className="relative">
                    <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={values.seasonName}
                        onChange={e => onChange({ seasonName: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">{t('onboarding.structure.seasonHint')}</p>
            </div>

            {/* Age categories */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-slate-700">
                        {t('onboarding.structure.categoriesLabel')}
                    </label>
                    <button
                        type="button"
                        onClick={() => onChange({
                            selectedAges: values.selectedAges.length === suggestions.length
                                ? []
                                : suggestions.map(s => s.age),
                        })}
                        className="text-xs font-semibold text-primary hover:text-primary-dark"
                    >
                        {values.selectedAges.length === suggestions.length
                            ? t('onboarding.structure.clearAll')
                            : t('onboarding.structure.selectAll')}
                    </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {suggestions.map(s => {
                        const selected = values.selectedAges.includes(s.age);
                        return (
                            <button
                                key={s.age}
                                type="button"
                                onClick={() => toggle(s.age)}
                                className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                                    selected ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <span className={`w-5 h-5 shrink-0 rounded-md flex items-center justify-center border-2 ${
                                    selected ? 'bg-primary border-primary' : 'border-slate-300'
                                }`}>
                                    {selected && <Check className="w-3 h-3 text-white" />}
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-bold text-slate-800">
                                        {ageCategoryName(prefix, s.age)}
                                    </span>
                                    <span className="block text-xs text-slate-500">
                                        {s.minBirthYear}–{s.maxBirthYear}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
                <p className="text-xs text-slate-400 mt-2">{t('onboarding.structure.categoriesHint')}</p>
            </div>
        </div>
    );
};

export default StepStructure;
