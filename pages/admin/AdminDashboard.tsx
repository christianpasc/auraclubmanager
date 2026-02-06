import React, { useEffect, useState } from 'react';
import { adminService, SaasMetrics } from '../../services/adminService';
import { Users, CreditCard, Activity, AlertTriangle, Loader2 } from 'lucide-react';
import StatCard from '../../components/StatCard';

const AdminDashboard: React.FC = () => {
    const [metrics, setMetrics] = useState<SaasMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadMetrics = async () => {
            try {
                const data = await adminService.getMetrics();
                setMetrics(data);
            } catch (err: any) {
                console.error('Error loading metrics:', err);
                setError('Erro ao carregar métricas.');
            } finally {
                setLoading(false);
            }
        };

        loadMetrics();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                {error}
            </div>
        );
    }

    if (!metrics) return null;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Métricas do Sistema</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total de Usuários"
                    value={metrics.total_users.toString()}
                    icon={Users}
                    trend="Usuários autenticados"
                    trendUp={true} // Placeholder
                    color="bg-blue-500"
                />

                <StatCard
                    title="Assinaturas Ativas"
                    value={metrics.active_subscriptions.toString()}
                    icon={CreditCard}
                    trend={`${metrics.total_subscriptions} total`}
                    trendUp={true}
                    color="bg-green-500"
                />

                <StatCard
                    title="Usuários Ativos (30d)"
                    value={metrics.active_users.toString()}
                    icon={Activity}
                    trend="Login nos últimos 30 dias"
                    trendUp={true}
                    color="bg-purple-500"
                />

                <StatCard
                    title="Total Tenants"
                    value={metrics.total_subscriptions.toString()}
                    icon={Users}
                    trend="Clubes cadastrados"
                    trendUp={true}
                    color="bg-orange-500"
                />
            </div>
        </div>
    );
};

export default AdminDashboard;
