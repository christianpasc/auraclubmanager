
import { supabase } from '../lib/supabase';

export interface SaasMetrics {
    total_users: number;
    active_users: number;
    total_subscriptions: number;
    active_subscriptions: number;
    churned_subscriptions: number;
    trial_users?: number;
}

export interface AdminTenant {
    tenant_id: string;
    tenant_name: string;
    subscription_status: string;
    subscription_plan: string | null;
    created_at: string;
    trial_ends_at: string | null;
    owner_name: string | null;
    owner_email: string | null;
    owner_last_login: string | null;
    country: string | null;
    settings: Record<string, string> | null;
    athletes_count: number;
    games_count: number;
    trainings_count: number;
    competitions_count: number;
    total_activities: number;
}

export interface UpdateTenantPayload {
    tenant_id: string;
    trial_ends_at?: string | null;
    subscription_status?: string;
    country?: string;
    name?: string;
}

export const adminService = {
    async getMetrics(): Promise<SaasMetrics> {
        const { data, error } = await supabase.rpc('get_saas_metrics');
        if (error) throw error;
        return data as SaasMetrics;
    },

    async getAllTenants(): Promise<AdminTenant[]> {
        const { data, error } = await supabase.rpc('get_admin_tenants');
        if (error) throw error;
        return data as AdminTenant[];
    },

    async updateTenant(payload: UpdateTenantPayload): Promise<void> {
        const { error } = await supabase.rpc('admin_update_tenant', {
            p_tenant_id: payload.tenant_id,
            p_trial_ends_at: payload.trial_ends_at ?? null,
            p_subscription_status: payload.subscription_status ?? null,
            p_country: payload.country ?? null,
            p_name: payload.name ?? null,
        });
        if (error) throw error;
    },

    async checkIsSuperAdmin(): Promise<boolean> {
        const { data, error } = await supabase.rpc('get_user_role_status');
        if (error) {
            console.error("Error checking admin status:", error);
            return false;
        }
        return !!data?.is_super_admin;
    }
};
