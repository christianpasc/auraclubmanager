
import { supabase } from '../lib/supabase';

export interface StripePlan {
    id?: string;
    name: string;
    description?: string | null;
    stripe_price_id_test?: string | null;
    stripe_price_id_live?: string | null;
    interval: 'monthly' | 'quarterly' | 'yearly' | 'lifetime';
    price: number;
    currency: string;
    is_active: boolean;
    features: string[];
    features_school: string[];
    features_club: string[];
    sort_order: number;
    is_popular: boolean;
    max_users: number | null;
    max_athletes: number | null;
    created_at?: string;
    updated_at?: string;
}

export const adminPlanService = {
    // Get all plans (admin only - includes inactive)
    async getAllPlans(): Promise<StripePlan[]> {
        const { data, error } = await supabase.rpc('admin_get_all_plans');
        if (error) throw error;
        return (data || []) as StripePlan[];
    },

    // Create a new plan
    async createPlan(plan: Omit<StripePlan, 'id' | 'created_at' | 'updated_at'>): Promise<StripePlan> {
        const { data, error } = await supabase.rpc('admin_create_plan', {
            p_name: plan.name,
            p_description: plan.description || null,
            p_stripe_price_id_test: plan.stripe_price_id_test || null,
            p_stripe_price_id_live: plan.stripe_price_id_live || null,
            p_interval: plan.interval,
            p_price: plan.price,
            p_currency: plan.currency || 'brl',
            p_is_active: plan.is_active,
            p_features: JSON.stringify(plan.features || []),
            p_sort_order: plan.sort_order || 0,
            p_is_popular: plan.is_popular || false,
            p_max_users: plan.max_users ?? null,
            p_max_athletes: plan.max_athletes ?? null,
            p_features_school: JSON.stringify(plan.features_school || []),
            p_features_club: JSON.stringify(plan.features_club || []),
        });
        if (error) throw error;
        return data as StripePlan;
    },

    // Update an existing plan
    async updatePlan(id: string, plan: Partial<StripePlan>): Promise<StripePlan> {
        const params: any = { p_id: id };
        if (plan.name !== undefined) params.p_name = plan.name;
        if (plan.description !== undefined) params.p_description = plan.description;
        if (plan.stripe_price_id_test !== undefined) params.p_stripe_price_id_test = plan.stripe_price_id_test;
        if (plan.stripe_price_id_live !== undefined) params.p_stripe_price_id_live = plan.stripe_price_id_live;
        if (plan.interval !== undefined) params.p_interval = plan.interval;
        if (plan.price !== undefined) params.p_price = plan.price;
        if (plan.currency !== undefined) params.p_currency = plan.currency;
        if (plan.is_active !== undefined) params.p_is_active = plan.is_active;
        if (plan.features !== undefined) params.p_features = JSON.stringify(plan.features);
        if (plan.sort_order !== undefined) params.p_sort_order = plan.sort_order;
        if (plan.is_popular !== undefined) params.p_is_popular = plan.is_popular;
        if (plan.max_users !== undefined) params.p_max_users = plan.max_users ?? null;
        else params.p_max_users = -1;
        if (plan.max_athletes !== undefined) params.p_max_athletes = plan.max_athletes ?? null;
        else params.p_max_athletes = -1;
        if (plan.features_school !== undefined) params.p_features_school = JSON.stringify(plan.features_school);
        if (plan.features_club !== undefined) params.p_features_club = JSON.stringify(plan.features_club);

        const { data, error } = await supabase.rpc('admin_update_plan', params);
        if (error) throw error;
        return data as StripePlan;
    },

    // Toggle plan active/inactive
    async togglePlanActive(id: string, isActive: boolean): Promise<StripePlan> {
        const { data, error } = await supabase.rpc('admin_toggle_plan', {
            p_id: id,
            p_is_active: isActive,
        });
        if (error) throw error;
        return data as StripePlan;
    },

    // Delete a plan
    async deletePlan(id: string): Promise<void> {
        const { error } = await supabase.rpc('admin_delete_plan', { p_id: id });
        if (error) throw error;
    },

    // Get active plans (public - for user-facing page)
    async getActivePlans(): Promise<StripePlan[]> {
        const { data, error } = await supabase.rpc('get_active_plans');
        if (error) throw error;
        return (data || []) as StripePlan[];
    },
};
