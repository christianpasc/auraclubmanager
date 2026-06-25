import React, { useEffect, useState } from 'react';
import { adminService, SaasMetricsV2, SignupMonth } from '../../services/adminService';
import {
    Users, CreditCard, Activity, AlertTriangle, Loader2, DollarSign, TrendingUp,
    TrendingDown, Percent, UserCheck, Wallet, ShieldOff, Clock, Building2,
} from 'lucide-react';
import StatCard from '../../components/StatCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function monthLabel(key: string): string {
    const [year, month] = key.split('-');
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

function formatUsd(value: number): string {
    return `US$ ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 mt-2">{title}</h3>
);

const AdminDashboard: React.FC = () => {
    const [metrics, setMetrics] = useState<SaasMetricsV2 | null>(null);
    const [signups, setSignups] = useState<SignupMonth[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const [m, s] = await Promise.all([
                    adminService.getMetricsV2(),
                    adminService.getSignupsByMonth(),
                ]);
                setMetrics(m);
                setSignups(s);
            } catch (err: any) {
                console.error('Error loading dashboard metrics:', err);
                setError('Erro ao carregar métricas.');
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

    if (error || !metrics) {
        return (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                {error || 'Sem dados.'}
            </div>
        );
    }

    const signupSeries = signups.map(s => ({ month: monthLabel(s.month_key), value: s.count }));

    const statusBreakdown = [
        { label: 'Ativos', value: metrics.active_subscriptions, color: 'bg-green-500' },
        { label: 'Trial', value: metrics.trial_accounts, color: 'bg-blue-500' },
        { label: 'Inadimplentes', value: metrics.past_due_accounts, color: 'bg-amber-500' },
        { label: 'Expirados', value: metrics.expired_accounts, color: 'bg-orange-500' },
        { label: 'Cancelados', value: metrics.canceled_accounts, color: 'bg-red-500' },
    ];
    const statusTotal = statusBreakdown.reduce((sum, s) => sum + s.value, 0) || 1;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Métricas do Sistema</h2>

            {/* Visão Geral */}
            <div>
                <SectionHeader title="Visão Geral" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard label="Contas" value={metrics.total_accounts.toString()} subValue="Clubes cadastrados" icon={Building2} iconColor="bg-orange-100 text-orange-600" />
                    <StatCard label="Usuários" value={metrics.total_users.toString()} subValue="Autenticados" icon={Users} iconColor="bg-blue-100 text-blue-600" />
                    <StatCard label="Usuários Ativos (30d)" value={metrics.active_users_30d.toString()} subValue="Login recente" icon={Activity} iconColor="bg-purple-100 text-purple-600" />
                    <StatCard label="Assinaturas Ativas" value={metrics.active_subscriptions.toString()} subValue={`${metrics.total_accounts} contas no total`} icon={CreditCard} iconColor="bg-green-100 text-green-600" />
                </div>
            </div>

            {/* Receita & Retenção */}
            <div>
                <SectionHeader title="Receita & Retenção" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard label="MRR" value={formatUsd(metrics.mrr)} subValue="Receita recorrente mensal" icon={DollarSign} iconColor="bg-emerald-100 text-emerald-600" />
                    <StatCard label="ARR" value={formatUsd(metrics.arr)} subValue="Projeção anual" icon={Wallet} iconColor="bg-emerald-100 text-emerald-600" />
                    <StatCard label="Ticket Médio" value={formatUsd(metrics.avg_revenue_per_account)} subValue="Por assinante" icon={CreditCard} iconColor="bg-indigo-100 text-indigo-600" />
                    <StatCard label="Conversão" value={`${metrics.conversion_rate}%`} subValue="Contas → assinantes" icon={Percent} iconColor="bg-indigo-100 text-indigo-600" />
                </div>
            </div>

            {/* Crescimento & Churn */}
            <div>
                <SectionHeader title="Crescimento & Churn" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        label="Crescimento Líquido (mês)"
                        value={metrics.net_growth_month >= 0 ? `+${metrics.net_growth_month}` : metrics.net_growth_month.toString()}
                        subValue={`${metrics.new_accounts_this_month} novas, ${metrics.canceled_this_month} canceladas`}
                        icon={metrics.net_growth_month >= 0 ? TrendingUp : TrendingDown}
                        iconColor={metrics.net_growth_month >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}
                    />
                    <StatCard label="Churn (mês)" value={`${metrics.churn_rate_month}%`} subValue={`${metrics.canceled_this_month} cancelamentos`} icon={TrendingDown} iconColor="bg-red-100 text-red-600" />
                    <StatCard label="Cobranças a Vencer (7d)" value={metrics.renewals_due_7d.toString()} subValue="Renovações próximas" icon={Clock} iconColor="bg-amber-100 text-amber-600" />
                    <StatCard label="Trials Terminando (7d)" value={metrics.trials_ending_7d.toString()} subValue="Acompanhar de perto" icon={Clock} iconColor="bg-blue-100 text-blue-600" />
                </div>
            </div>

            {/* Saúde da Base */}
            <div>
                <SectionHeader title="Saúde da Base" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard label="Inadimplentes" value={metrics.past_due_accounts.toString()} subValue="Pagamento atrasado" icon={AlertTriangle} iconColor="bg-red-100 text-red-600" />
                    <StatCard label="Contas Bloqueadas" value={metrics.expired_accounts.toString()} subValue="Trial expirado" icon={ShieldOff} iconColor="bg-slate-200 text-slate-600" />
                    <StatCard label="Recebendo Pagamentos" value={metrics.connect_active_accounts.toString()} subValue="Stripe Connect ativo" icon={UserCheck} iconColor="bg-green-100 text-green-600" />
                    <StatCard label="Atletas / Conta" value={metrics.avg_athletes_per_account.toString()} subValue="Média geral" icon={Users} iconColor="bg-purple-100 text-purple-600" />
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h3 className="text-sm font-bold text-slate-700 mb-4">Novas contas por mês</h3>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={signupSeries}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h3 className="text-sm font-bold text-slate-700 mb-4">Status das Assinaturas</h3>
                    <div className="space-y-3 mt-2">
                        {statusBreakdown.map(s => (
                            <div key={s.label}>
                                <div className="flex justify-between text-xs text-slate-600 mb-1">
                                    <span>{s.label}</span>
                                    <span className="font-semibold">{s.value}</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full ${s.color}`} style={{ width: `${(s.value / statusTotal) * 100}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
