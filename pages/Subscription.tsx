
import React, { useState } from 'react';
import { CreditCard, Clock, Zap, ExternalLink, Loader2, AlertTriangle, Crown } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTenant } from '../contexts/TenantContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { createPortalSession, stripeConfig } from '../lib/stripe';
import { useNavigate } from 'react-router-dom';

const Subscription: React.FC = () => {
  const { language } = useLanguage();
  const { currentTenant } = useTenant();
  const { subscriptionInfo, loading: subLoading } = useSubscription();
  const navigate = useNavigate();
  const [portalLoading, setPortalLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getText = (pt: string, en: string, es: string) => {
    return language === 'en-US' ? en : language === 'es-ES' ? es : pt;
  };

  const handleManageSubscription = async () => {
    if (!currentTenant?.id) return;

    try {
      setPortalLoading(true);
      setErrorMessage(null);
      const result = await createPortalSession(currentTenant.id);
      if (result?.url) {
        window.location.href = result.url;
      }
    } catch (error: any) {
      console.error('Error opening portal:', error);
      setErrorMessage(error.message || getText(
        'Erro ao abrir portal de assinatura',
        'Error opening subscription portal',
        'Error al abrir el portal de suscripción'
      ));
    } finally {
      setPortalLoading(false);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'en-US' ? 'en-US' : language === 'es-ES' ? 'es-ES' : 'pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  if (subLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const isActive = subscriptionInfo?.subscriptionStatus === 'active';
  const isTrial = subscriptionInfo?.subscriptionStatus === 'trial';
  const isExpired = subscriptionInfo?.subscriptionStatus === 'expired';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Error message */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      {/* Subscription Header Card */}
      <div className={`rounded-2xl p-8 text-white shadow-xl relative overflow-hidden ${isActive ? 'bg-gradient-to-r from-primary to-blue-700' :
        isTrial ? 'bg-gradient-to-r from-amber-500 to-orange-600' :
          'bg-gradient-to-r from-slate-600 to-slate-800'
        }`}>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            {isActive ? (
              <Crown className="w-5 h-5 text-amber-300 fill-amber-300" />
            ) : isTrial ? (
              <Clock className="w-5 h-5 text-white" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-300" />
            )}
            <span className="text-sm font-bold uppercase tracking-widest opacity-80">
              {isActive
                ? getText('Plano Ativo', 'Active Plan', 'Plan Activo')
                : isTrial
                  ? getText('Período de Teste', 'Trial Period', 'Período de Prueba')
                  : getText('Assinatura Expirada', 'Subscription Expired', 'Suscripción Expirada')
              }
            </span>
          </div>

          <h2 className="text-3xl font-bold mb-4">
            {isActive && subscriptionInfo?.planName
              ? subscriptionInfo.planName
              : isActive
                ? 'Aura Club Pro'
                : isTrial
                  ? getText('Teste Gratuito', 'Free Trial', 'Prueba Gratuita')
                  : getText('Sem Plano', 'No Plan', 'Sin Plan')
            }
          </h2>

          <p className="text-white/80 max-w-md mb-6">
            {isActive
              ? getText(
                'Você possui acesso completo a todas as funcionalidades do Aura Club Manager.',
                'You have full access to all Aura Club Manager features.',
                'Tienes acceso completo a todas las funciones de Aura Club Manager.'
              )
              : isTrial
                ? getText(
                  `Seu período de teste termina em ${subscriptionInfo?.trialDaysRemaining} dias.`,
                  `Your trial ends in ${subscriptionInfo?.trialDaysRemaining} days.`,
                  `Su prueba termina en ${subscriptionInfo?.trialDaysRemaining} días.`
                )
                : getText(
                  'Seu período de acesso expirou. Assine um plano para continuar.',
                  'Your access period has expired. Subscribe to continue.',
                  'Su período de acceso ha expirado. Suscríbase para continuar.'
                )
            }
          </p>

          <div className="flex flex-wrap items-center gap-6">
            {isActive && subscriptionInfo?.subscriptionEndsAt && (
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-200" />
                <span className="text-sm font-semibold">
                  {getText('Válido até', 'Valid until', 'Válido hasta')}: {formatDate(subscriptionInfo.subscriptionEndsAt.toISOString())}
                </span>
              </div>
            )}
            {isTrial && subscriptionInfo?.trialEndsAt && (
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-white/80" />
                <span className="text-sm font-semibold">
                  {getText('Expira em', 'Expires on', 'Expira el')}: {formatDate(subscriptionInfo.trialEndsAt.toISOString())}
                </span>
              </div>
            )}

            {!stripeConfig.isProduction && (
              <span className="text-xs bg-white/20 px-3 py-1 rounded-full font-semibold">
                🧪 {getText('Modo Teste', 'Test Mode', 'Modo Prueba')}
              </span>
            )}
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Manage Subscription - Stripe Portal */}
        {isActive && (
          <button
            onClick={handleManageSubscription}
            disabled={portalLoading}
            className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all flex items-center gap-4 text-left group"
          >
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              {portalLoading ? (
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              ) : (
                <CreditCard className="w-6 h-6 text-primary" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-800">
                {getText('Gerenciar Assinatura', 'Manage Subscription', 'Gestionar Suscripción')}
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">
                {getText(
                  'Alterar plano, forma de pagamento ou cancelar',
                  'Change plan, payment method or cancel',
                  'Cambiar plan, método de pago o cancelar'
                )}
              </p>
            </div>
            <ExternalLink className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
          </button>
        )}

        {/* Choose a Plan */}
        {(isTrial || isExpired || !isActive) && (
          <button
            onClick={() => navigate('/plans')}
            className="bg-primary text-white rounded-xl p-6 shadow-sm hover:bg-primary/90 transition-all flex items-center gap-4 text-left group"
          >
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold">
                {getText('Escolher um Plano', 'Choose a Plan', 'Elegir un Plan')}
              </h3>
              <p className="text-sm text-white/80 mt-0.5">
                {getText(
                  'Veja os planos disponíveis e assine',
                  'View available plans and subscribe',
                  'Ver planes disponibles y suscribirse'
                )}
              </p>
            </div>
            <ExternalLink className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" />
          </button>
        )}

        {/* View Plans (even if active, to upgrade) */}
        {isActive && (
          <button
            onClick={() => navigate('/plans')}
            className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all flex items-center gap-4 text-left group"
          >
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center group-hover:bg-amber-100 transition-colors">
              <Zap className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-800">
                {getText('Ver Planos', 'View Plans', 'Ver Planes')}
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">
                {getText(
                  'Veja outros planos disponíveis',
                  'See other available plans',
                  'Ver otros planes disponibles'
                )}
              </p>
            </div>
            <ExternalLink className="w-5 h-5 text-slate-400 group-hover:text-amber-600 transition-colors" />
          </button>
        )}
      </div>

      {/* Subscription Details */}
      {isActive && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">
            {getText('Detalhes da Assinatura', 'Subscription Details', 'Detalles de la Suscripción')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">
                {getText('Plano', 'Plan', 'Plan')}
              </p>
              <p className="text-sm font-bold text-slate-800">
                {subscriptionInfo?.planName || '—'}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">
                {getText('Status', 'Status', 'Estado')}
              </p>
              <p className="text-sm font-bold text-green-600">
                ● {getText('Ativo', 'Active', 'Activo')}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">
                {getText('Início', 'Start Date', 'Fecha de Inicio')}
              </p>
              <p className="text-sm font-bold text-slate-800">
                {subscriptionInfo?.subscriptionEndsAt
                  ? formatDate(new Date(Date.now()).toISOString())
                  : '—'}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">
                {getText('Válido até', 'Valid Until', 'Válido Hasta')}
              </p>
              <p className="text-sm font-bold text-slate-800">
                {subscriptionInfo?.subscriptionEndsAt
                  ? formatDate(subscriptionInfo.subscriptionEndsAt.toISOString())
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscription;
