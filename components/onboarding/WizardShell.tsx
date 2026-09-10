import React from 'react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import logoImg from '../../assets/logo.png?v=2';
import { useLanguage } from '../../contexts/LanguageContext';

interface WizardShellProps {
    /** 0-based index of the active step. */
    stepIndex: number;
    totalSteps: number;
    title: string;
    subtitle: string;
    children: React.ReactNode;
    onBack?: () => void;
    onSkip?: () => void;
    onNext: () => void;
    nextLabel?: string;
    nextDisabled?: boolean;
    loading?: boolean;
    error?: string | null;
}

const WizardShell: React.FC<WizardShellProps> = ({
    stepIndex, totalSteps, title, subtitle, children,
    onBack, onSkip, onNext, nextLabel, nextDisabled, loading, error,
}) => {
    const { t } = useLanguage();
    const percent = Math.round(((stepIndex + 1) / totalSteps) * 100);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                <div className="text-center mb-6">
                    <img
                        src={logoImg}
                        alt="Aura Club Manager"
                        className="mx-auto mb-1"
                        style={{ width: '220px', height: 'auto' }}
                    />
                </div>

                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                    {/* Progress */}
                    <div className="px-8 pt-7">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-primary">
                                {t('onboarding.stepCounter')
                                    .replace('{current}', String(stepIndex + 1))
                                    .replace('{total}', String(totalSteps))}
                            </span>
                            <span className="text-xs font-semibold text-slate-400">{percent}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all duration-500"
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                    </div>

                    {/* Header */}
                    <div className="px-8 pt-6">
                        <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
                        <p className="text-slate-500 mt-1">{subtitle}</p>
                    </div>

                    {error && (
                        <div className="mx-8 mt-5 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    {/* Body */}
                    <div className="px-8 py-6">{children}</div>

                    {/* Footer */}
                    <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                        <div>
                            {onBack && (
                                <button
                                    type="button"
                                    onClick={onBack}
                                    disabled={loading}
                                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50 transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    {t('onboarding.back')}
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {onSkip && (
                                <button
                                    type="button"
                                    onClick={onSkip}
                                    disabled={loading}
                                    className="px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl disabled:opacity-50 transition-colors"
                                >
                                    {t('onboarding.skip')}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onNext}
                                disabled={loading || nextDisabled}
                                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-lg shadow-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {nextLabel || t('onboarding.continue')}
                                {!loading && <ArrowRight className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>

                <p className="text-center text-slate-500 text-sm mt-6">{t('auth.copyright')}</p>
            </div>
        </div>
    );
};

export default WizardShell;
