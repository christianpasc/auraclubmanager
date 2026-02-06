
import { supabase } from '../lib/supabase';

export interface Tenant {
    id?: string;
    name: string;
    slug: string;
    logo_url?: string;
    primary_color?: string;
    subscription_plan?: string;
    subscription_status?: string;
    settings?: Record<string, any>;
    created_at?: string;
    updated_at?: string;
}

export interface TenantUser {
    id?: string;
    tenant_id: string;
    user_id: string;
    role?: string;
    is_owner?: boolean;
    created_at?: string;
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

    // Create a new tenant (and make user the owner)
    async create(tenant: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Use the secure RPC to bypass RLS policies
        const { data: newTenantId, error: rpcError } = await supabase.rpc('create_own_tenant', {
            p_name: tenant.name,
            p_slug: tenant.slug
        });

        if (rpcError) {
            console.error('Error creating tenant via RPC:', rpcError);
            throw rpcError;
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
