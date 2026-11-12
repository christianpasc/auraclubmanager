import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import logoImg from '../../assets/logo.png?v=2';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../contexts/LanguageContext';

// Where the password-reset link lands.
//
// This screen did not exist. AuthContext.resetPassword sent people to
// /reset-password and no such route was ever registered, so anyone who asked
// for a new password got the email, clicked, and arrived nowhere — there was
// no way to actually set a password. The reset flow has been broken end to end.
//
// The link carries token_hash, minted by send-password-reset via
// admin.generateLink and exchanged for a session here with verifyOtp. The token
// travels in the route's own query string rather than Supabase's default
// ?code=, because the app runs on a HashRouter and the client cannot read a
// parameter placed outside the fragment.

type Phase = 'verifying' | 'ready' | 'invalid' | 'saved';

const ResetPassword: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { t } = useLanguage();

    const [phase, setPhase] = useState<Phase>('verifying');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // A token is single-use: StrictMode's double-invoked effect in development
    // would spend it on the first pass and fail the second.
    const exchanged = useRef(false);

    useEffect(() => {
        if (exchanged.current) return;
        exchanged.current = true;

        const tokenHash = searchParams.get('token_hash');
        if (!tokenHash) {
            setPhase('invalid');
            return;
        }

        (async () => {
            const { error } = await supabase.auth.verifyOtp({
                token_hash: tokenHash,
                type: 'recovery',
            });
            if (error) {
                console.error('Recovery token rejected:', error.message);
                setPhase('invalid');
                return;
            }
            setPhase('ready');
        })();
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 8) {
            setError(t('auth.passwordTooShort'));
            return;
        }
        if (password !== confirmPassword) {
            setError(t('auth.passwordMismatch'));
            return;
        }

        setSaving(true);
        // verifyOtp already signed this session in, so updateUser applies to
        // the right account without asking for the old password.
        const { error: updateError } = await supabase.auth.updateUser({ password });
        setSaving(false);

        if (updateError) {
            setError(updateError.message);
            return;
        }
        setPhase('saved');
    };

    const panel = (() => {
        if (phase === 'verifying') {
            return (
                <div className="text-center py-6">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 text-sm">{t('resetPassword.verifying')}</p>
                </div>
            );
        }

        if (phase === 'invalid') {
            return (
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
                        <AlertTriangle className="w-8 h-8 text-amber-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">{t('resetPassword.linkInvalid')}</h2>
                    <p className="text-slate-500 mb-6 text-sm">{t('resetPassword.linkInvalidDesc')}</p>
                    <Link
                        to="/forgot-password"
                        className="inline-block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/25 transition-all text-sm"
                    >
                        {t('resetPassword.requestNewLink')}
                    </Link>
                </div>
            );
        }

        if (phase === 'saved') {
            return (
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">{t('resetPassword.saved')}</h2>
                    <p className="text-slate-500 mb-6 text-sm">{t('resetPassword.savedDesc')}</p>
                    <button
                        onClick={() => navigate('/', { replace: true })}
                        className="inline-flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/25 transition-all text-sm"
                    >
                        {t('resetPassword.enterApp')}
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            );
        }

        return (
            <>
                <h2 className="text-3xl font-bold text-slate-900 mb-1">{t('resetPassword.title')}</h2>
                <p className="text-slate-500 mb-8 text-sm">{t('resetPassword.subtitle')}</p>

                {error && (
                    <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            {t('resetPassword.newPassword')}
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                autoFocus
                                className="w-full pl-11 pr-12 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{t('auth.passwordMinLength')}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            {t('auth.confirmPassword')}
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {t('resetPassword.saving')}
                            </>
                        ) : (
                            <>
                                {t('resetPassword.submit')}
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </form>
            </>
        );
    })();

    return (
        <div className="min-h-screen flex">
            {/* Left Panel — Hero */}
            <div
                className="hidden lg:flex lg:w-1/2 relative flex-col justify-center items-center p-10 overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #1a3050 50%, #0a1628 100%)' }}
            >
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
                    {panel}
                </div>

                <p className="relative z-10 text-center text-white lg:text-slate-400 text-xs mt-6 lg:mt-10">
                    {t('auth.copyright')}
                </p>
            </div>
        </div>
    );
};

export default ResetPassword;
