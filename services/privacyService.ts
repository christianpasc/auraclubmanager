import { supabase } from '../lib/supabase';

export interface DeletionRequest {
    id: string;
    tenant_id: string | null;
    requested_by: string | null;   // null = queued automatically by the retention job
    request_type: 'account' | 'tenant';
    reason: string | null;
    status: 'pending' | 'completed' | 'cancelled';
    requested_at: string;
    processed_at: string | null;
    processed_by: string | null;
    // joined
    tenant?: { name: string } | null;
}

export const privacyService = {
    async createDeletionRequest(params: {
        tenantId: string | null;
        requestType: 'account' | 'tenant';
        reason?: string;
    }): Promise<DeletionRequest> {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        if (!userId) throw new Error('Not authenticated');
        const { data, error } = await supabase
            .from('deletion_requests')
            .insert({
                tenant_id: params.tenantId,
                requested_by: userId,
                request_type: params.requestType,
                reason: params.reason || null,
            })
            .select()
            .single();
        if (error) throw error;
        return data as DeletionRequest;
    },

    // Pending requests visible to the current user (own requests + own tenant's).
    async getPendingForTenant(tenantId: string): Promise<DeletionRequest[]> {
        const { data, error } = await supabase
            .from('deletion_requests')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('status', 'pending');
        if (error) throw error;
        return (data || []) as DeletionRequest[];
    },

    // ── Super admin ───────────────────────────────────────────────────────
    async adminGetAllRequests(): Promise<DeletionRequest[]> {
        const { data, error } = await supabase
            .from('deletion_requests')
            .select('*, tenant:tenants(name)')
            .order('requested_at', { ascending: false });
        if (error) throw error;
        return (data || []) as DeletionRequest[];
    },

    async adminMarkRequest(id: string, status: 'completed' | 'cancelled'): Promise<DeletionRequest> {
        const { data, error } = await supabase.rpc('admin_process_deletion_request', {
            p_id: id,
            p_status: status,
        });
        if (error) throw error;
        return data as DeletionRequest;
    },

    // Full tenant wipe — DB rows, storage files and orphaned auth users —
    // executed server-side with the service role.
    async adminExecuteTenantDeletion(requestId: string): Promise<{ success: boolean; error?: string }> {
        const { data, error } = await supabase.functions.invoke('admin-delete-tenant', {
            body: { request_id: requestId },
        });
        if (error) return { success: false, error: error.message };
        if (data?.error) return { success: false, error: data.error };
        return { success: true };
    },
};
