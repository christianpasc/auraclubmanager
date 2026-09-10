import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { isMinorFromBirthDate } from '../../../lib/age';

export interface AthleteValues {
    fullName: string;
    birthDate: string;
    guardianName: string;
    guardianPhone: string;
    guardianConsent: boolean;
}

interface Props {
    values: AthleteValues;
    onChange: (patch: Partial<AthleteValues>) => void;
}

const StepAthlete: React.FC<Props> = ({ values, onChange }) => {
    const { t } = useLanguage();
    // Same LGPD rule the full athlete form enforces (AthleteForm.tsx): a minor's
    // data may only be stored with documented guardian consent.
    const isMinor = isMinorFromBirthDate(values.birthDate);

    return (
        <div className="space-y-5">
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                    {t('onboarding.athlete.nameLabel')}
                </label>
                <input
                    type="text"
                    value={values.fullName}
                    onChange={e => onChange({ fullName: e.target.value })}
                    placeholder={t('onboarding.athlete.namePlaceholder')}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
            </div>

            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                    {t('onboarding.athlete.birthDateLabel')}
                </label>
                <input
                    type="date"
                    value={values.birthDate}
                    onChange={e => onChange({ birthDate: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
            </div>

            {isMinor && (
                <div className="space-y-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-start gap-2.5">
                        <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-800 leading-relaxed">
                            {t('onboarding.athlete.minorNotice')}
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                {t('onboarding.athlete.guardianNameLabel')}
                            </label>
                            <input
                                type="text"
                                value={values.guardianName}
                                onChange={e => onChange({ guardianName: e.target.value })}
                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                {t('onboarding.athlete.guardianPhoneLabel')}
                            </label>
                            <input
                                type="tel"
                                value={values.guardianPhone}
                                onChange={e => onChange({ guardianPhone: e.target.value })}
                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>
                    </div>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={values.guardianConsent}
                            onChange={e => onChange({ guardianConsent: e.target.checked })}
                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <span className="text-xs text-slate-700 leading-relaxed">
                            {t('onboarding.athlete.guardianConsentLabel')}
                        </span>
                    </label>
                </div>
            )}

            <p className="text-xs text-slate-400">{t('onboarding.athlete.hint')}</p>
        </div>
    );
};

export default StepAthlete;
