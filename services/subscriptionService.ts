
import { supabase } from '../lib/supabase';

export interface SubscriptionInfo {
    trialDaysRemaining: number;
    isTrialExpired: boolean;
    hasActiveSubscription: boolean;
    subscriptionStatus: 'trial' | 'active' | 'expired';
    trialEndsAt: Date | null;
    planName: string | null;
    subscriptionEndsAt: Date | null;
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

        return Math.max(0, diffDays);
    },

    // Get trial info for current tenant
    async getTrialInfo(tenantId: string): Promise<SubscriptionInfo | null> {
        if (!tenantId) {
            console.log('[SubscriptionService] No tenantId provided');
            return null;
        }

        const { data: tenant, error } = await supabase
            .from('tenants')
            .select(`
                created_at, subscription_plan, subscription_status,
                subscription_plan_id, subscription_starts_at, subscription_ends_at
            `)
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

        // Check for active subscription by plan dates
        const now = new Date();
        const subscriptionEndsAt = tenant.subscription_ends_at
            ? new Date(tenant.subscription_ends_at)
            : null;

        const hasActivePlanSubscription =
            tenant.subscription_plan_id &&
            subscriptionEndsAt &&
            subscriptionEndsAt > now;

        // Also check legacy subscription fields
        const hasLegacySubscription =
            tenant.subscription_status === 'active' &&
            !!tenant.subscription_plan &&
            tenant.subscription_plan !== '';

        const hasActiveSubscription = !!(hasActivePlanSubscription || hasLegacySubscription);

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

        // Fetch plan name if subscription_plan_id exists
        let planName: string | null = tenant.subscription_plan || null;
        if (tenant.subscription_plan_id) {
            try {
                const { data: planData } = await supabase
                    .from('stripe_plans')
                    .select('name')
                    .eq('id', tenant.subscription_plan_id)
                    .single();
                if (planData) {
                    planName = planData.name;
                }
            } catch {
                // Ignore error - keep existing planName
            }
        }

        return {
            trialDaysRemaining,
            isTrialExpired,
            hasActiveSubscription,
            subscriptionStatus,
            trialEndsAt,
            planName,
            subscriptionEndsAt,
        };
    },

    // Activate a subscription based on plan interval
    async activateSubscription(tenantId: string, planId: string, interval: string): Promise<void> {
        if (!tenantId) throw new Error('No tenant selected');

        const now = new Date();
        let endsAt: Date;

        switch (interval) {
            case 'monthly':
                endsAt = new Date(now);
                endsAt.setMonth(endsAt.getMonth() + 1);
                break;
            case 'quarterly':
                endsAt = new Date(now);
                endsAt.setMonth(endsAt.getMonth() + 3);
                break;
            case 'yearly':
                endsAt = new Date(now);
                endsAt.setFullYear(endsAt.getFullYear() + 1);
                break;
            case 'lifetime':
                endsAt = new Date('2099-12-31T23:59:59Z');
                break;
            default:
                endsAt = new Date(now);
                endsAt.setMonth(endsAt.getMonth() + 1);
        }

        const { error } = await supabase
            .from('tenants')
            .update({
                subscription_plan_id: planId,
                subscription_status: 'active',
                subscription_starts_at: now.toISOString(),
                subscription_ends_at: endsAt.toISOString(),
                updated_at: now.toISOString(),
            })
            .eq('id', tenantId);

        if (error) throw error;
    },

    // Legacy: Update subscription (for when user subscribes to a plan)
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

    // Check plan limits for the tenant
    async checkPlanLimits(tenantId: string): Promise<PlanLimits | null> {
        if (!tenantId) return null;

        const { data, error } = await supabase.rpc('check_plan_limits', {
            p_tenant_id: tenantId,
        });

        if (error) {
            console.error('[SubscriptionService] Error checking plan limits:', error);
            return null;
        }

        return data as PlanLimits;
    },
};

export interface PlanLimits {
    max_users: number | null;
    max_athletes: number | null;
    current_users: number;
    current_athletes: number;
    has_active_subscription: boolean;
    can_add_user: boolean;
    can_add_athlete: boolean;
}
