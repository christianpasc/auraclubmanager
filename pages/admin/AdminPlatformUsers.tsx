import React, { useEffect, useState } from 'react';
import { adminService, PlatformUser } from '../../services/adminService';
import { Search, Loader2, AlertTriangle, Shield, Building2 } from 'lucide-react';

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR');
}

function formatDateTime(iso: string | null): string {
    if (!iso) return 'Nunca';
    return new Date(iso).toLocaleString('pt-BR');
}

const AdminPlatformUsers: React.FC = () => {
    const [users, setUsers] = useState<PlatformUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const data = await adminService.getAllPlatformUsers();
                setUsers(data);
            } catch (err: any) {
                console.error('Error loading platform users:', err);
                setError(err.message || 'Erro ao carregar usuários.');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const filtered = users.filter(u =>
        (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
        u.memberships.some(m => m.tenant_name.toLowerCase().includes(search.toLowerCase()))
    );

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

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Usuários da Plataforma</h2>
                        <p className="text-sm text-slate-500 mt-0.5">{users.length} usuários no total</p>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, e-mail ou clube..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-72"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuário</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Vínculos</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Último Login</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cadastro</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map(u => (
                                <tr key={u.user_id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="font-semibold text-slate-900 text-sm">{u.full_name || '—'}</div>
                                            {u.is_super_admin && (
                                                <span title="Super Admin">
                                                    <Shield className="w-3.5 h-3.5 text-indigo-500" />
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-400">{u.email || '—'}</div>
                                    </td>
                                    <td className="px-5 py-4">
                                        {u.memberships.length === 0 ? (
                                            <span className="text-xs text-slate-400 italic">Nenhum clube</span>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {u.memberships.map(m => (
                                                    <span
                                                        key={m.tenant_id}
                                                        title={`${m.role || ''}${m.is_owner ? ' (dono)' : ''}`}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-indigo-50 text-indigo-700 border-indigo-200"
                                                    >
                                                        <Building2 className="w-3 h-3" />
                                                        {m.tenant_name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-5 py-4 text-sm text-slate-600 whitespace-nowrap" title={formatDateTime(u.last_sign_in_at)}>
                                        {u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : 'Nunca'}
                                    </td>
                                    <td className="px-5 py-4 text-sm text-slate-600 whitespace-nowrap">
                                        {formatDate(u.created_at)}
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                        <p className="text-slate-500 text-sm">Nenhum usuário encontrado.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {filtered.length > 0 && (
                    <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-400 text-right">
                        {filtered.length} de {users.length} usuários
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPlatformUsers;
