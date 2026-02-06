
import { supabase } from '../lib/supabase';

export interface SubscriptionInfo {
    trialDaysRemaining: number;
    isTrialExpired: boolean;
    hasActiveSubscription: boolean;
    subscriptionStatus: 'trial' | 'active' | 'expired';
    trialEndsAt: Date | null;
}

export const subscriptionService = {
    // Calculate trial days remaining from tenant creation date
    calculateTrialDaysRemaining(createdAt: string): number {
        const createdDate = new Date(createdAt);
        const now = new Date();
        const trialEndDate = new Date(createdDate);
        trialEndDate.setDate(trialEndDate.getDate() + 7); // 7 days trial

        const diffTime = trialEndDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        console.log('[SubscriptionService] Trial calculation:', {
            createdAt,
            createdDate: createdDate.toISOString(),
            trialEndDate: trialEndDate.toISOString(),
            now: now.toISOString(),
            diffDays,
        });

        return Math.max(0, diffDays);
    },

    // Get trial info for current tenant
    async getTrialInfo(tenantId: string): Promise<SubscriptionInfo | null> {
        if (!tenantId) {
            console.log('[SubscriptionService] No tenantId provided');
            return null;
        }

        console.log('[SubscriptionService] Getting trial info for tenant:', tenantId);

        const { data: tenant, error } = await supabase
            .from('tenants')
            .select('created_at, subscription_plan, subscription_status')
            .eq('id', tenantId)
            .single();

        if (error) {
            console.error('[SubscriptionService] Error fetching tenant:', error);
            return null;
        }

        if (!tenant) {
            return null;
        }

        const trialDaysRemaining = this.calculateTrialDaysRemaining(tenant.created_at);
        const isTrialExpired = trialDaysRemaining <= 0;

        // Check for active subscription
        // A tenant has an active subscription only if:
        // 1. status is 'active'
        // 2. plan is present and not null/empty
        const hasActiveSubscription =
            tenant.subscription_status === 'active' &&
            !!tenant.subscription_plan &&
            tenant.subscription_plan !== '';

        console.log('[SubscriptionService] Status check:', {
            id: tenantId,
            status: tenant.subscription_status,
            plan: tenant.subscription_plan,
            hasActiveSubscription,
            trialDaysRemaining,
            isTrialExpired
        });

        let subscriptionStatus: 'trial' | 'active' | 'expired';
        if (hasActiveSubscription) {
            subscriptionStatus = 'active';
        } else if (isTrialExpired) {
            subscriptionStatus = 'expired';
        } else {
            subscriptionStatus = 'trial';
        }

        const createdDate = new Date(tenant.created_at);
        const trialEndsAt = new Date(createdDate);
        trialEndsAt.setDate(trialEndsAt.getDate() + 7);

        return {
            trialDaysRemaining,
            isTrialExpired,
            hasActiveSubscription,
            subscriptionStatus,
            trialEndsAt,
        };
    },

    // Update subscription (for when user subscribes to a plan)
    async updateSubscription(tenantId: string, planId: string): Promise<void> {
        if (!tenantId) throw new Error('No tenant selected');

        const { error } = await supabase
            .from('tenants')
            .update({
                subscription_plan: planId,
                subscription_status: 'active',
                updated_at: new Date().toISOString(),
            })
            .eq('id', tenantId);

        if (error) throw error;
    },
};

