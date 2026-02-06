
import { supabase } from '../lib/supabase';

export interface SaasMetrics {
    total_users: number;
    active_users: number;
    total_subscriptions: number;
    active_subscriptions: number;
    churned_subscriptions: number;
    // Add other metrics as needed
    trial_users?: number;
}


export interface AdminTenant {
    tenant_id: string;
    tenant_name: string;
    subscription_status: string;
    subscription_plan: string | null;
    created_at: string; // timestamp
    owner_name: string | null;
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

    async checkIsSuperAdmin(): Promise<boolean> {
        const { data, error } = await supabase.rpc('get_user_role_status');
        if (error) {
            console.error("Error checking admin status:", error);
            return false;
        }
        return !!data?.is_super_admin;
    }
};
