import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface UserMetadata {
    full_name?: string;
    language?: string;
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    isSuperAdmin: boolean;
    signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
    signUp: (email: string, password: string, metadata?: UserMetadata) => Promise<{ error: AuthError | null }>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
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

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error };
    };

    const signUp = async (email: string, password: string, metadata?: UserMetadata) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: metadata
            }
        });
        return { error };
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

    const resetPassword = async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });
        return { error };
    };

    const value = {
        user,
        session,
        loading,
        isSuperAdmin,
        signIn,
        signUp,
        signOut,
        resetPassword,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
