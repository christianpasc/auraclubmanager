// Maps an authenticated app pathname to the help article that documents it.
// Centralized here (instead of editing every page) so that Layout/Header can
// resolve and show a single contextual help icon for any route in one place.
//
// route_key takes priority over feature_key when both could apply, since it's
// the more specific identifier (e.g. "/finance/fees" gets its own article
// instead of falling back to the generic "finance" feature_key article).

export interface HelpRouteMatch {
    featureKey?: string;
    routeKey?: string;
}

export const HELP_ROUTE_MAP: Record<string, HelpRouteMatch> = {
    '/': { routeKey: 'dashboard' },
    '/prospects': { featureKey: 'scouting' },
    '/athletes': { featureKey: 'athletes' },
    '/assessments': { featureKey: 'assessments' },
    '/assessment-templates': { routeKey: 'assessment_templates' },
    '/development-plans': { featureKey: 'development_plans' },
    '/drills': { featureKey: 'drill_library' },
    '/videos': { featureKey: 'video_analysis' },
    '/competitions': { featureKey: 'competitions' },
    '/games': { featureKey: 'games' },
    '/training': { featureKey: 'training' },
    '/enrollments': { featureKey: 'enrollments' },
    '/finance': { featureKey: 'finance' },
    '/finance/fees': { routeKey: 'monthly_fees' },
    '/school-plans': { routeKey: 'school_plans' },
    '/groups': { routeKey: 'groups' },
    '/guardians': { routeKey: 'guardians' },
    '/seasons': { routeKey: 'seasons' },
    '/age-categories': { routeKey: 'age_categories' },
    '/club-site': { routeKey: 'club_site' },
    '/invitations': { routeKey: 'invitations' },
    '/store': { routeKey: 'store' },
    '/sponsors': { routeKey: 'sponsors' },
    '/facilities': { featureKey: 'facilities' },
    '/subscription': { routeKey: 'subscription' },
    '/plans': { routeKey: 'subscription' },
    '/settings': { routeKey: 'settings' },
};

// Suffix-based fallback for dynamic routes (e.g. "/athletes/:id/stats") where
// location.pathname contains the real id instead of the literal ":id".
const SUFFIX_ROUTE_MAP: { suffix: string; match: HelpRouteMatch }[] = [
    { suffix: '/stats', match: { routeKey: 'athlete_evolution' } },
    { suffix: '/evolution', match: { routeKey: 'athlete_evolution' } },
];

export function matchHelpRoute(pathname: string): HelpRouteMatch | null {
    if (HELP_ROUTE_MAP[pathname]) return HELP_ROUTE_MAP[pathname];
    for (const { suffix, match } of SUFFIX_ROUTE_MAP) {
        if (pathname.endsWith(suffix)) return match;
    }
    return null;
}
