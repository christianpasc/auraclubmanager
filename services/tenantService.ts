
import { supabase } from '../lib/supabase';

export interface Tenant {
    id?: string;
    name: string;
    slug: string;
    logo_url?: string;
    primary_color?: string;
    palette_id?: string | null;
    subscription_plan?: string;
    subscription_status?: string;
    organization_type?: 'school' | 'club';
    settings?: Record<string, any>;
    created_at?: string;
    updated_at?: string;
    // Stripe Connect (club → member payments)
    stripe_connect_account_id?: string | null;
    stripe_connect_charges_enabled?: boolean;
    stripe_connect_payouts_enabled?: boolean;
    stripe_connect_currency?: string;
    // Market routing: 'asaas' (Brazil) or 'stripe' (international); NULL falls
    // back to country-based resolution (services/payment/index.ts)
    payment_provider?: 'stripe' | 'asaas' | null;
    // Asaas root-account billing (Aura → club) and subaccount (club → members)
    asaas_customer_id?: string | null;
    asaas_subscription_id?: string | null;
    asaas_subaccount_id?: string | null;
    asaas_wallet_id?: string | null;
    asaas_charges_enabled?: boolean;
    /** Environment that issued the subaccount key; charging refuses a mismatch. */
    asaas_subaccount_env?: 'sandbox' | 'production' | null;
}

export interface TenantUser {
    id?: string;
    tenant_id: string;
    user_id: string;
    role?: string;
    is_owner?: boolean;
    created_at?: string;
}

// How many suffixed slugs to try before giving up ("clube", "clube-2", "clube-3", ...).
const SLUG_MAX_ATTEMPTS = 6;

// Postgres unique_violation. The RPC inserts into tenants, so a duplicate slug
// surfaces here as SQLSTATE 23505 naming the tenants_slug_key constraint.
function isSlugConflict(error: any): boolean {
    return error?.code === '23505' || /tenants_slug_key|duplicate key/i.test(error?.message || '');
}

export const tenantService = {
    // Get all tenants for current user
    async getMyTenants() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('tenant_users')
            .select(`
        *,
        tenant:tenants(*)
      `)
            .eq('user_id', user.id);

        if (error) throw error;
        return data?.map(tu => ({ ...tu.tenant, role: tu.role, is_owner: tu.is_owner })) || [];
    },

    // Get current tenant from profile
    async getCurrentTenant() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data: profile } = await supabase
            .from('profiles')
            .select('current_tenant_id')
            .eq('id', user.id)
            .single();

        if (!profile?.current_tenant_id) return null;

        const { data: tenant } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', profile.current_tenant_id)
            .single();

        return tenant as Tenant | null;
    },

    // Set current tenant
    async setCurrentTenant(tenantId: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('profiles')
            .update({ current_tenant_id: tenantId })
            .eq('id', user.id);

        if (error) throw error;
    },

    // Create a new tenant (and make user the owner).
    // tenants.slug is UNIQUE and feeds the public routes /site/:slug and /shop/:slug,
    // so two clubs picking the same name would collide. We cannot check availability
    // up front: the tenants_own_access RLS policy only lets an authenticated user read
    // tenants they already belong to, so a SELECT would report every taken slug as free.
    // Instead we let the database be the judge and retry with a suffix on 23505.
    async create(tenant: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        let newTenantId: any = null;
        let lastError: any = null;

        for (let attempt = 0; attempt < SLUG_MAX_ATTEMPTS; attempt++) {
            const slug = attempt === 0 ? tenant.slug : `${tenant.slug}-${attempt + 1}`;

            // Use the secure RPC to bypass RLS policies
            const { data, error: rpcError } = await supabase.rpc('create_own_tenant', {
                p_name: tenant.name,
                p_slug: slug,
                p_organization_type: tenant.organization_type || 'school'
            });

            if (!rpcError) {
                newTenantId = data;
                lastError = null;
                break;
            }

            lastError = rpcError;
            if (!isSlugConflict(rpcError)) break;
        }

        if (lastError) {
            console.error('Error creating tenant via RPC:', lastError);
            throw lastError;
        }

        // Fetch the created tenant to return full object
        // The RPC returns { id, name, slug } but we might want the full object
        const resultId = (newTenantId as any)?.id || newTenantId; // Handle if returns object or string (it returns json object)

        const { data: fullTenant, error: fetchError } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', resultId)
            .single();

        if (fetchError) throw fetchError;

        // Set as current tenant
        await this.setCurrentTenant(fullTenant.id);

        return fullTenant as Tenant;
    },

    // Merge a patch into tenants.settings without disturbing the other keys.
    // settings is a shared jsonb bag (country, language, currency, payment_methods,
    // income/expense categories, onboarding), so a plain update() with a partial
    // settings object would drop everything it does not mention.
    async updateSettings(id: string, patch: Record<string, any>) {
        const { data: current, error: readError } = await supabase
            .from('tenants')
            .select('settings')
            .eq('id', id)
            .single();
        if (readError) throw readError;

        return this.update(id, { settings: { ...(current?.settings as any), ...patch } });
    },

    // Update tenant
    async update(id: string, tenant: Partial<Tenant>) {
        const { data, error } = await supabase
            .from('tenants')
            .update({ ...tenant, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Tenant;
    },

    // Get tenant users
    async getTenantUsers(tenantId: string) {
        const { data, error } = await supabase
            .from('tenant_users')
            .select(`
        *,
        profile:profiles(full_name)
      `)
            .eq('tenant_id', tenantId);

        if (error) throw error;
        return data as TenantUser[];
    },

    // Invite user to tenant
    async inviteUser(tenantId: string, userId: string, role: string = 'member') {
        const { data, error } = await supabase
            .from('tenant_users')
            .insert({
                tenant_id: tenantId,
                user_id: userId,
                role,
                is_owner: false,
            })
            .select()
            .single();

        if (error) throw error;
        return data as TenantUser;
    },

    // Remove user from tenant
    async removeUser(tenantId: string, userId: string) {
        const { error } = await supabase
            .from('tenant_users')
            .delete()
            .eq('tenant_id', tenantId)
            .eq('user_id', userId);

        if (error) throw error;
    },

    // Update user role and permissions
    async updateUserRole(tenantId: string, userId: string, role: string, permissions?: Record<string, boolean>) {
        const updateData: any = {
            role,
        };

        if (permissions) {
            updateData.permissions = permissions;
        }

        const { error } = await supabase
            .from('tenant_users')
            .update(updateData)
            .eq('tenant_id', tenantId)
            .eq('user_id', userId);

        if (error) throw error;
    },

    // Generate slug from name
    generateSlug(name: string): string {
        return name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    },
};
