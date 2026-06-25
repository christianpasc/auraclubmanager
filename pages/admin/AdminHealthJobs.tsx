import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Activity, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface EdgeFunctionInfo {
    name: string;
    purpose: string;
    deployed: boolean;
}

const EDGE_FUNCTIONS: EdgeFunctionInfo[] = [
    { name: 'club-connect-onboard', purpose: 'Cria/conecta a conta Stripe Standard do clube (Account Links)', deployed: true },
    { name: 'club-webhook', purpose: 'Webhooks do Stripe Connect (pagamentos, assinaturas de clube → membro)', deployed: true },
    { name: 'club-checkout', purpose: 'Cria sessão de checkout para mensalidades e pedidos da loja', deployed: true },
    { name: 'club-sync-plan', purpose: 'Sincroniza um plano do Aura com Product/Price na conta do clube', deployed: true },
    { name: 'club-refund', purpose: 'Reembolsa um pagamento de mensalidade/pedido', deployed: true },
    { name: 'club-cancel-subscription', purpose: 'Cancela a assinatura recorrente de um responsável', deployed: true },
    { name: 'stripe-webhook', purpose: 'Webhooks da assinatura SaaS (clube → Aura)', deployed: true },
    { name: 'create-checkout', purpose: 'Checkout da assinatura SaaS do clube', deployed: true },
    { name: 'create-portal-session', purpose: 'Portal do cliente Stripe para o clube gerenciar a própria assinatura', deployed: true },
    { name: 'send-invoice-email', purpose: 'Envia e-mail de cobrança de mensalidade (Resend)', deployed: true },
    { name: 'send-invitations', purpose: 'Envia convites de evento por e-mail (Resend)', deployed: true },
    { name: 'send-lineup-notifications', purpose: 'Notifica atletas convocados para um jogo', deployed: true },
    { name: 'public-invoice-info', purpose: 'Dados públicos de uma fatura para a página de pagamento', deployed: true },
    { name: 'admin-integrations-status', purpose: 'Status de configuração de integrações externas (painel admin)', deployed: true },
];

const AdminHealthJobs: React.FC = () => {
    const [dbStatus, setDbStatus] = useState<'checking' | 'ok' | 'error'>('checking');
    const [latencyMs, setLatencyMs] = useState<number | null>(null);

    useEffect(() => {
        (async () => {
            const start = performance.now();
            try {
                const { error } = await supabase.from('tenants').select('id').limit(1);
                setLatencyMs(Math.round(performance.now() - start));
                setDbStatus(error ? 'error' : 'ok');
            } catch {
                setDbStatus('error');
            }
        })();
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Saúde & Jobs</h2>
                <p className="text-sm text-slate-500 mt-0.5">Monitoramento básico — não há fila de jobs real no projeto hoje.</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-700">Conectividade</h3>
                </div>
                <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-600">Banco de dados (Supabase)</span>
                    {dbStatus === 'checking' ? (
                        <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                    ) : dbStatus === 'ok' ? (
                        <span className="flex items-center gap-1.5 text-xs text-green-600 font-semibold">
                            <CheckCircle2 className="w-4 h-4" /> OK {latencyMs !== null && `(${latencyMs}ms)`}
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-xs text-red-500 font-semibold">
                            <XCircle className="w-4 h-4" /> Falhou
                        </span>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-bold text-slate-700 mb-3">Edge Functions</h3>
                <div className="divide-y divide-slate-100">
                    {EDGE_FUNCTIONS.map(fn => (
                        <div key={fn.name} className="flex items-center justify-between py-2.5 gap-4">
                            <div className="min-w-0">
                                <p className="text-sm font-mono font-semibold text-slate-700">{fn.name}</p>
                                <p className="text-xs text-slate-400">{fn.purpose}</p>
                            </div>
                            {fn.deployed ? (
                                <span className="flex-shrink-0 flex items-center gap-1.5 text-xs text-green-600 font-semibold whitespace-nowrap">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Implantada
                                </span>
                            ) : (
                                <span className="flex-shrink-0 flex items-center gap-1.5 text-xs text-amber-600 font-semibold whitespace-nowrap">
                                    <XCircle className="w-3.5 h-3.5" /> Pendente
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminHealthJobs;
