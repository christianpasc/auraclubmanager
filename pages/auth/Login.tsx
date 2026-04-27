
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import logoImg from '../../assets/logo.png?v=2';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
// TenantContext is not used here to avoid circular dependencies during login
import { supabase } from '../../lib/supabase';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { signIn } = useAuth();
    const { t } = useLanguage();
    // Note: TenantContext will automatically load tenants when auth state changes
    const navigate = useNavigate();

    // Remove old cleanup flag that was causing issues
    React.useEffect(() => {
        sessionStorage.removeItem('login_cleanup_done_v1');
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Login: Starting submit...');
        setError(null);
        setLoading(true);

        try {
            console.log('Login: Attempting signIn...');
            // Create a timeout for signIn just in case (30s)
            const signInPromise = signIn(email, password);
            const r = await Promise.race([
                signInPromise,
                new Promise<{ error: any }>((_, reject) => setTimeout(() => reject(new Error('SignIn timeout (30s limit exceeded)')), 30000))
            ]);
            const { error } = r;

            if (error) {
                console.log('Login: SignIn error:', error.message);
                setError(error.message);
                setLoading(false);
                return;
            }
            console.log('Login: SignIn successful.');

            try {
                const { tenantService } = await import('../../services/tenantService');
                const tenants = await tenantService.getMyTenants();

                if (tenants.length === 0) {
                    console.log('No tenants found, creating default...');
                    const defaultName = 'Meu Clube';
                    const slug = tenantService.generateSlug(defaultName + '-' + Date.now());
                    await tenantService.create({ name: defaultName, slug });
                }


            } catch (err: any) {
                // If it's an AbortError, it might be due to component unmounting or navigation
                // We should log it but not fail the login if we're authenticated
                if (err.name === 'AbortError') {
                    console.log('Tenant check/create aborted. This might happen if navigation occurred.');
                } else {
                    console.error('Error ensuring tenant exists:', err);
                }
            }

            console.log('Login successful, verifying session...');

            try {
                console.log('Login: Checking admin status...');
                // Check if user is super admin with timeout
                const adminCheckPromise = (async () => {
                    const { data } = await supabase.auth.getUser();
                    if (data?.user) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('is_super_admin')
                            .eq('id', data.user.id)
                            .single();
                        return profile?.is_super_admin;
                    }
                    return false;
                })();

                const isSuperAdmin = await Promise.race([
                    adminCheckPromise,
                    new Promise<boolean>((resolve) => setTimeout(() => {
                        console.log('Login: Admin check timed out, assuming false');
                        resolve(false);
                    }, 2000))
                ]);

                if (isSuperAdmin) {
                    navigate('/admin');
                    return;
                }

                navigate('/');
            } catch (err: any) {
                console.error('Login: Admin check error', err);
                // On error, just go to dashboard
                navigate('/');
            }
        } catch (err: any) {
            if (err.name === 'AbortError') {
                console.log('Login process aborted but likely successful. Navigating to dashboard.');
                navigate('/');
                return;
            }
            console.error('Login error:', err);
            setError(t('auth.unexpectedError'));
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Panel — Hero */}
            <div
                className="hidden lg:flex lg:w-1/2 relative flex-col justify-center items-center p-10 overflow-hidden"
                style={{
                    background: 'linear-gradient(135deg, #0d1b2e 0%, #1a3050 50%, #0a1628 100%)',
                }}
            >
                {/* Stadium background image overlay */}
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage: `url('https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80')`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center bottom',
                        opacity: 0.25,
                    }}
                />
                {/* Dark gradient overlay */}
                <div
                    className="absolute inset-0"
                    style={{
                        background: 'linear-gradient(to bottom, rgba(10,22,40,0.7) 0%, rgba(10,22,40,0.4) 50%, rgba(10,22,40,0.85) 100%)',
                    }}
                />

                {/* Content — logo + text centered */}
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

                {/* Mobile logo — acima do card */}
                <div className="relative z-10 lg:hidden mb-5 text-center">
                    <img src={logoImg} alt="Aura Club Manager" className="mx-auto" style={{ width: '280px', height: 'auto' }} />
                </div>

                {/* Form card */}
                <div className="relative z-10 w-full max-w-md bg-white lg:bg-transparent rounded-2xl lg:rounded-none p-7 lg:p-0 shadow-2xl lg:shadow-none">
                    <h2 className="text-3xl font-bold text-slate-900 mb-1">
                        {t('auth.welcomeBack')}
                    </h2>
                    <p className="text-slate-500 mb-8 text-sm">
                        {t('auth.enterCredentials')}
                    </p>

                    {error && (
                        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email */}
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

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                {t('auth.password')}
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
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
                        </div>

                        {/* Remember me / Forgot password */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-600">{t('auth.rememberMe')}</span>
                            </label>
                            <Link
                                to="/forgot-password"
                                className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                            >
                                {t('auth.forgotPassword')}
                            </Link>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {t('auth.loading')}
                                </>
                            ) : (
                                <>
                                    {t('auth.login')}
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-sm text-slate-500">
                        {t('auth.noAccount')}{' '}
                        <Link to="/signup" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                            {t('auth.createAccount')}
                        </Link>
                    </p>
                </div>

                <p className="relative z-10 text-center text-white lg:text-slate-400 text-xs mt-6 lg:mt-10">
                    {t('auth.copyright')}
                </p>
            </div>
        </div>
    );
};

export default Login;
