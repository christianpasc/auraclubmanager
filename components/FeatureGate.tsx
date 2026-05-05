
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowUpCircle } from 'lucide-react';
import { ModuleKey } from '../services/featureFlagService';
import { useSubscription } from '../contexts/SubscriptionContext';

interface Props {
    feature: ModuleKey;
    children: React.ReactNode;
    planName?: string | null;
}

const FeatureGate: React.FC<Props> = ({ feature, children, planName }) => {
    const { hasFeature, subscriptionInfo } = useSubscription();
    const navigate = useNavigate();

    if (hasFeature(feature)) {
        return <>{children}</>;
    }

    const displayPlan = planName || 'Pro';

    return (
        <div className="relative">
            {/* Dimmed, non-interactive content preview */}
            <div className="pointer-events-none select-none opacity-30" aria-hidden>
                {children}
            </div>

            {/* Lock overlay */}
            <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-xl px-8 py-7 flex flex-col items-center text-center max-w-xs mx-4">
                    <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
                        <Lock className="w-7 h-7 text-indigo-600" />
                    </div>
                    <p className="text-sm font-bold text-slate-800 mb-1">
                        Funcionalidade bloqueada
                    </p>
                    <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                        Este módulo está disponível apenas no plano <span className="font-semibold text-indigo-600">{displayPlan}</span>.
                        Faça um upgrade para desbloquear.
                    </p>
                    <button
                        onClick={() => navigate('/subscription')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <ArrowUpCircle className="w-4 h-4" />
                        Fazer Upgrade
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FeatureGate;
