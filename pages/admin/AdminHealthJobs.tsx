import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Activity, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';

interface EdgeFunctionInfo {
    name: string;
    purpose: string;
    deployed: boolean;
}

interface CronJob {
    jobname: string;
    schedule: string;
    active: boolean;
    last_run_started_at: string | null;
    last_run_status: string | null;
}

const CRON_JOB_DESCRIPTIONS: Record<string, string> = {
    purge_video_access_logs: 'Retenção: apaga logs de acesso a vídeo com mais de 13 meses',
    purge_audit_log: 'Retenção: apaga registros de auditoria com mais de 24 meses',
    queue_expired_tenant_deletions: 'Retenção: enfileira exclusão de clubes encerrados há +90 dias',
};

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
    { name: 'admin-delete-tenant', purpose: 'Executa exclusões LGPD (clube/conta) solicitadas ou da retenção', deployed: true },
];

const AdminHealthJobs: React.FC = () => {
    const [dbStatus, setDbStatus] = useState<'checking' | 'ok' | 'error'>('checking');
    const [latencyMs, setLatencyMs] = useState<number | null>(null);
    const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
    const [cronLoading, setCronLoading] = useState(true);

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
        (async () => {
            try {
                const { data, error } = await supabase.rpc('admin_get_cron_jobs');
                if (!error) setCronJobs((data || []) as CronJob[]);
            } finally {
                setCronLoading(false);
            }
        })();
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Saúde & Jobs</h2>
                <p className="text-sm text-slate-500 mt-0.5">Conectividade, jobs agendados de retenção (pg_cron) e edge functions.</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-700">Jobs agendados (pg_cron)</h3>
                </div>
                {cronLoading ? (
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                ) : cronJobs.length === 0 ? (
                    <p className="text-sm text-slate-400">Nenhum job agendado.</p>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {cronJobs.map(job => (
                            <div key={job.jobname} className="flex items-center justify-between py-2.5 gap-4">
                                <div className="min-w-0">
                                    <p className="text-sm font-mono font-semibold text-slate-700">{job.jobname}</p>
                                    <p className="text-xs text-slate-400">
                                        {CRON_JOB_DESCRIPTIONS[job.jobname] || 'Job agendado'} · cron: {job.schedule}
                                        {job.last_run_started_at && ` · última execução: ${new Date(job.last_run_started_at).toLocaleString('pt-BR')} (${job.last_run_status})`}
                                    </p>
                                </div>
                                {job.active ? (
                                    <span className="flex-shrink-0 flex items-center gap-1.5 text-xs text-green-600 font-semibold whitespace-nowrap">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                                    </span>
                                ) : (
                                    <span className="flex-shrink-0 flex items-center gap-1.5 text-xs text-amber-600 font-semibold whitespace-nowrap">
                                        <XCircle className="w-3.5 h-3.5" /> Inativo
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
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
