import { supabase } from '../lib/supabase';
import { tenantService, Tenant } from './tenantService';

// Onboarding progress lives inside the existing tenants.settings jsonb bag, so
// there is no schema migration. Bump ONBOARDING_VERSION if the step list changes
// in a way that should send existing tenants back through the wizard.
export const ONBOARDING_VERSION = 1;

export const ONBOARDING_STEPS = [
    'organization',
    'preferences',
    'identity',
    'structure',
    'plan',
    'athlete',
    'how-it-works',
] as const;

export type OnboardingStepId = typeof ONBOARDING_STEPS[number];

export interface OnboardingState {
    version: number;
    /** Index into ONBOARDING_STEPS of the step to resume on. */
    current_step: number;
    completed_at: string | null;
    skipped_steps: OnboardingStepId[];
    checklist_dismissed: boolean;
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
    version: ONBOARDING_VERSION,
    current_step: 0,
    completed_at: null,
    skipped_steps: [],
    checklist_dismissed: false,
};

/** Reads onboarding progress off a tenant, tolerating older or absent shapes. */
export function readOnboardingState(tenant: Tenant | null): OnboardingState {
    const raw = (tenant?.settings as any)?.onboarding;
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_ONBOARDING_STATE };
    return {
        version: typeof raw.version === 'number' ? raw.version : ONBOARDING_VERSION,
        current_step: typeof raw.current_step === 'number' ? raw.current_step : 0,
        completed_at: typeof raw.completed_at === 'string' ? raw.completed_at : null,
        skipped_steps: Array.isArray(raw.skipped_steps) ? raw.skipped_steps : [],
        checklist_dismissed: raw.checklist_dismissed === true,
    };
}

export function isOnboardingComplete(tenant: Tenant | null): boolean {
    return !!readOnboardingState(tenant).completed_at;
}

/**
 * Merges a patch into tenants.settings.onboarding without disturbing the other
 * settings keys (address, country, language, payment_methods, ...), which live in
 * the same jsonb column.
 */
export async function saveOnboardingState(
    tenant: Tenant,
    patch: Partial<OnboardingState>,
): Promise<Tenant> {
    if (!tenant.id) throw new Error('Tenant has no id');
    const next: OnboardingState = { ...readOnboardingState(tenant), ...patch };
    return tenantService.update(tenant.id, {
        settings: { ...(tenant.settings as any), onboarding: next },
    });
}

export interface OnboardingCounts {
    schoolPlans: number;
    teamMembers: number;
}

/**
 * The two counts the checklist needs that the dashboard does not already load.
 * Athlete and enrollment counts come from dashboardService.getStats(), so they are
 * passed into buildChecklist rather than queried again here.
 */
export async function getOnboardingCounts(tenantId: string): Promise<OnboardingCounts> {
    const [plans, members] = await Promise.all([
        supabase.from('school_plans').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        supabase.from('tenant_users').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    ]);
    return {
        schoolPlans: plans.count || 0,
        teamMembers: members.count || 0,
    };
}

export interface ChecklistItem {
    id: string;
    /** i18n key for the label. */
    labelKey: string;
    done: boolean;
    to: string;
}

export interface ChecklistInput {
    tenant: Tenant;
    counts: OnboardingCounts;
    totalAthletes: number;
    totalEnrollments: number;
}

/** Derives the checklist from real data — never from a stored "I did this" flag. */
export function buildChecklist({ tenant, counts, totalAthletes, totalEnrollments }: ChecklistInput): ChecklistItem[] {
    const settings = (tenant.settings as any) || {};
    return [
        {
            id: 'club-details',
            labelKey: 'onboarding.checklist.clubDetails',
            done: !!tenant.logo_url && !!settings.country,
            to: '/settings',
        },
        {
            id: 'school-plan',
            labelKey: 'onboarding.checklist.schoolPlan',
            done: counts.schoolPlans > 0,
            to: '/school-plans',
        },
        {
            id: 'first-athlete',
            labelKey: 'onboarding.checklist.firstAthlete',
            done: totalAthletes > 0,
            to: '/athletes/new',
        },
        {
            id: 'first-enrollment',
            labelKey: 'onboarding.checklist.firstEnrollment',
            done: totalEnrollments > 0,
            to: '/enrollments/new',
        },
        {
            id: 'payments',
            labelKey: 'onboarding.checklist.payments',
            done: !!tenant.stripe_connect_charges_enabled || !!tenant.asaas_charges_enabled,
            to: '/settings',
        },
        {
            id: 'invite-team',
            labelKey: 'onboarding.checklist.inviteTeam',
            done: counts.teamMembers > 1,
            to: '/settings',
        },
    ];
}
