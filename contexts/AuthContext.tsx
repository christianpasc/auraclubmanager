import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface UserMetadata {
    full_name?: string;
    language?: string;
    organization_type?: 'school' | 'club';
    privacy_accepted_at?: string;
    /** WhatsApp number in E.164, already normalized by utils/phone. */
    phone?: string;
    /** Set only when the person ticked the WhatsApp contact box. */
    ai_contact_consent_at?: string;
    ai_contact_consent_version?: string;
    /** First-touch attribution from utils/utm. */
    signup_utm?: Record<string, string>;
}

export interface ResendResult {
    error: string | null;
    retryAfterSeconds?: number;
}

export interface SignUpResult {
    error: AuthError | Error | null;
    /**
     * True when the project still requires confirmation before the first
     * sign-in, so no session could be established. The signup screen then
     * falls back to asking the person to check their inbox.
     */
    needsEmailConfirmation?: boolean;
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    isSuperAdmin: boolean;
    /** Whether the user clicked the link in our confirmation email. */
    emailVerified: boolean;
    /** True until the flag has been read once, so the banner does not flash. */
    emailVerifiedLoading: boolean;
    refreshEmailVerified: () => Promise<void>;
    resendVerification: () => Promise<ResendResult>;
    signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
    signUp: (email: string, password: string, metadata?: UserMetadata) => Promise<SignUpResult>;
    signOut: () => Promise<void>;
    resetPassword: (email: string, language?: string) => Promise<{ error: Error | null }>;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [emailVerified, setEmailVerified] = useState(false);
    const [emailVerifiedLoading, setEmailVerifiedLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const initializeAuth = async () => {
            try {
                // Get session from Supabase - this reads from localStorage first
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('Error getting session:', error);
                }

                if (!isMounted) return;

                setSession(session);
                setUser(session?.user ?? null);

                // Check admin status in background (don't block loading)
                if (session?.user) {
                    (async () => {
                        try {
                            const { data } = await supabase.rpc('get_user_role_status');
                            if (isMounted) {
                                setIsSuperAdmin(!!data?.is_super_admin);
                            }
                        } catch (e) {
                            console.error('Error checking admin status', e);
                            if (isMounted) {
                                setIsSuperAdmin(false);
                            }
                        }
                    })();
                } else {
                    setIsSuperAdmin(false);
                }

            } catch (error) {
                console.error('Error initializing auth:', error);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event, session?.user?.email);

            if (!isMounted) return;

            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                // Check admin status in background
                (async () => {
                    try {
                        const { data } = await supabase.rpc('get_user_role_status');
                        if (isMounted) {
                            setIsSuperAdmin(!!data?.is_super_admin);
                        }
                    } catch (e) {
                        console.error('Error checking admin status', e);
                        if (isMounted) {
                            setIsSuperAdmin(false);
                        }
                    }
                })();
            } else {
                setIsSuperAdmin(false);
            }

            setLoading(false);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // Email ownership is tracked in profiles.email_verified_at, NOT in
    // auth.users.email_confirmed_at. With Supabase's "Confirm email" turned
    // off — which is what lets a new club land straight inside the app —
    // GoTrue stamps its own column at signup, so it no longer means anyone
    // proved anything.
    const readEmailVerified = React.useCallback(async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('email_verified_at')
                .eq('id', userId)
                .maybeSingle();

            // An unreadable flag is treated as unverified: the cost is a
            // banner that should not be there, versus silently dropping the
            // only prompt to confirm.
            if (error) {
                console.error('Error reading email verification state:', error);
                setEmailVerified(false);
                return;
            }
            setEmailVerified(!!data?.email_verified_at);
        } catch (e) {
            console.error('Error reading email verification state:', e);
            setEmailVerified(false);
        }
    }, []);

    useEffect(() => {
        if (!user?.id) {
            setEmailVerified(false);
            setEmailVerifiedLoading(false);
            return;
        }
        let active = true;
        setEmailVerifiedLoading(true);
        readEmailVerified(user.id).finally(() => {
            if (active) setEmailVerifiedLoading(false);
        });
        return () => { active = false; };
    }, [user?.id, readEmailVerified]);

    // Stable identity: the banner keeps this in the dependencies of the
    // focus/visibility listeners, and a new function each render would make it
    // tear those down and re-attach them on every state change.
    const refreshEmailVerified = React.useCallback(async () => {
        if (user?.id) await readEmailVerified(user.id);
    }, [user?.id, readEmailVerified]);

    const resendVerification = async (): Promise<ResendResult> => {
        try {
            const { data, error } = await supabase.functions.invoke('send-email-verification');

            // The function reports a 429 with the wait left on it, which the
            // banner turns into a countdown. supabase-js surfaces the body of
            // a non-2xx response on error.context, not in `data`.
            if (error) {
                let body: any = null;
                try {
                    body = await (error as any).context?.json?.();
                } catch { /* non-JSON response */ }

                if (body?.error === 'throttled') {
                    return { error: 'throttled', retryAfterSeconds: body.retry_after_seconds };
                }
                return { error: body?.error || error.message || 'send_failed' };
            }

            // The link was already used — most likely in another tab.
            if (data?.already_verified) {
                setEmailVerified(true);
                return { error: null };
            }

            return { error: data?.error ?? null };
        } catch (e: any) {
            console.error('Error resending verification email:', e);
            return { error: e?.message || 'send_failed' };
        }
    };

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error };
    };

    // Signing up now puts the person straight inside the app: the account is
    // usable immediately and a banner asks them to confirm the address, rather
    // than a dead-end screen telling them to go find an email.
    const signUp = async (email: string, password: string, metadata?: UserMetadata): Promise<SignUpResult> => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: metadata
            }
        });
        if (error) return { error };

        // With "Confirm email" off, signUp already returns a session. The
        // fallback covers the setting still being on, so this code is correct
        // both before and after that switch is flipped in the dashboard —
        // deploy and configuration can happen in either order.
        if (!data.session) {
            const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
            if (signInError) {
                // Confirmation is still mandatory on the project. The account
                // exists, so report success and let Supabase's own email carry
                // the confirmation; Signup falls back to the "check your
                // inbox" screen when no session appears.
                console.warn('Signed up but could not sign in yet:', signInError.message);
                return { error: null, needsEmailConfirmation: true };
            }
        }

        // Our own confirmation email, in the user's language. Not fatal if it
        // fails: the account works, and the banner offers a resend.
        try {
            const { error: mailError } = await supabase.functions.invoke('send-email-verification');
            if (mailError) console.error('Could not send verification email:', mailError);
        } catch (e) {
            console.error('Could not send verification email:', e);
        }

        return { error: null };
    };

    const signOut = async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Error signing out:', error);
        } finally {
            // Clear all local storage to ensure clean state
            localStorage.clear();

            // Also explicitly try to remove supabase keys if they persist
            // The key format is usually sb-<project-ref>-auth-token
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sb-')) {
                    localStorage.removeItem(key);
                }
            });

            setIsSuperAdmin(false);
            setUser(null);
            setSession(null);
        }
    };

    // Goes through our own function instead of resetPasswordForEmail, so the
    // message carries Aura's branding and the user's language. The endpoint
    // always answers 200 — it must not reveal which addresses have an account
    // — so there is nothing to report back beyond a transport failure.
    const resetPassword = async (email: string, language?: string) => {
        try {
            const { error } = await supabase.functions.invoke('send-password-reset', {
                body: { email, language },
            });
            if (error) {
                console.error('Error requesting password reset:', error);
                return { error: new Error(error.message) };
            }
            return { error: null };
        } catch (e: any) {
            console.error('Error requesting password reset:', e);
            return { error: new Error(e?.message || 'request_failed') };
        }
    };

    const value = {
        user,
        session,
        loading,
        isSuperAdmin,
        emailVerified,
        emailVerifiedLoading,
        refreshEmailVerified,
        resendVerification,
        signIn,
        signUp,
        signOut,
        resetPassword,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
