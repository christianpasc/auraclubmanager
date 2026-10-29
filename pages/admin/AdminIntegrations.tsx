import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, CheckCircle2, XCircle, HelpCircle, CreditCard, Mail, FileText, ToggleLeft, ToggleRight } from 'lucide-react';
import { getAsaasStatus, AsaasStatus } from '../../services/payment';
import { asaasNfseService } from '../../services/asaasNfseService';

interface IntegrationsStatus {
    stripe: { test: boolean; live: boolean; webhook_test: boolean; webhook_live: boolean };
    stripe_connect: { test: boolean; live: boolean };
    asaas: {
        env: string | null;
        api_key_sandbox: boolean;
        api_key_prod: boolean;
        encryption_key: boolean;
        webhook_token: boolean;
        webhook_token_sandbox: boolean;
    };
    resend: { configured: boolean };
    trial_emails: { cron_token: boolean };
}

const StatusRow: React.FC<{ label: string; ok: boolean | null }> = ({ label, ok }) => (
    <div className="flex items-center justify-between py-2">
        <span className="text-sm text-slate-600">{label}</span>
        {ok === null ? (
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <HelpCircle className="w-4 h-4" /> Não verificado
            </span>
        ) : ok ? (
            <span className="flex items-center gap-1.5 text-xs text-green-600 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Configurado
            </span>
        ) : (
            <span className="flex items-center gap-1.5 text-xs text-red-500 font-semibold">
                <XCircle className="w-4 h-4" /> Ausente
            </span>
        )}
    </div>
);

const AdminIntegrations: React.FC = () => {
    const [status, setStatus] = useState<IntegrationsStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [unreachable, setUnreachable] = useState(false);
    const [asaas, setAsaas] = useState<AsaasStatus | null>(null);
    const [nfseEnabled, setNfseEnabled] = useState(false);
    const [nfseSaving, setNfseSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const { data, error } = await supabase.functions.invoke('admin-integrations-status');
                if (error || !data || data.error) {
                    setUnreachable(true);
                } else {
                    setStatus(data as IntegrationsStatus);
                }
            } catch {
                setUnreachable(true);
            } finally {
                setLoading(false);
            }
        })();
        getAsaasStatus().then(setAsaas).catch(() => setAsaas(null));
        asaasNfseService.isEnabled().then(setNfseEnabled).catch(() => {});
    }, []);

    const toggleNfse = async () => {
        setNfseSaving(true);
        try {
            const next = !nfseEnabled;
            await asaasNfseService.setEnabled(next);
            setNfseEnabled(next);
        } finally {
            setNfseSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Integrações</h2>
                <p className="text-sm text-slate-500 mt-0.5">Status de configuração — nunca exibe as chaves em si.</p>
            </div>

            {unreachable && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
                    Não foi possível verificar agora — a edge function <code className="font-mono text-xs">admin-integrations-status</code> não respondeu. Tente recarregar a página.
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-700">Stripe (SaaS)</h3>
                </div>
                <div className="divide-y divide-slate-100">
                    <StatusRow label="Chave secreta — teste" ok={status?.stripe.test ?? null} />
                    <StatusRow label="Chave secreta — produção" ok={status?.stripe.live ?? null} />
                    <StatusRow label="Webhook secret — teste" ok={status?.stripe.webhook_test ?? null} />
                    <StatusRow label="Webhook secret — produção" ok={status?.stripe.webhook_live ?? null} />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-700">Stripe Connect (clube → membro)</h3>
                </div>
                <div className="divide-y divide-slate-100">
                    <StatusRow label="Chave secreta — teste" ok={status?.stripe_connect.test ?? null} />
                    <StatusRow label="Chave secreta — produção" ok={status?.stripe_connect.live ?? null} />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-3">
                    <Mail className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-700">Resend (e-mails)</h3>
                </div>
                <div className="divide-y divide-slate-100">
                    <StatusRow label="Chave de API" ok={status?.resend.configured ?? null} />
                    <StatusRow label="Token do agendamento de e-mails de teste" ok={status?.trial_emails.cron_token ?? null} />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-700">Asaas (Brasil)</h3>
                </div>
                <div className="divide-y divide-slate-100">
                    <StatusRow label={`Conta-raiz (${asaas?.env || '—'})`} ok={asaas ? asaas.connected : null} />
                    <StatusRow label="Chave de API — produção" ok={status?.asaas.api_key_prod ?? null} />
                    <StatusRow label="Chave de API — sandbox" ok={status?.asaas.api_key_sandbox ?? null} />
                    <StatusRow label="Chave de criptografia das subcontas" ok={status?.asaas.encryption_key ?? null} />
                    <StatusRow label="Token do webhook — produção" ok={status?.asaas.webhook_token ?? null} />
                    <StatusRow label="Token do webhook — sandbox" ok={status?.asaas.webhook_token_sandbox ?? null} />
                    <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-slate-600">
                            Ambiente padrão
                            <span className="block text-[11px] text-slate-400">
                                Opcional. O app escolhe pelo endereço: localhost usa sandbox, o resto produção.
                            </span>
                        </span>
                        <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                            {status?.asaas.env ?? 'pelo endereço'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <div>
                            <p className="text-sm font-medium text-slate-700">Emissão de NFS-e</p>
                            <p className="text-xs text-slate-400">Desligado por padrão. Requer configuração fiscal municipal na conta do clube.</p>
                        </div>
                    </div>
                    <button onClick={toggleNfse} disabled={nfseSaving} title={nfseEnabled ? 'Desativar' : 'Ativar'}>
                        {nfseSaving
                            ? <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                            : nfseEnabled
                                ? <ToggleRight className="w-8 h-8 text-green-500" />
                                : <ToggleLeft className="w-8 h-8 text-slate-300" />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminIntegrations;
