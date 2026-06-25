
import { supabase } from '../lib/supabase';

export interface AuditLogEntry {
    id: string;
    actor_user_id: string | null;
    actor_email: string | null;
    action: string;
    target_type: string | null;
    target_id: string | null;
    details: Record<string, unknown> | null;
    created_at: string;
}

export const auditService = {
    // Fire-and-forget from the caller's perspective — failures are logged but
    // never block the admin action that triggered them.
    async log(action: string, targetType?: string, targetId?: string, details?: Record<string, unknown>): Promise<void> {
        try {
            const { error } = await supabase.rpc('log_admin_action', {
                p_action: action,
                p_target_type: targetType ?? null,
                p_target_id: targetId ?? null,
                p_details: details ?? null,
            });
            if (error) console.error('[auditService] Failed to log action:', error);
        } catch (err) {
            console.error('[auditService] Failed to log action:', err);
        }
    },

    async getRecent(limit = 200): Promise<AuditLogEntry[]> {
        const { data, error } = await supabase
            .from('audit_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return (data || []) as AuditLogEntry[];
    },
};
