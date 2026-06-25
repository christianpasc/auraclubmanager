import React, { useEffect, useState } from 'react';
import { adminService, AdminStripeOverview } from '../../services/adminService';
import { stripeConfig } from '../../lib/stripe';
import { Wallet, CheckCircle2, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import StatCard from '../../components/StatCard';

const AdminStripe: React.FC = () => {
    const [overview, setOverview] = useState<AdminStripeOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const data = await adminService.getStripeOverview();
                setOverview(data);
            } catch (err: any) {
                console.error('Error loading Stripe overview:', err);
                setError('Erro ao carregar status do Stripe.');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    if (error || !overview) {
        return (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                {error || 'Sem dados.'}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-800">Stripe</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${stripeConfig.isProduction
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                    }`}>
                    {stripeConfig.isProduction ? '🔴 Produção' : '🟡 Modo Teste'}
                </span>
            </div>

            <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">Stripe Connect (clube → membro)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <StatCard
                        label="Contas Connect Ativas"
                        value={overview.connect_active.toString()}
                        subValue={`${overview.connect_total} contas iniciadas`}
                        icon={CheckCircle2}
                        iconColor="bg-green-100 text-green-600"
                    />
                    <StatCard
                        label="Onboarding Incompleto"
                        value={Math.max(overview.connect_total - overview.connect_active, 0).toString()}
                        subValue="Conta criada, mas não pronta para receber"
                        icon={Clock}
                        iconColor="bg-amber-100 text-amber-600"
                    />
                </div>
            </div>

            <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">Assinaturas SaaS (clube → Aura)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard
                        label="Assinaturas Ativas"
                        value={overview.saas_active.toString()}
                        subValue="Pagamento em dia"
                        icon={Wallet}
                        iconColor="bg-indigo-100 text-indigo-600"
                    />
                    <StatCard
                        label="Em Trial"
                        value={overview.saas_trial.toString()}
                        subValue="Ainda não converteu"
                        icon={Clock}
                        iconColor="bg-blue-100 text-blue-600"
                    />
                    <StatCard
                        label="Pagamento Atrasado"
                        value={overview.saas_past_due.toString()}
                        subValue="Cobrança falhou"
                        icon={AlertTriangle}
                        iconColor="bg-red-100 text-red-600"
                    />
                </div>
            </div>
        </div>
    );
};

export default AdminStripe;
