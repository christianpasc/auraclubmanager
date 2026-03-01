
// Stripe configuration with automatic test/live mode detection
// In localhost → test mode keys | In production → live mode keys

import { loadStripe, Stripe } from '@stripe/stripe-js';
import { supabase } from './supabase';

const isProduction = window.location.hostname !== 'localhost'
    && window.location.hostname !== '127.0.0.1'
    && !window.location.hostname.includes('192.168.');

export const stripeConfig = {
    isProduction,

    // Current mode string
    get mode(): 'test' | 'live' {
        return isProduction ? 'live' : 'test';
    },

    publishableKey: isProduction
        ? (import.meta.env.VITE_STRIPE_LIVE_PUBLISHABLE_KEY || '')
        : (import.meta.env.VITE_STRIPE_TEST_PUBLISHABLE_KEY || ''),

    // Helper to get correct Stripe Price ID based on environment
    getPriceId(plan: { stripe_price_id_test?: string | null; stripe_price_id_live?: string | null }): string | null {
        if (isProduction) {
            return plan.stripe_price_id_live || null;
        }
        return plan.stripe_price_id_test || null;
    },

    // Mode label for UI
    get modeLabel(): string {
        return isProduction ? 'Produção' : 'Teste';
    },
};

// Lazy-loaded Stripe instance
let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
    if (!stripePromise && stripeConfig.publishableKey) {
        stripePromise = loadStripe(stripeConfig.publishableKey);
    }
    return stripePromise || Promise.resolve(null);
}

// Create a Stripe Checkout Session via Edge Function
export async function createCheckoutSession(
    planId: string,
    tenantId: string
): Promise<{ url: string; session_id: string } | null> {
    const successUrl = `${window.location.origin}${window.location.pathname}#/plans?success=true`;
    const cancelUrl = `${window.location.origin}${window.location.pathname}#/plans?canceled=true`;

    const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
            plan_id: planId,
            tenant_id: tenantId,
            mode: stripeConfig.mode,
            success_url: successUrl,
            cancel_url: cancelUrl,
        },
    });

    if (error) {
        console.error('[Stripe] Error creating checkout session:', error);
        // Try to get more specific error from data
        const errorMessage = data?.error || error.message || 'Failed to create checkout session';
        throw new Error(errorMessage);
    }

    // Edge Function may return error in the data body
    if (data?.error) {
        console.error('[Stripe] Edge Function error:', data.error);
        throw new Error(data.error);
    }

    return data as { url: string; session_id: string };
}

// Create a Stripe Customer Portal Session via Edge Function
export async function createPortalSession(
    tenantId: string
): Promise<{ url: string }> {
    const returnUrl = `${window.location.origin}${window.location.pathname}#/subscription`;

    const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: {
            tenant_id: tenantId,
            mode: stripeConfig.mode,
            return_url: returnUrl,
        },
    });

    if (error) {
        console.error('[Stripe] Error creating portal session:', error);
        const errorMessage = data?.error || error.message || 'Failed to create portal session';
        throw new Error(errorMessage);
    }

    if (data?.error) {
        console.error('[Stripe] Portal error:', data.error);
        throw new Error(data.error);
    }

    return data as { url: string };
}
