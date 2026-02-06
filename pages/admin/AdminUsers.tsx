import React, { useEffect, useState } from 'react';
import { adminService, AdminTenant } from '../../services/adminService';
import { Search, Loader2 } from 'lucide-react';

const AdminUsers: React.FC = () => {
    const [tenants, setTenants] = useState<AdminTenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const loadTenants = async () => {
            try {
                const data = await adminService.getAllTenants();
                setTenants(data);
            } catch (err) {
                console.error('Error loading tenants:', err);
            } finally {
                setLoading(false);
            }
        };

        loadTenants();
    }, []);

    const filteredTenants = tenants.filter(t =>
        t.tenant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.owner_name && t.owner_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const getStatusBadge = (status: string) => {
        const styles = {
            active: 'bg-green-100 text-green-700',
            trial: 'bg-indigo-100 text-indigo-700',
            expired: 'bg-red-100 text-red-700',
            canceled: 'bg-gray-100 text-gray-700'
        };
        const style = styles[status as keyof typeof styles] || styles.canceled;

        // Translate status for display
        const labels: Record<string, string> = {
            active: 'Ativo',
            trial: 'Em Teste',
            expired: 'Expirado',
            canceled: 'Cancelado'
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${style}`}>
                {labels[status] || status}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-lg font-bold text-slate-800">Clubes Cadastrados</h2>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou dono..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full sm:w-64"
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Clube / Tenant</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Dono (Owner)</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Plano</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Data Cadastro</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {filteredTenants.map((tenant) => (
                            <tr key={tenant.tenant_id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="font-medium text-slate-900">{tenant.tenant_name}</div>
                                    <div className="text-xs text-slate-500 font-mono">{tenant.tenant_id.substring(0, 8)}...</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                    {tenant.owner_name || '—'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                    <span className="capitalize">{tenant.subscription_plan || 'Padrão'}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {getStatusBadge(tenant.subscription_status || 'unknown')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                    {new Date(tenant.created_at).toLocaleDateString('pt-BR')}
                                </td>
                            </tr>
                        ))}

                        {filteredTenants.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                    Nenhum clube encontrado.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminUsers;
