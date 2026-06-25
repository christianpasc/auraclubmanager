import React, { useEffect, useState } from 'react';
import { auditService, AuditLogEntry } from '../../services/auditService';
import { Loader2, AlertTriangle, FileSearch } from 'lucide-react';

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR');
}

const ACTION_LABELS: Record<string, string> = {
    'tenant.update': 'Editou um clube',
    'plan.create': 'Criou um plano',
    'plan.update': 'Editou um plano',
    'plan.delete': 'Excluiu um plano',
    'plan.activate': 'Ativou um plano',
    'plan.deactivate': 'Desativou um plano',
    'palette.create': 'Criou uma paleta',
    'palette.update': 'Editou uma paleta',
    'palette.delete': 'Excluiu uma paleta',
    'platform_setting.update': 'Alterou uma configuração da plataforma',
};

const AdminAudit: React.FC = () => {
    const [entries, setEntries] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const data = await auditService.getRecent();
                setEntries(data);
            } catch (err: any) {
                console.error('Error loading audit log:', err);
                setError(err.message || 'Erro ao carregar auditoria.');
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

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-900">Auditoria</h2>
                <p className="text-sm text-slate-500 mt-0.5">Últimas {entries.length} ações administrativas registradas.</p>
            </div>

            {entries.length === 0 ? (
                <div className="p-12 text-center">
                    <FileSearch className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">Nenhuma ação registrada ainda.</p>
                </div>
            ) : (
                <div className="divide-y divide-slate-100">
                    {entries.map(entry => (
                        <div key={entry.id} className="px-6 py-4 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold text-slate-800">
                                    {ACTION_LABELS[entry.action] || entry.action}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {entry.actor_email || 'Desconhecido'}
                                    {entry.target_type && entry.details && (
                                        <> — {entry.target_type}: {JSON.stringify(entry.details).slice(0, 120)}</>
                                    )}
                                </p>
                            </div>
                            <span className="text-xs text-slate-400 whitespace-nowrap">{formatDateTime(entry.created_at)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminAudit;
