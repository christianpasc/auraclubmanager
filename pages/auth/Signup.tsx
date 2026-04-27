
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2, User, Globe, ChevronDown, GraduationCap, Shield, ArrowRight } from 'lucide-react';
import logoImg from '../../assets/logo.png?v=2';
import { useAuth } from '../../contexts/AuthContext';
import { AVAILABLE_LANGUAGES, useLanguage } from '../../contexts/LanguageContext';

const Signup: React.FC = () => {
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [organizationType, setOrganizationType] = useState<'school' | 'club'>('school');
    const { signUp } = useAuth();
    const { t, language: contextLanguage } = useLanguage();
    const [language, setLanguage] = useState(contextLanguage);

    // Sync with context language when it changes (e.g., URL param loaded async)
    React.useEffect(() => {
        setLanguage(contextLanguage);
    }, [contextLanguage]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!fullName.trim()) {
            setError(t('auth.nameRequired'));
            return;
        }

        if (password !== confirmPassword) {
            setError(t('auth.passwordMismatch'));
            return;
        }

        if (password.length < 6) {
            setError(t('auth.passwordTooShort'));
            return;
        }

        setLoading(true);

        const { error } = await signUp(email, password, { full_name: fullName, language, organization_type: organizationType });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            // Save language preference to localStorage for immediate use
            localStorage.setItem('language', language);
            setSuccess(true);
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex">
                {/* Left Panel */}
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

                {/* Right Panel — Success */}
                <div className="flex-1 flex flex-col justify-center items-center bg-white px-8 py-12">
                    <div className="w-full max-w-md text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                            <User className="w-8 h-8 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">{t('auth.accountCreated')}</h2>
                        <p className="text-slate-500 mb-6 text-sm">
                            {t('auth.confirmEmailSent')} <strong>{email}</strong>.
                            {' '}{t('auth.confirmEmailInstructions')}
                        </p>
                        <Link
                            to="/login"
                            className="inline-block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/25 transition-all text-sm"
                        >
                            {t('auth.goToLogin')}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

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
                    <img src={logoImg} alt="Aura Club Manager" style={{ height: '88px', width: 'auto' }} className="mb-8" />
                    <h2 className="text-3xl font-extrabold text-white leading-tight mb-4">
                        {t('auth.heroTitle')}
                    </h2>
                    <p className="text-slate-300 text-base leading-relaxed">
                        {t('auth.heroSubtitle')}
                    </p>
                </div>
            </div>

            {/* Right Panel — Form */}
            <div className="flex-1 flex flex-col justify-center items-center relative bg-white px-6 py-12 overflow-y-auto">

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
                    <h2 className="text-3xl font-bold text-slate-900 mb-1">
                        {t('auth.createAccount')}
                    </h2>
                    <p className="text-slate-500 mb-8 text-sm">
                        {t('auth.fillData')}
                    </p>

                    {error && (
                        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Full Name */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                {t('auth.fullName')}
                            </label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder={t('auth.namePlaceholder')}
                                    required
                                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                />
                            </div>
                        </div>

                        {/* Organization Type */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                {t('auth.organizationType')}
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setOrganizationType('school')}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${organizationType === 'school'
                                        ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-sm'
                                        : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                                        }`}
                                >
                                    <GraduationCap className="w-6 h-6" />
                                    <span className="text-xs font-bold text-center leading-tight">{t('auth.footballSchool')}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOrganizationType('club')}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${organizationType === 'club'
                                        ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-sm'
                                        : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                                        }`}
                                >
                                    <Shield className="w-6 h-6" />
                                    <span className="text-xs font-bold text-center leading-tight">{t('auth.footballClub')}</span>
                                </button>
                            </div>
                        </div>

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

                        {/* Language */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                {t('auth.systemLanguage')}
                            </label>
                            <div className="relative">
                                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer text-sm"
                                >
                                    {AVAILABLE_LANGUAGES.map((lang) => (
                                        <option key={lang.value} value={lang.value}>
                                            {lang.label}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
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
                            <p className="text-xs text-slate-400 mt-1">{t('auth.passwordMinLength')}</p>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                {t('auth.confirmPassword')}
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full pl-11 pr-12 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
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
                                    {t('auth.creatingAccount')}
                                </>
                            ) : (
                                <>
                                    {t('auth.createAccount')}
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-sm text-slate-500">
                        {t('auth.hasAccount')}{' '}
                        <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                            {t('auth.login')}
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

export default Signup;
