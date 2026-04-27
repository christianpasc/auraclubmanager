
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, ArrowLeft, CheckCircle, ArrowRight } from 'lucide-react';
import logoImg from '../../assets/logo.png?v=2';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

const ForgotPassword: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const { resetPassword } = useAuth();
    const { t } = useLanguage();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const { error } = await resetPassword(email);

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            setSuccess(true);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Panel — Hero */}
            <div
                className="hidden lg:flex lg:w-1/2 relative flex-col justify-center items-center p-10 overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1a3050 50%, #0a1628 100%)' }}
            >
                {/* Stadium background */}
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage: `url('https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80')`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center bottom',
                        opacity: 0.25,
                    }}
                />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(10,22,40,0.7) 0%, rgba(10,22,40,0.4) 50%, rgba(10,22,40,0.85) 100%)' }} />

                <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
                    <img src={logoImg} alt="Aura Club Manager" style={{ width: '100%', maxWidth: '380px', height: 'auto' }} className="mb-8" />
                    <h2 className="text-3xl font-extrabold text-white leading-tight mb-4">
                        {t('auth.heroTitle')}
                    </h2>
                    <p className="text-slate-300 text-base leading-relaxed">
                        {t('auth.heroSubtitle')}
                    </p>
                </div>
            </div>

            {/* Right Panel — Form */}
            <div className="flex-1 flex flex-col justify-center items-center relative bg-white px-6 py-12">

                {/* Mobile: stadium background */}
                <div
                    className="absolute inset-0 lg:hidden"
                    style={{
                        backgroundImage: `url('https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80')`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}
                />
                <div
                    className="absolute inset-0 lg:hidden"
                    style={{
                        background: 'linear-gradient(to bottom, rgba(10,22,40,0.82) 0%, rgba(10,22,40,0.65) 50%, rgba(10,22,40,0.88) 100%)',
                    }}
                />

                {/* Mobile logo */}
                <div className="relative z-10 lg:hidden mb-5 text-center">
                    <img src={logoImg} alt="Aura Club Manager" className="mx-auto" style={{ width: '280px', height: 'auto' }} />
                </div>

                <div className="relative z-10 w-full max-w-md bg-white lg:bg-transparent rounded-2xl lg:rounded-none p-7 lg:p-0 shadow-2xl lg:shadow-none">
                    {success ? (
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">{t('auth.emailSent')}</h2>
                            <p className="text-slate-500 mb-6 text-sm">
                                {t('auth.recoveryLinkSent')} <strong>{email}</strong>.
                                {' '}{t('auth.recoveryInstructions')}
                            </p>
                            <Link
                                to="/login"
                                className="inline-block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/25 transition-all text-sm"
                            >
                                {t('auth.backToLogin')}
                            </Link>
                        </div>
                    ) : (
                        <>
                            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors mb-6">
                                <ArrowLeft className="w-4 h-4" />
                                {t('auth.backToLogin')}
                            </Link>

                            <h2 className="text-3xl font-bold text-slate-900 mb-1">
                                {t('auth.recoverPassword')}
                            </h2>
                            <p className="text-slate-500 mb-8 text-sm">
                                {t('auth.recoverPasswordDesc')}
                            </p>

                            {error && (
                                <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl">
                                    <p className="text-sm text-red-600">{error}</p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                        {t('auth.email')}
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder={t('auth.emailPlaceholder')}
                                            required
                                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            {t('auth.sending')}
                                        </>
                                    ) : (
                                        <>
                                            {t('auth.sendRecoveryLink')}
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </form>
                        </>
                    )}
                </div>

                <p className="relative z-10 text-center text-white lg:text-slate-400 text-xs mt-6 lg:mt-10">
                    {t('auth.copyright')}
                </p>
            </div>
        </div>
    );
};

export default ForgotPassword;
