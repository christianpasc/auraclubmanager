import React, { useEffect, useState } from 'react';
import { platformSettingsService, PLATFORM_SETTING_KEYS, MaintenanceSetting } from '../../services/platformSettingsService';
import { auditService } from '../../services/auditService';
import { Loader2, Wrench, Save, Check, AlertTriangle } from 'lucide-react';

const DEFAULT_MESSAGE = 'Estamos em manutenção. Voltamos em breve.';

const AdminMaintenance: React.FC = () => {
    const [enabled, setEnabled] = useState(false);
    const [message, setMessage] = useState(DEFAULT_MESSAGE);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        (async () => {
            const data = await platformSettingsService.get<MaintenanceSetting>(PLATFORM_SETTING_KEYS.MAINTENANCE);
            if (data) {
                setEnabled(!!data.enabled);
                setMessage(data.message || DEFAULT_MESSAGE);
            }
            setLoading(false);
        })();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await platformSettingsService.set(PLATFORM_SETTING_KEYS.MAINTENANCE, { enabled, message });
            await auditService.log('platform_setting.update', 'platform_setting', undefined, { key: 'maintenance', enabled });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error('Error saving maintenance setting:', err);
        } finally {
            setSaving(false);
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
                <h2 className="text-2xl font-bold text-slate-800">Manutenção</h2>
                <p className="text-sm text-slate-500 mt-0.5">Bloqueia o acesso de todos os usuários, exceto super admins.</p>
            </div>

            {enabled && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-2 text-amber-700">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium">O modo de manutenção está ATIVO neste momento.</span>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={e => setEnabled(e.target.checked)}
                        className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                    />
                    <Wrench className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-700">Modo de manutenção ativo</span>
                </label>

                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Mensagem exibida</label>
                    <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                        {saved ? 'Salvo!' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminMaintenance;
