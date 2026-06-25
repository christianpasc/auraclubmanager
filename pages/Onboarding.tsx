
import React, { useState } from 'react';
import { Loader2, Building2 } from 'lucide-react';
import logoImg from '../assets/logo.png?v=2';
import { useTenant } from '../contexts/TenantContext';
import { useLanguage } from '../contexts/LanguageContext';

const Onboarding: React.FC = () => {
    const [orgName, setOrgName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { createTenant } = useTenant();
    const { t } = useLanguage();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgName.trim()) return;

        setLoading(true);
        setError(null);

        try {
            await createTenant(orgName.trim());
            // The TenantContext will reload and the app will re-render with the new tenant
        } catch (err: any) {
            console.error('Error creating tenant during onboarding:', err);
            setError(err?.message || 'Erro ao criar sua organização. Tente novamente.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <img src={logoImg} alt="Aura Club Manager" className="mx-auto mb-1" style={{ width: '259px', height: '87px' }} />
                    <p className="text-slate-400">Configure sua organização para começar</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-2xl p-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800">Bem-vindo!</h2>
                    </div>
                    <p className="text-slate-500 mb-6">
                        Para começar, configure as informações da sua organização.
                    </p>

                    {error && (
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Organization Name */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Nome da Organização
                            </label>
                            <input
                                type="text"
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                placeholder="Ex: Escolinha do Craque, Club Atlético..."
                                required
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !orgName.trim()}
                            className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-lg shadow-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Criando organização...
                                </>
                            ) : (
                                'Criar Organização e Começar'
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-slate-500 text-sm mt-6">
                    {t('auth.copyright')}
                </p>
            </div>
        </div>
    );
};

export default Onboarding;
