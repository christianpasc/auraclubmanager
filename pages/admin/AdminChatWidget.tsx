import React, { useEffect, useState } from 'react';
import { platformSettingsService, PLATFORM_SETTING_KEYS, ChatWidgetSetting } from '../../services/platformSettingsService';
import { auditService } from '../../services/auditService';
import { Loader2, MessageCircle, Save, Check } from 'lucide-react';

const AdminChatWidget: React.FC = () => {
    const [enabled, setEnabled] = useState(false);
    const [embedCode, setEmbedCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        (async () => {
            const data = await platformSettingsService.get<ChatWidgetSetting>(PLATFORM_SETTING_KEYS.CHAT_WIDGET);
            if (data) {
                setEnabled(!!data.enabled);
                setEmbedCode(data.embed_code || '');
            }
            setLoading(false);
        })();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await platformSettingsService.set(PLATFORM_SETTING_KEYS.CHAT_WIDGET, { enabled, embed_code: embedCode });
            await auditService.log('platform_setting.update', 'platform_setting', undefined, { key: 'chat_widget', enabled });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error('Error saving chat widget setting:', err);
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
                <h2 className="text-2xl font-bold text-slate-800">Widget de Chat</h2>
                <p className="text-sm text-slate-500 mt-0.5">Script de um widget de chat de suporte, exibido em todo o sistema quando ativo.</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={e => setEnabled(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <MessageCircle className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-700">Widget ativo</span>
                </label>

                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Script de Embed</label>
                    <textarea
                        value={embedCode}
                        onChange={e => setEmbedCode(e.target.value)}
                        rows={8}
                        placeholder={'<script>\n  // cole aqui o script do seu provedor de chat (Crisp, Tawk.to, Intercom, etc.)\n</script>'}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">Injetado no final da página quando o widget está ativo.</p>
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

export default AdminChatWidget;
