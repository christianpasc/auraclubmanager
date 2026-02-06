
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Trophy, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
// TenantContext is not used here to avoid circular dependencies during login
import { supabase } from '../../lib/supabase';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { signIn } = useAuth();
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
            setError('Ocorreu um erro inesperado. Tente novamente.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl shadow-lg shadow-primary/30 mb-4">
                        <Trophy className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Aura Club</h1>
                    <p className="text-slate-400 mt-2">Gestão inteligente para seu clube</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-2xl p-8">
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Bem-vindo de volta</h2>
                    <p className="text-slate-500 mb-6">Entre com suas credenciais para acessar</p>

                    {error && (
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                E-mail
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="seu@email.com"
                                    required
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Senha
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full pl-12 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary" />
                                <span className="text-sm text-slate-600">Lembrar de mim</span>
                            </label>
                            <Link to="/forgot-password" className="text-sm font-semibold text-primary hover:text-primary-dark">
                                Esqueceu a senha?
                            </Link>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Entrando...
                                </>
                            ) : (
                                'Entrar'
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-slate-500">
                            Não tem uma conta?{' '}
                            <Link to="/signup" className="font-semibold text-primary hover:text-primary-dark">
                                Criar conta
                            </Link>
                        </p>
                    </div>
                </div>

                <p className="text-center text-slate-500 text-sm mt-6">
                    © 2026 Aura Club. Todos os direitos reservados.
                </p>
            </div>
        </div>
    );
};

export default Login;
