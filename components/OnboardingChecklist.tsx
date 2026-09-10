import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, X, Rocket, HelpCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTenant } from '../contexts/TenantContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { ModuleKey } from '../services/featureFlagService';
import {
    getOnboardingCounts, buildChecklist, readOnboardingState, saveOnboardingState,
    OnboardingCounts,
} from '../services/onboardingService';
import HowAuraWorks from './onboarding/HowAuraWorks';

// Items whose destination is behind a plan module — hidden when it is locked, so
// the checklist never asks for something the club cannot do.
const ITEM_FEATURE: Record<string, ModuleKey | undefined> = {
    'first-athlete': 'athletes',
    'first-enrollment': 'enrollments',
};

interface Props {
    totalAthletes: number;
    totalEnrollments: number;
}

const OnboardingChecklist: React.FC<Props> = ({ totalAthletes, totalEnrollments }) => {
    const { t } = useLanguage();
    const { currentTenant, refreshTenants } = useTenant();
    const { hasFeature } = useSubscription();

    const [counts, setCounts] = useState<OnboardingCounts | null>(null);
    const [showFlow, setShowFlow] = useState(false);
    const [dismissing, setDismissing] = useState(false);

    useEffect(() => {
        if (!currentTenant?.id) return;
        getOnboardingCounts(currentTenant.id)
            .then(setCounts)
            .catch(err => console.error('Error loading onboarding counts:', err));
    }, [currentTenant?.id]);

    if (!currentTenant || !counts) return null;
    if (readOnboardingState(currentTenant).checklist_dismissed) return null;

    const items = buildChecklist({ tenant: currentTenant, counts, totalAthletes, totalEnrollments })
        .filter(item => {
            const feature = ITEM_FEATURE[item.id];
            return !feature || hasFeature(feature);
        });

    const done = items.filter(i => i.done).length;
    // Nothing left to nudge about.
    if (done === items.length) return null;

    const percent = Math.round((done / items.length) * 100);

    const dismiss = async () => {
        setDismissing(true);
        try {
            await saveOnboardingState(currentTenant, { checklist_dismissed: true });
            await refreshTenants();
        } catch (err) {
            console.error('Error dismissing checklist:', err);
            setDismissing(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
            <div className="p-5 pb-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Rocket className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold text-slate-800">{t('onboarding.checklist.title')}</h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {t('onboarding.checklist.progress')
                                    .replace('{done}', String(done))
                                    .replace('{total}', String(items.length))}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={dismiss}
                        disabled={dismissing}
                        title={t('onboarding.checklist.dismiss')}
                        className="p-1.5 text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-4">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </div>

            <div className="divide-y divide-slate-100 border-t border-slate-100">
                {items.map(item => (
                    <Link
                        key={item.id}
                        to={item.to}
                        className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                            item.done ? 'bg-slate-50/60' : 'hover:bg-slate-50'
                        }`}
                    >
                        <span className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center border-2 ${
                            item.done ? 'bg-green-500 border-green-500' : 'border-slate-300'
                        }`}>
                            {item.done && <Check className="w-3 h-3 text-white" />}
                        </span>
                        <span className={`text-sm flex-1 min-w-0 ${
                            item.done ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'
                        }`}>
                            {t(item.labelKey)}
                        </span>
                        {!item.done && <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />}
                    </Link>
                ))}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                <button
                    onClick={() => setShowFlow(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-dark transition-colors"
                >
                    <HelpCircle className="w-3.5 h-3.5" />
                    {showFlow ? t('onboarding.checklist.hideFlow') : t('onboarding.checklist.showFlow')}
                </button>
                {showFlow && (
                    <div className="mt-4">
                        <HowAuraWorks linked />
                    </div>
                )}
            </div>
        </div>
    );
};

export default OnboardingChecklist;
