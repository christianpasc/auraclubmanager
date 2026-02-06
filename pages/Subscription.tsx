
import React from 'react';
import { CheckCircle2, CreditCard, Clock, History, Zap } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const Subscription: React.FC = () => {
  const { t, language } = useLanguage();

  const getFeatures = () => {
    if (language === 'en-US') {
      return ['Unlimited athletes', 'Complete financial management', 'Performance reports', '24/7 priority support', 'Training module'];
    }
    if (language === 'es-ES') {
      return ['Atletas ilimitados', 'Gestión financiera completa', 'Informes de rendimiento', 'Soporte prioritario 24/7', 'Módulo de entrenamientos'];
    }
    return ['Atletas ilimitados', 'Gestão financeira completa', 'Relatórios de desempenho', 'Suporte prioritário 24/7', 'Módulo de treinamentos'];
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-gradient-to-r from-primary to-blue-700 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-amber-300 fill-amber-300" />
            <span className="text-sm font-bold uppercase tracking-widest opacity-80">{t('subscription.currentPlan')}</span>
          </div>
          <h2 className="text-3xl font-bold mb-4">Aura Club Pro</h2>
          <p className="text-blue-100 max-w-md mb-6">
            {language === 'en-US'
              ? 'You are using all advanced features for athlete and competition management.'
              : language === 'es-ES'
                ? 'Estás utilizando todas las funciones avanzadas para la gestión de atletas y competiciones.'
                : 'Você está utilizando todos os recursos avançados para gestão de atletas e competições.'}
          </p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-200" />
              <span className="text-sm font-semibold">
                {language === 'en-US' ? 'Renewal' : language === 'es-ES' ? 'Renovación' : 'Renovação'}: 27/10/2023
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-200" />
              <span className="text-sm font-semibold">**** 4421 (Visa)</span>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            {language === 'en-US' ? 'Included Features' : language === 'es-ES' ? 'Recursos Incluidos' : 'Recursos Inclusos'}
          </h3>
          <ul className="space-y-4">
            {getFeatures().map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <History className="w-5 h-5 text-slate-400" />
            {language === 'en-US' ? 'Invoice History' : language === 'es-ES' ? 'Historial de Facturas' : 'Histórico de Faturas'}
          </h3>
          <div className="space-y-4">
            {[
              { date: 'Set 2023', val: 'R$ 149,90', status: language === 'en-US' ? 'Paid' : language === 'es-ES' ? 'Pagado' : 'Pago' },
              { date: 'Ago 2023', val: 'R$ 149,90', status: language === 'en-US' ? 'Paid' : language === 'es-ES' ? 'Pagado' : 'Pago' },
              { date: 'Jul 2023', val: 'R$ 149,90', status: language === 'en-US' ? 'Paid' : language === 'es-ES' ? 'Pagado' : 'Pago' },
            ].map((f, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-bold text-slate-800">{f.date}</p>
                  <p className="text-xs text-slate-400">{f.val}</p>
                </div>
                <span className="text-[10px] font-bold bg-green-50 text-green-600 px-2 py-1 rounded uppercase tracking-wider">{f.status}</span>
              </div>
            ))}
          </div>
          <button className="w-full mt-6 py-2.5 bg-slate-50 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors">
            {language === 'en-US' ? 'View all invoices' : language === 'es-ES' ? 'Ver todas las facturas' : 'Ver todas as faturas'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Subscription;
