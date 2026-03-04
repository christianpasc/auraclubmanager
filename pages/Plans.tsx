
import React, { useState, useEffect } from 'react';
import { Check, Crown, Zap, Building2, AlertTriangle, Loader2, Infinity, CheckCircle2, XCircle, Users, UserCheck } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useTenant } from '../contexts/TenantContext';
import { subscriptionService } from '../services/subscriptionService';
import { adminPlanService, StripePlan } from '../services/adminPlanService';
import { stripeConfig, createCheckoutSession } from '../lib/stripe';

type IntervalFilter = 'monthly' | 'quarterly' | 'yearly' | 'lifetime' | 'all';

const INTERVAL_ICONS: Record<string, React.ReactNode> = {
    monthly: <Zap className="w-6 h-6" />,
    quarterly: <Crown className="w-6 h-6" />,
    yearly: <Building2 className="w-6 h-6" />,
    lifetime: <Infinity className="w-6 h-6" />,
};

/** Format a price according to its currency code */
const formatPrice = (price: number, currency: string, locale: string): string => {
    const currencyMap: Record<string, string> = {
        brl: 'BRL',
        usd: 'USD',
        eur: 'EUR',
    };
    const resolvedCurrency = currencyMap[(currency || 'brl').toLowerCase()] || 'BRL';

    const localeMap: Record<string, string> = {
        'pt-BR': 'pt-BR',
        'pt-PT': 'pt-PT',
        'en-US': 'en-US',
        'es-ES': 'es-ES',
        'fr-FR': 'fr-FR',
    };
    const resolvedLocale = localeMap[locale] || 'pt-BR';

    return new Intl.NumberFormat(resolvedLocale, {
        style: 'currency',
        currency: resolvedCurrency,
        minimumFractionDigits: 2,
    }).format(price);
};

const Plans: React.FC = () => {
    const { language } = useLanguage();
    const { subscriptionInfo, refreshSubscription } = useSubscription();
    const { currentTenant } = useTenant();
    const [plans, setPlans] = useState<StripePlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [subscribing, setSubscribing] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [intervalFilter, setIntervalFilter] = useState<IntervalFilter>('monthly');

    const getText = (pt: string, en: string, es: string, fr?: string) => {
        if (language === 'en-US') return en;
        if (language === 'es-ES') return es;
        if (language === 'fr-FR') return fr || pt;
        return pt; // pt-BR and pt-PT
    };

    const getIntervalLabel = (interval: string) => {
        const labels: Record<string, string> = {
            monthly: getText('/mês', '/month', '/mes', '/mois'),
            quarterly: getText('/trimestre', '/quarter', '/trimestre', '/trimestre'),
            yearly: getText('/ano', '/year', '/año', '/an'),
            lifetime: getText(' (único)', ' (one-time)', ' (único)', ' (unique)'),
        };
        return labels[interval] || '';
    };

    // Interval filter labels translated
    const intervalLabels: Record<IntervalFilter, string> = {
        all: getText('Todos', 'All', 'Todos', 'Tous'),
        monthly: getText('Mensal', 'Monthly', 'Mensual', 'Mensuel'),
        quarterly: getText('Trimestral', 'Quarterly', 'Trimestral', 'Trimestriel'),
        yearly: getText('Anual', 'Annual', 'Anual', 'Annuel'),
        lifetime: getText('Vitalício', 'Lifetime', 'Vitalicio', 'À vie'),
    };

    // Discount badges for quarterly and yearly
    const intervalDiscount: Partial<Record<IntervalFilter, string>> = {
        quarterly: getText('10% de desconto', '10% off', '10% de descuento', '10% de réduction'),
        yearly: getText('20% de desconto', '20% off', '20% de descuento', '20% de réduction'),
    };

    // Check for success/cancel URL params (from Stripe redirect)
    useEffect(() => {
        const hash = window.location.hash;
        if (hash.includes('success=true')) {
            setSuccessMessage(getText(
                'Pagamento realizado com sucesso! Sua assinatura foi ativada.',
                'Payment successful! Your subscription has been activated.',
                '¡Pago realizado con éxito! Su suscripción ha sido activada.'
            ));
            refreshSubscription();
            window.location.hash = '#/plans';
        } else if (hash.includes('canceled=true')) {
            setErrorMessage(getText(
                'Pagamento cancelado. Você pode tentar novamente a qualquer momento.',
                'Payment canceled. You can try again at any time.',
                'Pago cancelado. Puede intentarlo de nuevo en cualquier momento.'
            ));
            window.location.hash = '#/plans';
        }
    }, []);

    useEffect(() => {
        const loadPlans = async () => {
            try {
                const data = await adminPlanService.getActivePlans();
                setPlans(data);

                // Auto-select the first interval that has plans
                const intervals: IntervalFilter[] = ['monthly', 'quarterly', 'yearly', 'lifetime'];
                for (const iv of intervals) {
                    if (data.some((p) => p.interval === iv)) {
                        setIntervalFilter(iv);
                        break;
                    }
                }
            } catch (err) {
                console.error('Error loading plans:', err);
            } finally {
                setLoading(false);
            }
        };
        loadPlans();
    }, []);

    const handleSubscribe = async (plan: StripePlan) => {
        if (!currentTenant?.id) {
            alert(getText('Erro: Nenhum clube selecionado', 'Error: No club selected', 'Error: Ningún club seleccionado'));
            return;
        }

        const priceId = stripeConfig.getPriceId(plan);

        if (!priceId) {
            try {
                setSubscribing(plan.id!);
                await subscriptionService.activateSubscription(currentTenant.id, plan.id!, plan.interval);
                await refreshSubscription();
                setSuccessMessage(getText(
                    'Plano ativado com sucesso! (Simulação - sem Stripe Price ID configurado)',
                    'Plan activated successfully! (Simulation - no Stripe Price ID configured)',
                    '¡Plan activado con éxito! (Simulación - sin Stripe Price ID configurado)'
                ));
            } catch (error: any) {
                setErrorMessage(error.message || getText('Erro ao ativar plano', 'Error activating plan', 'Error al activar plan'));
            } finally {
                setSubscribing(null);
            }
            return;
        }

        try {
            setSubscribing(plan.id!);
            setErrorMessage(null);
            const result = await createCheckoutSession(plan.id!, currentTenant.id);
            if (result?.url) {
                window.location.href = result.url;
            } else {
                throw new Error('No checkout URL returned');
            }
        } catch (error: any) {
            setErrorMessage(error.message || getText(
                'Erro ao criar sessão de pagamento. Tente novamente.',
                'Error creating payment session. Please try again.',
                'Error al crear la sesión de pago. Inténtelo de nuevo.'
            ));
            setSubscribing(null);
        }
    };

    // Determine which interval tabs to show (only those that have at least one plan)
    const availableIntervals = (['monthly', 'quarterly', 'yearly', 'lifetime'] as IntervalFilter[]).filter(
        (iv) => plans.some((p) => p.interval === iv)
    );

    const filteredPlans = plans.filter((p) => p.interval === intervalFilter);

    const isTrialExpired = subscriptionInfo?.subscriptionStatus === 'expired';

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
            {/* Success Message */}
            {successMessage && (
                <div className="mb-8 p-6 bg-green-50 border border-green-200 rounded-2xl flex items-start gap-4">
                    <div className="p-3 bg-green-100 rounded-xl">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-green-800 text-lg">{getText('Sucesso!', 'Success!', '¡Éxito!')}</h3>
                        <p className="text-green-700 mt-1">{successMessage}</p>
                    </div>
                    <button onClick={() => setSuccessMessage(null)} className="text-green-400 hover:text-green-600">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Error Message */}
            {errorMessage && (
                <div className="mb-8 p-6 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-4">
                    <div className="p-3 bg-red-100 rounded-xl">
                        <XCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <div className="flex-1">
                        <p className="text-red-700">{errorMessage}</p>
                    </div>
                    <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-600">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Trial Expired Warning */}
            {isTrialExpired && (
                <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4">
                    <div className="p-3 bg-amber-100 rounded-xl">
                        <AlertTriangle className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-amber-800 text-lg">
                            {getText('Seu período de teste expirou', 'Your trial period has expired', 'Su período de prueba ha expirado')}
                        </h3>
                        <p className="text-amber-700 mt-1">
                            {getText(
                                'Escolha um plano abaixo para continuar usando o Aura Club Manager.',
                                'Choose a plan below to continue using Aura Club Manager.',
                                'Elija un plan a continuación para continuar usando Aura Club Manager.'
                            )}
                        </p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-slate-800 mb-3">
                    {getText('Escolha seu plano', 'Choose your plan', 'Elija su plan')}
                </h1>
                <p className="text-slate-500 max-w-2xl mx-auto mb-4">
                    {getText(
                        'Selecione o plano ideal para o seu clube e desbloqueie todo o potencial do Aura Club Manager.',
                        'Select the ideal plan for your club and unlock the full potential of Aura Club Manager.',
                        'Seleccione el plan ideal para su club y desbloquee todo el potencial de Aura Club Manager.'
                    )}
                </p>
                {!stripeConfig.isProduction && (
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                        🟡 {getText('Modo Teste', 'Test Mode', 'Modo de Prueba')}
                    </span>
                )}
            </div>

            {/* Interval Filter Tabs */}
            {availableIntervals.length > 1 && (
                <div className="flex justify-center mb-10">
                    <div className="inline-flex items-center bg-slate-100 rounded-2xl p-1.5 gap-1 shadow-inner">
                        {availableIntervals.map((iv) => {
                            const isActive = intervalFilter === iv;
                            const discount = intervalDiscount[iv];
                            return (
                                <button
                                    key={iv}
                                    onClick={() => setIntervalFilter(iv)}
                                    className={`relative flex flex-col items-center px-5 rounded-xl text-sm font-semibold transition-all duration-200 ${discount ? 'pt-2.5 pb-3' : 'py-2.5'
                                        } ${isActive
                                            ? 'bg-white text-primary shadow-md shadow-slate-200 scale-[1.02]'
                                            : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                                        }`}
                                >
                                    <span>{intervalLabels[iv]}</span>
                                    {discount && (
                                        <span className={`text-[10px] font-bold mt-0.5 px-1.5 py-0.5 rounded-full ${isActive
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-green-50 text-green-600'
                                            }`}>
                                            {discount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Plans Grid */}
            {filteredPlans.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-slate-400">
                        {getText(
                            'Nenhum plano disponível para este período.',
                            'No plans available for this period.',
                            'Ningún plan disponible para este período.'
                        )}
                    </p>
                </div>
            ) : (
                <div className={`grid grid-cols-1 ${filteredPlans.length === 1 ? 'max-w-md mx-auto' :
                    filteredPlans.length === 2 ? 'md:grid-cols-2 max-w-3xl mx-auto' :
                        filteredPlans.length >= 4 ? 'md:grid-cols-2 lg:grid-cols-4' :
                            'md:grid-cols-3'
                    } gap-8`}>
                    {filteredPlans.map((plan) => (
                        <div
                            key={plan.id}
                            className={`relative bg-white rounded-2xl border-2 p-8 transition-all hover:shadow-xl ${plan.is_popular
                                ? 'border-primary shadow-lg scale-105'
                                : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            {plan.is_popular && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-sm font-bold rounded-full">
                                    {getText('Mais Popular', 'Most Popular', 'Más Popular')}
                                </div>
                            )}

                            <div className={`inline-flex p-3 rounded-xl mb-4 ${plan.is_popular ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-600'}`}>
                                {INTERVAL_ICONS[plan.interval] || <Zap className="w-6 h-6" />}
                            </div>

                            <h3 className="text-xl font-bold text-slate-800 mb-2">{plan.name}</h3>
                            {plan.description && (
                                <p className="text-sm text-slate-500 mb-3">{plan.description}</p>
                            )}

                            {/* Price with dynamic currency */}
                            <div className="flex items-baseline gap-1 mb-6">
                                <span className="text-3xl font-bold text-slate-800">
                                    {formatPrice(Number(plan.price), (plan as any).currency || 'brl', language)}
                                </span>
                                <span className="text-slate-500 text-sm">{getIntervalLabel(plan.interval)}</span>
                            </div>

                            {/* Features */}
                            <ul className="space-y-3 mb-4">
                                {(() => {
                                    const orgType = currentTenant?.organization_type || 'school';
                                    const parseFeatures = (f: any) => typeof f === 'string' ? JSON.parse(f) : (f || []);
                                    const typeFeatures = orgType === 'club' ? parseFeatures(plan.features_club) : parseFeatures(plan.features_school);
                                    const genericFeatures = parseFeatures(plan.features);
                                    const displayFeatures = typeFeatures.length > 0 ? typeFeatures : genericFeatures;
                                    return displayFeatures.map((feature: string, i: number) => (
                                        <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                                            <Check className={`w-5 h-5 flex-shrink-0 ${plan.is_popular ? 'text-primary' : 'text-green-500'}`} />
                                            {feature}
                                        </li>
                                    ));
                                })()}
                            </ul>

                            {/* Plan Limits */}
                            <div className="flex flex-col gap-2 mb-6 p-3 bg-slate-50 rounded-xl">
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Users className="w-4 h-4 text-slate-400" />
                                    <span>
                                        {(plan as any).max_users === null || (plan as any).max_users === undefined
                                            ? getText('Usuários ilimitados', 'Unlimited users', 'Usuarios ilimitados')
                                            : getText(`Até ${(plan as any).max_users} usuários`, `Up to ${(plan as any).max_users} users`, `Hasta ${(plan as any).max_users} usuarios`)
                                        }
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <UserCheck className="w-4 h-4 text-slate-400" />
                                    <span>
                                        {(plan as any).max_athletes === null || (plan as any).max_athletes === undefined
                                            ? getText('Atletas ilimitados', 'Unlimited athletes', 'Atletas ilimitados')
                                            : getText(`Até ${(plan as any).max_athletes} atletas`, `Up to ${(plan as any).max_athletes} athletes`, `Hasta ${(plan as any).max_athletes} atletas`)
                                        }
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={() => handleSubscribe(plan)}
                                disabled={subscribing === plan.id}
                                className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${plan.is_popular
                                    ? 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/30'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    } disabled:opacity-50`}
                            >
                                {subscribing === plan.id && <Loader2 className="w-4 h-4 animate-spin" />}
                                {getText('Assinar Agora', 'Subscribe Now', 'Suscribirse Ahora')}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Footer */}
            <div className="mt-16 text-center">
                <p className="text-slate-500">
                    {getText(
                        'Tem dúvidas? Entre em contato conosco pelo email suporte@auraclub.com',
                        'Have questions? Contact us at support@auraclub.com',
                        '¿Tiene preguntas? Contáctenos en soporte@auraclub.com'
                    )}
                </p>
            </div>
        </div>
    );
};

export default Plans;
