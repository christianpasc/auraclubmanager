
import React from 'react';
import { Check, Crown, Zap, Building2, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useTenant } from '../contexts/TenantContext';
import { subscriptionService } from '../services/subscriptionService';

interface Plan {
    id: string;
    name: string;
    price: number;
    period: string;
    features: string[];
    popular?: boolean;
    icon: React.ReactNode;
}

const Plans: React.FC = () => {
    const { language } = useLanguage();
    const { subscriptionInfo, refreshSubscription } = useSubscription();
    const { currentTenant } = useTenant();

    const getText = (pt: string, en: string, es: string) => {
        return language === 'en-US' ? en : language === 'es-ES' ? es : pt;
    };

    const plans: Plan[] = [
        {
            id: 'basic',
            name: getText('Básico', 'Basic', 'Básico'),
            price: 49.90,
            period: getText('/mês', '/month', '/mes'),
            icon: <Zap className="w-6 h-6" />,
            features: [
                getText('Até 50 atletas', 'Up to 50 athletes', 'Hasta 50 atletas'),
                getText('Gestão de treinos', 'Training management', 'Gestión de entrenamientos'),
                getText('Controle financeiro básico', 'Basic financial control', 'Control financiero básico'),
                getText('Suporte por email', 'Email support', 'Soporte por email'),
            ],
        },
        {
            id: 'pro',
            name: 'Pro',
            price: 99.90,
            period: getText('/mês', '/month', '/mes'),
            icon: <Crown className="w-6 h-6" />,
            popular: true,
            features: [
                getText('Até 200 atletas', 'Up to 200 athletes', 'Hasta 200 atletas'),
                getText('Gestão completa de treinos', 'Complete training management', 'Gestión completa de entrenamientos'),
                getText('Controle financeiro avançado', 'Advanced financial control', 'Control financiero avanzado'),
                getText('Relatórios de desempenho', 'Performance reports', 'Informes de rendimiento'),
                getText('Suporte prioritário', 'Priority support', 'Soporte prioritario'),
                getText('Competições e jogos', 'Competitions and games', 'Competiciones y juegos'),
            ],
        },
        {
            id: 'enterprise',
            name: 'Enterprise',
            price: 199.90,
            period: getText('/mês', '/month', '/mes'),
            icon: <Building2 className="w-6 h-6" />,
            features: [
                getText('Atletas ilimitados', 'Unlimited athletes', 'Atletas ilimitados'),
                getText('Todas as funcionalidades Pro', 'All Pro features', 'Todas las funcionalidades Pro'),
                getText('Multi-unidade', 'Multi-unit', 'Multi-unidad'),
                getText('API personalizada', 'Custom API', 'API personalizada'),
                getText('Suporte 24/7', '24/7 support', 'Soporte 24/7'),
                getText('Gerente de conta dedicado', 'Dedicated account manager', 'Gerente de cuenta dedicado'),
            ],
        },
    ];

    const handleSubscribe = async (planId: string) => {
        if (!currentTenant?.id) {
            alert(getText('Erro: Nenhum clube selecionado', 'Error: No club selected', 'Error: Ningún club seleccionado'));
            return;
        }

        try {
            await subscriptionService.updateSubscription(currentTenant.id, planId);
            await refreshSubscription();
            // In a real app, this would redirect to a payment gateway
            alert(getText(
                'Plano ativado com sucesso! (Simulação)',
                'Plan activated successfully! (Simulation)',
                '¡Plan activado con éxito! (Simulación)'
            ));
        } catch (error) {
            console.error('Error subscribing:', error);
            alert(getText(
                'Erro ao ativar plano',
                'Error activating plan',
                'Error al activar plan'
            ));
        }
    };


    const isTrialExpired = subscriptionInfo?.subscriptionStatus === 'expired';

    return (
        <div className="max-w-6xl mx-auto">
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
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {plans.map((plan) => (
                    <div
                        key={plan.id}
                        className={`relative bg-white rounded-2xl border-2 p-8 transition-all hover:shadow-xl ${plan.popular
                            ? 'border-primary shadow-lg scale-105'
                            : 'border-slate-200 hover:border-slate-300'
                            }`}
                    >
                        {plan.popular && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-sm font-bold rounded-full">
                                {getText('Mais Popular', 'Most Popular', 'Más Popular')}
                            </div>
                        )}

                        <div className={`inline-flex p-3 rounded-xl mb-4 ${plan.popular ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-600'
                            }`}>
                            {plan.icon}
                        </div>

                        <h3 className="text-xl font-bold text-slate-800 mb-2">{plan.name}</h3>
                        <div className="flex items-baseline gap-1 mb-6">
                            <span className="text-3xl font-bold text-slate-800">
                                R$ {plan.price.toFixed(2).replace('.', ',')}
                            </span>
                            <span className="text-slate-500">{plan.period}</span>
                        </div>

                        <ul className="space-y-3 mb-8">
                            {plan.features.map((feature, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                                    <Check className={`w-5 h-5 flex-shrink-0 ${plan.popular ? 'text-primary' : 'text-green-500'
                                        }`} />
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <button
                            onClick={() => handleSubscribe(plan.id)}
                            className={`w-full py-3 rounded-xl font-bold transition-all ${plan.popular
                                ? 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/30'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                        >
                            {getText('Assinar Agora', 'Subscribe Now', 'Suscribirse Ahora')}
                        </button>
                    </div>
                ))}
            </div>

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
