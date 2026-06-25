import React, { useEffect, useState } from 'react';
import { adminService, AdminTenant } from '../../services/adminService';
import { Loader2, AlertTriangle, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function monthKey(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
    const [year, month] = key.split('-');
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

const AdminObservability: React.FC = () => {
    const [tenants, setTenants] = useState<AdminTenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const data = await adminService.getAllTenants();
                setTenants(data);
            } catch (err: any) {
                console.error('Error loading observability data:', err);
                setError(err.message || 'Erro ao carregar dados.');
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

    if (error) {
        return (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
            </div>
        );
    }

    // Cadastros por mês (últimos 12 com dados)
    const signupsByMonth: Record<string, number> = {};
    tenants.forEach(t => {
        const key = monthKey(t.created_at);
        signupsByMonth[key] = (signupsByMonth[key] || 0) + 1;
    });
    const signupSeries = Object.keys(signupsByMonth)
        .sort()
        .slice(-12)
        .map(key => ({ month: monthLabel(key), value: signupsByMonth[key] }));

    const statusCounts = {
        active: tenants.filter(t => t.subscription_status === 'active').length,
        trial: tenants.filter(t => t.subscription_status === 'trial').length,
        expired: tenants.filter(t => t.subscription_status === 'expired').length,
        canceled: tenants.filter(t => t.subscription_status === 'canceled').length,
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Observabilidade</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                    Métricas derivadas dos dados já existentes — não é uma ferramenta de logs/erros (nenhuma está integrada ao projeto hoje).
                </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-700">Cadastros por mês</h3>
                </div>
                <div className="h-64">
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {([
                    { label: 'Ativos', value: statusCounts.active, color: 'text-green-600' },
                    { label: 'Em Trial', value: statusCounts.trial, color: 'text-blue-600' },
                    { label: 'Expirados', value: statusCounts.expired, color: 'text-amber-600' },
                    { label: 'Cancelados', value: statusCounts.canceled, color: 'text-red-600' },
                ] as const).map(s => (
                    <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdminObservability;
