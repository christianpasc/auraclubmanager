import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { SchoolPlan } from '../../../services/schoolPlanService';

export interface PlanValues {
    name: string;
    amount: string;
    interval: SchoolPlan['interval'];
}

interface Props {
    values: PlanValues;
    onChange: (patch: Partial<PlanValues>) => void;
    /** Currency picked on step 1, shown as the amount prefix. */
    currency: string;
}

const INTERVALS: SchoolPlan['interval'][] = ['monthly', 'quarterly', 'semiannual', 'annual'];

const StepPlan: React.FC<Props> = ({ values, onChange, currency }) => {
    const { t } = useLanguage();

    return (
        <div className="space-y-5">
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                    {t('onboarding.plan.nameLabel')}
                </label>
                <input
                    type="text"
                    value={values.name}
                    onChange={e => onChange({ name: e.target.value })}
                    placeholder={t('onboarding.plan.namePlaceholder')}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        {t('onboarding.plan.amountLabel')}
                    </label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                            {currency}
                        </span>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={values.amount}
                            onChange={e => onChange({ amount: e.target.value })}
                            placeholder="0,00"
                            className="w-full pl-14 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        {t('schoolPlans.interval')}
                    </label>
                    <select
                        value={values.interval}
                        onChange={e => onChange({ interval: e.target.value as SchoolPlan['interval'] })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    >
                        {INTERVALS.map(i => (
                            <option key={i} value={i}>{t(`planType.${i}`)}</option>
                        ))}
                    </select>
                </div>
            </div>

            <p className="text-xs text-slate-400">{t('onboarding.plan.hint')}</p>
        </div>
    );
};

export default StepPlan;
