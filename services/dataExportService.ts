import { supabase } from '../lib/supabase';

// Tables included in the club data export (LGPD/GDPR access & portability).
// All of these carry a tenant_id column; RLS already scopes reads to the
// caller's tenant, so the explicit .eq() is defense-in-depth. Platform
// internals (webhook_events, notifications, deletion_requests) are excluded.
const EXPORT_TABLES = [
    'athletes',
    'athlete_physiology',
    'athlete_wardrobe',
    'athlete_training_history',
    'guardians',
    'enrollments',
    'monthly_fees',
    'invoices',
    'payments',
    'transactions',
    'school_plans',
    'competitions',
    'competition_teams',
    'games',
    'game_players',
    'trainings',
    'training_participants',
    'assessments',
    'assessment_templates',
    'development_plans',
    'performance_reviews',
    'performance_stats',
    'prospects',
    'groups',
    'seasons',
    'age_categories',
    'videos',
    'events',
    'invitations',
    'bookings',
    'facilities',
    'products',
    'orders',
    'order_items',
    'sponsors',
] as const;

export const dataExportService = {
    // Assembles a structured JSON snapshot of every club-owned table and
    // triggers a browser download. Tables the tenant never used come back as
    // empty arrays; a table-level failure is recorded instead of aborting the
    // whole export.
    async exportTenantData(tenantId: string, tenantName: string): Promise<void> {
        const result: Record<string, unknown> = {
            exported_at: new Date().toISOString(),
            tenant_id: tenantId,
            tenant_name: tenantName,
            format_version: 1,
        };

        const data: Record<string, unknown[]> = {};
        const errors: Record<string, string> = {};

        await Promise.all(EXPORT_TABLES.map(async table => {
            const { data: rows, error } = await supabase
                .from(table)
                .select('*')
                .eq('tenant_id', tenantId);
            if (error) {
                errors[table] = error.message;
            } else {
                data[table] = rows || [];
            }
        }));

        result.data = data;
        if (Object.keys(errors).length > 0) result.errors = errors;

        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'clube';
        a.download = `aura-export-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
};
