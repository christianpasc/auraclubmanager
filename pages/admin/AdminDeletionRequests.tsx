import React, { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, X, Trash2, Ban, ShieldAlert } from 'lucide-react';
import { privacyService, DeletionRequest } from '../../services/privacyService';
import { auditService } from '../../services/auditService';
import ConfirmModal from '../../components/ConfirmModal';

const STATUS_STYLES: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-slate-100 text-slate-500',
};

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendente',
    completed: 'Concluída',
    cancelled: 'Cancelada',
};

const TYPE_LABELS: Record<string, string> = {
    tenant: 'Clube completo',
    account: 'Conta de usuário',
};

const AdminDeletionRequests: React.FC = () => {
    const [requests, setRequests] = useState<DeletionRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [executeModal, setExecuteModal] = useState<{ open: boolean; request: DeletionRequest | null }>({ open: false, request: null });
    const [processingId, setProcessingId] = useState<string | null>(null);

    const load = async () => {
        try {
            setLoading(true);
            const data = await privacyService.adminGetAllRequests();
            setRequests(data);
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar solicitações.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleExecute = async () => {
        const request = executeModal.request;
        if (!request) return;
        setProcessingId(request.id);
        setExecuteModal({ open: false, request: null });
        setError(null);
        try {
            const result = await privacyService.adminExecuteTenantDeletion(request.id);
            if (!result.success) throw new Error(result.error || 'Falha na exclusão.');
            await auditService.log('deletion_request.execute', 'deletion_request', request.id, {
                request_type: request.request_type,
                tenant_id: request.tenant_id,
            });
            await load();
        } catch (err: any) {
            setError(err.message || 'Erro ao executar a exclusão.');
        } finally {
            setProcessingId(null);
        }
    };

    const handleCancel = async (request: DeletionRequest) => {
        setProcessingId(request.id);
        setError(null);
        try {
            await privacyService.adminMarkRequest(request.id, 'cancelled');
            await auditService.log('deletion_request.cancel', 'deletion_request', request.id, {
                request_type: request.request_type,
                tenant_id: request.tenant_id,
            });
            await load();
        } catch (err: any) {
            setError(err.message || 'Erro ao cancelar a solicitação.');
        } finally {
            setProcessingId(null);
        }
    };

    const fmtDate = (d: string | null) => d ? new Date(d).toLocaleString('pt-BR') : '—';

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    const pending = requests.filter(r => r.status === 'pending');
    const processed = requests.filter(r => r.status !== 'pending');

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Solicitações de Exclusão</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                    Pedidos de exclusão de dados (LGPD/GDPR) — de clientes ou gerados pela política de retenção (90 dias após encerramento).
                </p>
            </div>

            {error && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
                </div>
            )}

            {requests.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <ShieldAlert className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhuma solicitação de exclusão.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                    <th className="px-6 py-3">Tipo</th>
                                    <th className="px-6 py-3">Clube</th>
                                    <th className="px-6 py-3">Origem</th>
                                    <th className="px-6 py-3">Solicitado em</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {[...pending, ...processed].map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 text-sm font-semibold text-slate-800">{TYPE_LABELS[r.request_type]}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{r.tenant?.name || r.tenant_id || '—'}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500">
                                            {r.requested_by ? 'Cliente' : 'Retenção automática'}
                                            {r.reason && <p className="text-xs text-slate-400 mt-0.5 max-w-xs truncate" title={r.reason}>{r.reason}</p>}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500">{fmtDate(r.requested_at)}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[r.status]}`}>
                                                {STATUS_LABELS[r.status]}
                                            </span>
                                            {r.processed_at && <p className="text-xs text-slate-400 mt-0.5">{fmtDate(r.processed_at)}</p>}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {r.status === 'pending' && (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => setExecuteModal({ open: true, request: r })}
                                                        disabled={processingId === r.id}
                                                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                                    >
                                                        {processingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                        Executar exclusão
                                                    </button>
                                                    <button
                                                        onClick={() => handleCancel(r)}
                                                        disabled={processingId === r.id}
                                                        title="Cancelar solicitação"
                                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-50"
                                                    >
                                                        <Ban className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={executeModal.open}
                onClose={() => setExecuteModal({ open: false, request: null })}
                onConfirm={handleExecute}
                title="Executar exclusão definitiva"
                message={executeModal.request?.request_type === 'tenant'
                    ? `TODOS os dados do clube "${executeModal.request?.tenant?.name || executeModal.request?.tenant_id}" serão excluídos permanentemente (banco, vídeos, contas de usuários exclusivas). Esta ação é IRREVERSÍVEL. Confirmar?`
                    : 'A conta do usuário e seus dados pessoais serão excluídos permanentemente. Esta ação é IRREVERSÍVEL. Confirmar?'}
                confirmLabel="Excluir definitivamente"
                cancelLabel="Cancelar"
                isDestructive={true}
                loading={processingId !== null}
            />
        </div>
    );
};

export default AdminDeletionRequests;
