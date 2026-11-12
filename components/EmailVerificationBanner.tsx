import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MailWarning, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

// Asks a new club to confirm their email without blocking anything.
//
// Signing up no longer dead-ends on a "check your inbox" screen: the account
// works immediately and this strip carries the request instead. It has no
// close button on purpose — it is the only remaining prompt to confirm, and a
// dismissed one would be forgotten until the day they need to recover the
// account.
//
// Rendered once, inside OnboardingGate, so it covers both the setup wizard and
// the whole app from a single place.
const EmailVerificationBanner: React.FC = () => {
    const { user, emailVerified, emailVerifiedLoading, refreshEmailVerified, resendVerification } = useAuth();
    const { t } = useLanguage();
    const location = useLocation();

    const [sending, setSending] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [feedback, setFeedback] = useState<'sent' | 'error' | null>(null);
    // The verify-email function redirects back with this flag, which lets the
    // app confirm the click landed instead of just quietly dropping the strip.
    const [justVerified, setJustVerified] = useState(
        () => new URLSearchParams(window.location.search).get('email_verified') === '1'
    );

    // Re-reads the flag when the tab regains focus. The link is usually opened
    // in a different tab or on a phone, so without this the strip would sit
    // there contradicting an account that is already confirmed.
    useEffect(() => {
        if (!user?.id || emailVerified) return;

        const recheck = () => { if (document.visibilityState === 'visible') refreshEmailVerified(); };
        window.addEventListener('focus', recheck);
        document.addEventListener('visibilitychange', recheck);
        return () => {
            window.removeEventListener('focus', recheck);
            document.removeEventListener('visibilitychange', recheck);
        };
    }, [user?.id, emailVerified, refreshEmailVerified]);

    // And on navigation, which covers someone who confirmed on their phone and
    // then carries on clicking around in this tab.
    const lastPath = useRef(location.pathname);
    useEffect(() => {
        if (location.pathname === lastPath.current) return;
        lastPath.current = location.pathname;
        if (user?.id && !emailVerified) refreshEmailVerified();
    }, [location.pathname, user?.id, emailVerified, refreshEmailVerified]);

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    // Clears the "we sent it" note so the strip does not keep claiming it.
    useEffect(() => {
        if (!feedback) return;
        const timer = setTimeout(() => setFeedback(null), 8000);
        return () => clearTimeout(timer);
    }, [feedback]);

    const handleResend = async () => {
        setSending(true);
        setFeedback(null);
        const { error, retryAfterSeconds } = await resendVerification();
        setSending(false);

        if (error === 'throttled') {
            // Show the real wait the server reported, not a guess.
            setCooldown(retryAfterSeconds ?? 60);
            return;
        }
        if (error) {
            setFeedback('error');
            return;
        }
        setFeedback('sent');
        setCooldown(60);
    };

    if (!user) return null;

    // A brief success note after the link is clicked, then nothing.
    if (emailVerified) {
        if (!justVerified) return null;
        return (
            <div className="bg-green-50 border-b border-green-200 px-4 py-2.5">
                <div className="flex items-center gap-2.5 text-sm text-green-800">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span className="font-medium">{t('emailVerification.confirmed')}</span>
                    <button
                        onClick={() => setJustVerified(false)}
                        className="ml-auto text-xs font-semibold text-green-700 hover:text-green-900 underline"
                    >
                        {t('emailVerification.dismiss')}
                    </button>
                </div>
            </div>
        );
    }

    // Stay quiet until the flag has actually been read, so the strip does not
    // flash on every page load for a confirmed account.
    if (emailVerifiedLoading) return null;

    return (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-sm">
                <div className="flex items-start sm:items-center gap-2.5 text-amber-900 flex-1 min-w-0">
                    <MailWarning className="w-4 h-4 flex-shrink-0 mt-0.5 sm:mt-0" />
                    <span>
                        <span className="font-semibold">{t('emailVerification.title')}</span>{' '}
                        <span className="text-amber-800">
                            {t('emailVerification.body')}{' '}
                            <strong className="break-all">{user.email}</strong>.
                        </span>
                    </span>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0 pl-6 sm:pl-0">
                    {feedback === 'sent' && (
                        <span className="text-xs font-medium text-green-700">{t('emailVerification.sent')}</span>
                    )}
                    {feedback === 'error' && (
                        <span className="text-xs font-medium text-red-700">{t('emailVerification.sendError')}</span>
                    )}
                    <button
                        onClick={handleResend}
                        disabled={sending || cooldown > 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                        {sending && <Loader2 className="w-3 h-3 animate-spin" />}
                        {cooldown > 0
                            ? t('emailVerification.resendIn').replace('{seconds}', String(cooldown))
                            : t('emailVerification.resend')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmailVerificationBanner;
