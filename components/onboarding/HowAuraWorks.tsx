import React from 'react';
import { Users, ClipboardList, Tag, Receipt, CreditCard, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTenant } from '../../contexts/TenantContext';

interface FlowStep {
    key: string;
    icon: React.ElementType;
    to: string;
}

// The core loop of the product. Everything else in the app hangs off this chain,
// so it is the one thing a first-time user has to understand.
const FLOW: FlowStep[] = [
    { key: 'athlete',    icon: Users,         to: '/athletes' },
    { key: 'enrollment', icon: ClipboardList, to: '/enrollments' },
    { key: 'plan',       icon: Tag,           to: '/school-plans' },
    { key: 'fee',        icon: Receipt,       to: '/finance/fees' },
    { key: 'payment',    icon: CreditCard,    to: '/finance' },
];

interface HowAuraWorksProps {
    /** When set, each card becomes a link. Off inside the wizard, where the app shell is not mounted yet. */
    linked?: boolean;
}

const HowAuraWorks: React.FC<HowAuraWorksProps> = ({ linked = false }) => {
    const { t } = useLanguage();
    const { isSchool } = useTenant();
    // School and club speak different words for the same entities ("aluno" vs "atleta").
    const variant = isSchool ? 'school' : 'club';

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-stretch gap-2">
                {FLOW.map((step, index) => {
                    const Icon = step.icon;
                    const label = t(`onboarding.flow.${variant}.${step.key}.label`);
                    const hint = t(`onboarding.flow.${variant}.${step.key}.hint`);
                    const card = (
                        <div className="h-full flex sm:flex-col items-center sm:items-start gap-3 sm:gap-2 p-3 rounded-xl border border-slate-200 bg-white hover:border-primary/40 transition-colors">
                            <div className="w-9 h-9 shrink-0 bg-primary/10 rounded-lg flex items-center justify-center">
                                <Icon className="w-4 h-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-800 leading-tight">{label}</p>
                                <p className="text-xs text-slate-500 mt-0.5 leading-snug">{hint}</p>
                            </div>
                        </div>
                    );

                    return (
                        <React.Fragment key={step.key}>
                            <div className="flex-1 min-w-0">
                                {linked
                                    ? <a href={`#${step.to}`} className="block h-full">{card}</a>
                                    : card}
                            </div>
                            {index < FLOW.length - 1 && (
                                <div className="flex items-center justify-center text-slate-300 shrink-0">
                                    <ArrowRight className="w-4 h-4 rotate-90 sm:rotate-0" />
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            <p className="text-sm text-slate-500 mt-5 leading-relaxed">
                {t(`onboarding.flow.${variant}.summary`)}
            </p>
        </div>
    );
};

export default HowAuraWorks;
