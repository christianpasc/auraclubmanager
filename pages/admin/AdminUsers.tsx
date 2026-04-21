import React, { useEffect, useState, useCallback } from 'react';
import { adminService, AdminTenant, UpdateTenantPayload } from '../../services/adminService';
import {
    Search, Loader2, Users, Swords, Dumbbell, Trophy, Edit3,
    X, Calendar, Globe, Building2, AlertCircle, CheckCircle2,
    Clock, ChevronDown, Plus, Save, LogIn
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

const COUNTRY_NAMES: Record<string, string> = {
    BR: 'Brasil 🇧🇷', US: 'Estados Unidos 🇺🇸', PT: 'Portugal 🇵🇹',
    AR: 'Argentina 🇦🇷', ES: 'Espanha 🇪🇸', MX: 'México 🇲🇽',
    CO: 'Colômbia 🇨🇴', CL: 'Chile 🇨🇱', PE: 'Peru 🇵🇪',
    UY: 'Uruguai 🇺🇾', BO: 'Bolívia 🇧🇴', EC: 'Equador 🇪🇨',
    PY: 'Paraguai 🇵🇾', VE: 'Venezuela 🇻🇪', GB: 'Reino Unido 🇬🇧',
    DE: 'Alemanha 🇩🇪', FR: 'França 🇫🇷', IT: 'Itália 🇮🇹',
    OTHER: 'Outro 🌐',
};

function formatDate(iso: string | null, withTime = false): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (withTime) return d.toLocaleString('pt-BR');
    return d.toLocaleDateString('pt-BR');
}

function daysUntil(iso: string | null): number | null {
    if (!iso) return null;
    const diff = new Date(iso).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatRelativeTime(iso: string | null): { label: string; color: string } {
    if (!iso) return { label: 'Nunca', color: 'text-slate-400' };
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diffMs / 60000);
    const hours   = Math.floor(diffMs / 3600000);
    const days    = Math.floor(diffMs / 86400000);
    if (minutes < 1)  return { label: 'Agora mesmo', color: 'text-emerald-600' };
    if (minutes < 60) return { label: `${minutes}min atrás`, color: 'text-emerald-600' };
    if (hours < 24)   return { label: `${hours}h atrás`, color: 'text-emerald-600' };
    if (days === 1)   return { label: 'Ontem', color: 'text-amber-600' };
    if (days <= 7)    return { label: `${days} dias atrás`, color: 'text-amber-600' };
    if (days <= 30)   return { label: `${days} dias atrás`, color: 'text-slate-600' };
    return { label: formatDate(iso), color: 'text-slate-400' };
}

function toDateInputValue(iso: string | null): string {
    if (!iso) return '';
    return iso.slice(0, 10);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const conf = {
        active:   { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Ativo', Icon: CheckCircle2 },
        trial:    { cls: 'bg-indigo-100 text-indigo-700 border-indigo-200',   label: 'Em Teste', Icon: Clock },
        expired:  { cls: 'bg-red-100 text-red-700 border-red-200',           label: 'Expirado', Icon: AlertCircle },
        canceled: { cls: 'bg-slate-100 text-slate-600 border-slate-200',     label: 'Cancelado', Icon: X },
    }[status] ?? { cls: 'bg-slate-100 text-slate-600 border-slate-200', label: status, Icon: AlertCircle };
    const { cls, label, Icon } = conf;
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}>
            <Icon className="w-3 h-3" />
            {label}
        </span>
    );
};

const ActivityPill: React.FC<{ icon: React.ReactNode; count: number; label: string }> = ({ icon, count, label }) => (
    <span title={label} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border
        ${count > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
        {icon}
        {count}
    </span>
);

const TrialCountdown: React.FC<{ trialEndsAt: string | null; status: string }> = ({ trialEndsAt, status }) => {
    if (status !== 'trial') return <span className="text-xs text-slate-400">—</span>;
    const days = daysUntil(trialEndsAt);
    if (days === null) return <span className="text-xs text-slate-400">Sem data</span>;
    if (days < 0) return <span className="text-xs font-semibold text-red-600">Expirado há {Math.abs(days)}d</span>;
    if (days === 0) return <span className="text-xs font-semibold text-orange-600">Expira hoje</span>;
    const color = days <= 3 ? 'text-orange-600' : days <= 7 ? 'text-amber-600' : 'text-slate-600';
    return (
        <span className={`text-xs font-medium ${color}`}>
            {formatDate(trialEndsAt)} <span className="opacity-60">({days}d)</span>
        </span>
    );
};

// ─── Edit Modal ──────────────────────────────────────────────────────────────

interface EditModalProps {
    tenant: AdminTenant;
    onClose: () => void;
    onSaved: (updated: Partial<AdminTenant> & { tenant_id: string }) => void;
}

const EditModal: React.FC<EditModalProps> = ({ tenant, onClose, onSaved }) => {
    const [name, setName] = useState(tenant.tenant_name);
    const [status, setStatus] = useState(tenant.subscription_status);
    const [country, setCountry] = useState(tenant.country ?? 'BR');
    const [trialDate, setTrialDate] = useState(toDateInputValue(tenant.trial_ends_at));
    const [extraDays, setExtraDays] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleExtendTrial = () => {
        const days = parseInt(extraDays);
        if (!days || days <= 0) return;
        const base = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : new Date();
        if (base < new Date()) base.setTime(Date.now());
        base.setDate(base.getDate() + days);
        setTrialDate(base.toISOString().slice(0, 10));
        setExtraDays('');
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const payload: UpdateTenantPayload = {
                tenant_id: tenant.tenant_id,
                name,
                subscription_status: status,
                country,
                trial_ends_at: trialDate ? new Date(trialDate).toISOString() : null,
            };
            await adminService.updateTenant(payload);
            onSaved({
                tenant_id: tenant.tenant_id,
                tenant_name: name,
                subscription_status: status,
                country,
                trial_ends_at: trialDate ? new Date(trialDate).toISOString() : null,
            });
            onClose();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erro ao salvar.');
        } finally {
            setSaving(false);
        }
    };

    const days = daysUntil(trialDate ? new Date(trialDate).toISOString() : null);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-slate-100">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">{tenant.tenant_name}</h2>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{tenant.tenant_id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Tenant info cards */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Cadastro</p>
                            <p className="text-sm font-semibold text-slate-800">{formatDate(tenant.created_at)}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><LogIn className="w-3 h-3" /> Último Login</p>
                            {(() => { const r = formatRelativeTime(tenant.owner_last_login); return (
                                <>
                                    <p className={`text-sm font-semibold ${r.color}`}>{r.label}</p>
                                    {tenant.owner_last_login && <p className="text-xs text-slate-400">{formatDate(tenant.owner_last_login, true)}</p>}
                                </>
                            ); })()}
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Building2 className="w-3 h-3" /> Dono</p>
                            <p className="text-sm font-semibold text-slate-800 truncate">{tenant.owner_name || '—'}</p>
                            {tenant.owner_email && <p className="text-xs text-slate-500 truncate">{tenant.owner_email}</p>}
                        </div>
                    </div>

                    {/* Activity summary */}
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Movimentação</p>
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { label: 'Atletas', count: tenant.athletes_count, icon: <Users className="w-3.5 h-3.5" />, color: 'bg-blue-50 border-blue-200 text-blue-700' },
                                { label: 'Jogos', count: tenant.games_count, icon: <Swords className="w-3.5 h-3.5" />, color: 'bg-orange-50 border-orange-200 text-orange-700' },
                                { label: 'Treinos', count: tenant.trainings_count, icon: <Dumbbell className="w-3.5 h-3.5" />, color: 'bg-green-50 border-green-200 text-green-700' },
                                { label: 'Competições', count: tenant.competitions_count, icon: <Trophy className="w-3.5 h-3.5" />, color: 'bg-purple-50 border-purple-200 text-purple-700' },
                            ].map(({ label, count, icon, color }) => (
                                <div key={label} className={`rounded-xl border p-2.5 text-center ${color}`}>
                                    <div className="flex justify-center mb-1">{icon}</div>
                                    <div className="text-lg font-bold">{count}</div>
                                    <div className="text-xs opacity-70">{label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Editable fields */}
                    <div className="space-y-4 pt-2 border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Editar</p>

                        {/* Name */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1.5">Nome do Clube</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1.5">Status da Assinatura</label>
                            <div className="relative">
                                <select
                                    value={status}
                                    onChange={e => setStatus(e.target.value)}
                                    className="w-full appearance-none px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-8"
                                >
                                    <option value="trial">Em Teste (Trial)</option>
                                    <option value="active">Ativo</option>
                                    <option value="expired">Expirado</option>
                                    <option value="canceled">Cancelado</option>
                                </select>
                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Country */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> País</label>
                            <div className="relative">
                                <select
                                    value={country}
                                    onChange={e => setCountry(e.target.value)}
                                    className="w-full appearance-none px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-8"
                                >
                                    {Object.entries(COUNTRY_NAMES).map(([code, label]) => (
                                        <option key={code} value={code}>{label}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Trial end date + extend */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" /> Fim do Período de Teste
                            </label>
                            <input
                                type="date"
                                value={trialDate}
                                onChange={e => setTrialDate(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                            />
                            {trialDate && (
                                <p className={`text-xs mb-2 ${days !== null && days < 0 ? 'text-red-600' : days !== null && days <= 3 ? 'text-orange-600' : 'text-slate-500'}`}>
                                    {days !== null && days < 0 ? `⚠️ Expirado há ${Math.abs(days)} dias` :
                                     days === 0 ? '⚠️ Expira hoje' :
                                     days !== null ? `✓ ${days} dias restantes` : ''}
                                </p>
                            )}
                            {/* Quick extend buttons */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">Estender por:</span>
                                {[7, 14, 30].map(d => (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => {
                                            const base = trialDate ? new Date(trialDate) : new Date();
                                            if (base < new Date()) base.setTime(Date.now());
                                            base.setDate(base.getDate() + d);
                                            setTrialDate(base.toISOString().slice(0, 10));
                                        }}
                                        className="px-2.5 py-1 text-xs font-medium rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                                    >
                                        +{d}d
                                    </button>
                                ))}
                                <div className="flex items-center gap-1 ml-auto">
                                    <input
                                        type="number"
                                        min="1"
                                        value={extraDays}
                                        onChange={e => setExtraDays(e.target.value)}
                                        placeholder="dias"
                                        className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleExtendTrial}
                                        className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Component ──────────────────────────────────────────────────────────

const AdminUsers: React.FC = () => {
    const [tenants, setTenants] = useState<AdminTenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [editingTenant, setEditingTenant] = useState<AdminTenant | null>(null);

    const loadTenants = useCallback(async () => {
        try {
            const data = await adminService.getAllTenants();
            setTenants(data);
        } catch (err) {
            console.error('Error loading tenants:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadTenants(); }, [loadTenants]);

    const handleSaved = (updated: Partial<AdminTenant> & { tenant_id: string }) => {
        setTenants(prev =>
            prev.map(t => t.tenant_id === updated.tenant_id ? { ...t, ...updated } : t)
        );
    };

    const filtered = tenants.filter(t => {
        const matchSearch =
            t.tenant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.owner_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (t.owner_email?.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchStatus = statusFilter === 'all' || t.subscription_status === statusFilter;
        return matchSearch && matchStatus;
    });

    const counts = {
        all: tenants.length,
        trial: tenants.filter(t => t.subscription_status === 'trial').length,
        active: tenants.filter(t => t.subscription_status === 'active').length,
        expired: tenants.filter(t => t.subscription_status === 'expired').length,
        canceled: tenants.filter(t => t.subscription_status === 'canceled').length,
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
                    <p className="text-sm text-slate-500">Carregando clubes...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-4">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                    <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Clubes Cadastrados</h2>
                            <p className="text-sm text-slate-500 mt-0.5">{tenants.length} tenants no total</p>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por nome, dono ou e-mail..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-72"
                            />
                        </div>
                    </div>

                    {/* Status filter tabs */}
                    <div className="flex gap-1 px-6 py-3 overflow-x-auto border-b border-slate-100">
                        {([
                            { key: 'all', label: 'Todos' },
                            { key: 'trial', label: 'Em Teste' },
                            { key: 'active', label: 'Ativos' },
                            { key: 'expired', label: 'Expirados' },
                            { key: 'canceled', label: 'Cancelados' },
                        ] as const).map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setStatusFilter(key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                                    ${statusFilter === key
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                            >
                                {label}
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold
                                    ${statusFilter === key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    {counts[key]}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Clube / Tenant</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Dono</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">País</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fim do Trial</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Movimentação</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Último Login</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cadastro</th>
                                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map(tenant => (
                                    <tr key={tenant.tenant_id} className="hover:bg-slate-50/60 transition-colors group">
                                        <td className="px-5 py-4">
                                            <div className="font-semibold text-slate-900 text-sm">{tenant.tenant_name}</div>
                                            <div className="text-xs text-slate-400 font-mono mt-0.5">{tenant.tenant_id.substring(0, 8)}…</div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="text-sm text-slate-700">{tenant.owner_name || '—'}</div>
                                            {tenant.owner_email && (
                                                <div className="text-xs text-slate-400">{tenant.owner_email}</div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="text-sm text-slate-600">
                                                {COUNTRY_NAMES[tenant.country ?? 'BR'] ?? tenant.country ?? '—'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <StatusBadge status={tenant.subscription_status} />
                                        </td>
                                        <td className="px-5 py-4">
                                            <TrialCountdown trialEndsAt={tenant.trial_ends_at} status={tenant.subscription_status} />
                                        </td>
                                        <td className="px-5 py-4">
                                            {tenant.total_activities === 0 ? (
                                                <span className="text-xs text-slate-400 italic">Sem atividade</span>
                                            ) : (
                                                <div className="flex flex-wrap gap-1">
                                                    <ActivityPill icon={<Users className="w-3 h-3" />} count={tenant.athletes_count} label="Atletas" />
                                                    <ActivityPill icon={<Swords className="w-3 h-3" />} count={tenant.games_count} label="Jogos" />
                                                    <ActivityPill icon={<Dumbbell className="w-3 h-3" />} count={tenant.trainings_count} label="Treinos" />
                                                    <ActivityPill icon={<Trophy className="w-3 h-3" />} count={tenant.competitions_count} label="Competições" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-sm text-slate-600 whitespace-nowrap">
                                            {(() => { const r = formatRelativeTime(tenant.owner_last_login); return (
                                                <span className={`text-xs font-medium ${r.color}`} title={tenant.owner_last_login ? formatDate(tenant.owner_last_login, true) : ''}>
                                                    {r.label}
                                                </span>
                                            ); })()}
                                        </td>
                                        <td className="px-5 py-4 text-sm text-slate-600 whitespace-nowrap">
                                            {formatDate(tenant.created_at)}
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <button
                                                onClick={() => setEditingTenant(tenant)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                                Editar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-12 text-center">
                                            <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                            <p className="text-slate-500 text-sm">Nenhum clube encontrado.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {filtered.length > 0 && (
                        <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-400 text-right">
                            {filtered.length} de {tenants.length} clubes
                        </div>
                    )}
                </div>
            </div>

            {/* Edit modal */}
            {editingTenant && (
                <EditModal
                    tenant={editingTenant}
                    onClose={() => setEditingTenant(null)}
                    onSaved={handleSaved}
                />
            )}
        </>
    );
};

export default AdminUsers;
