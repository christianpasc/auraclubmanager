
import React, { useState, useEffect } from 'react';
import { Check, Crown, Zap, Building2, AlertTriangle, Loader2, Infinity, CheckCircle2, XCircle, Users, UserCheck } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useTenant } from '../contexts/TenantContext';
import { subscriptionService } from '../services/subscriptionService';
import { adminPlanService, StripePlan } from '../services/adminPlanService';
import { stripeConfig, createCheckoutSession } from '../lib/stripe';

const INTERVAL_ICONS: Record<string, React.ReactNode> = {
    monthly: <Zap className="w-6 h-6" />,
    quarterly: <Crown className="w-6 h-6" />,
    yearly: <Building2 className="w-6 h-6" />,
    lifetime: <Infinity className="w-6 h-6" />,
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

    const getText = (pt: string, en: string, es: string) => {
        return language === 'en-US' ? en : language === 'es-ES' ? es : pt;
    };

    const getIntervalLabel = (interval: string) => {
        const labels: Record<string, string> = {
            monthly: getText('/mês', '/month', '/mes'),
            quarterly: getText('/trimestre', '/quarter', '/trimestre'),
            yearly: getText('/ano', '/year', '/año'),
            lifetime: getText(' (único)', ' (one-time)', ' (único)'),
        };
        return labels[interval] || '';
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
            // Clean URL
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
            // No Stripe Price ID configured — simulate activation for testing
            try {
                setSubscribing(plan.id!);
                await subscriptionService.activateSubscription(
                    currentTenant.id,
                    plan.id!,
                    plan.interval
                );
                await refreshSubscription();
                setSuccessMessage(getText(
                    'Plano ativado com sucesso! (Simulação - sem Stripe Price ID configurado)',
                    'Plan activated successfully! (Simulation - no Stripe Price ID configured)',
                    '¡Plan activado con éxito! (Simulación - sin Stripe Price ID configurado)'
                ));
            } catch (error: any) {
                console.error('Error subscribing:', error);
                setErrorMessage(error.message || getText('Erro ao ativar plano', 'Error activating plan', 'Error al activar plan'));
            } finally {
                setSubscribing(null);
            }
            return;
        }

        // Redirect to Stripe Checkout
        try {
            setSubscribing(plan.id!);
            setErrorMessage(null);

            const result = await createCheckoutSession(plan.id!, currentTenant.id);

            if (result?.url) {
                // Redirect to Stripe Checkout
                window.location.href = result.url;
            } else {
                throw new Error('No checkout URL returned');
            }
        } catch (error: any) {
            console.error('Error creating checkout:', error);
            setErrorMessage(
                error.message || getText(
                    'Erro ao criar sessão de pagamento. Tente novamente.',
                    'Error creating payment session. Please try again.',
                    'Error al crear la sesión de pago. Inténtelo de nuevo.'
                )
            );
            setSubscribing(null);
        }
    };

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
                        <h3 className="font-bold text-green-800 text-lg">
                            {getText('Sucesso!', 'Success!', '¡Éxito!')}
                        </h3>
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
                            {getText(
                                'Seu período de teste expirou',
                                'Your trial period has expired',
                                'Su período de prueba ha expirado'
                            )}
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
            <div className="text-center mb-12">
                <h1 className="text-3xl font-bold text-slate-800 mb-4">
                    {getText('Escolha seu plano', 'Choose your plan', 'Elija su plan')}
                </h1>
                <p className="text-slate-500 max-w-2xl mx-auto">
                    {getText(
                        'Selecione o plano ideal para o seu clube e desbloqueie todo o potencial do Aura Club Manager.',
                        'Select the ideal plan for your club and unlock the full potential of Aura Club Manager.',
                        'Seleccione el plan ideal para su club y desbloquee todo el potencial de Aura Club Manager.'
                    )}
                </p>
                {!stripeConfig.isProduction && (
                    <span className="inline-block mt-3 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                        🟡 Modo Teste
                    </span>
                )}
            </div>

            {/* Plans Grid */}
            {plans.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-slate-400">
                        {getText(
                            'Nenhum plano disponível no momento.',
                            'No plans available at this time.',
                            'Ningún plan disponible en este momento.'
                        )}
                    </p>
                </div>
            ) : (
                <div className={`grid grid-cols-1 ${plans.length === 1 ? 'max-w-md mx-auto' : plans.length === 2 ? 'md:grid-cols-2 max-w-3xl mx-auto' : plans.length >= 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'} gap-8`}>
                    {plans.map((plan) => (
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

                            <div className={`inline-flex p-3 rounded-xl mb-4 ${plan.is_popular ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-600'
                                }`}>
                                {INTERVAL_ICONS[plan.interval] || <Zap className="w-6 h-6" />}
                            </div>

                            <h3 className="text-xl font-bold text-slate-800 mb-2">{plan.name}</h3>
                            {plan.description && (
                                <p className="text-sm text-slate-500 mb-3">{plan.description}</p>
                            )}
                            <div className="flex items-baseline gap-1 mb-6">
                                <span className="text-3xl font-bold text-slate-800">
                                    R$ {Number(plan.price).toFixed(2).replace('.', ',')}
                                </span>
                                <span className="text-slate-500">{getIntervalLabel(plan.interval)}</span>
                            </div>

                            <ul className="space-y-3 mb-4">
                                {(typeof plan.features === 'string' ? JSON.parse(plan.features) : (plan.features || [])).map((feature: string, i: number) => (
                                    <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                                        <Check className={`w-5 h-5 flex-shrink-0 ${plan.is_popular ? 'text-primary' : 'text-green-500'
                                            }`} />
                                        {feature}
                                    </li>
                                ))}
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

            {/* FAQ Section */}
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
