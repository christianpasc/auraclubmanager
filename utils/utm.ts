/**
 * Where the lead came from.
 *
 * Nothing captured this before, so the CRM had no attribution to work with.
 * Captured on first touch and kept: the landing page is a separate WordPress
 * site, so the parameters arrive on the first app load and are long gone by
 * the time someone finishes signing up.
 *
 * The links on the landing page have to carry the parameters BEFORE the hash,
 * because the app uses HashRouter:
 *     app.auraclubmanager.io/?utm_source=google#/signup
 * The hash form (#/signup?utm_source=google) is read too, for safety.
 */

const STORAGE_KEY = 'aura_utm';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'] as const;

export type Utm = Partial<Record<typeof UTM_KEYS[number], string>>;

const readFromUrl = (): Utm => {
    const found: Utm = {};

    const collect = (search: string) => {
        if (!search) return;
        const params = new URLSearchParams(search);
        for (const key of UTM_KEYS) {
            const value = params.get(key)?.trim();
            // First one wins, so the main query string takes precedence.
            if (value && !found[key]) found[key] = value.slice(0, 200);
        }
    };

    collect(window.location.search);

    const hash = window.location.hash;
    const hashQuery = hash.indexOf('?');
    if (hashQuery !== -1) collect(hash.substring(hashQuery));

    return found;
};

/**
 * Stores the attribution of the first visit that carried any. Later visits do
 * not overwrite it — the campaign that brought someone in is the one worth
 * crediting, not the one they happened to arrive through on the day they
 * signed up.
 */
export const captureUtm = (): void => {
    try {
        const fromUrl = readFromUrl();
        if (Object.keys(fromUrl).length === 0) return;
        if (localStorage.getItem(STORAGE_KEY)) return;

        localStorage.setItem(STORAGE_KEY, JSON.stringify(fromUrl));
    } catch {
        // Private browsing, blocked storage: attribution is a nice-to-have and
        // must never get in the way of loading the app.
    }
};

/** What was captured, or null. */
export const readUtm = (): Utm | null => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;

        const parsed = JSON.parse(stored);
        if (!parsed || typeof parsed !== 'object') return null;

        const clean: Utm = {};
        for (const key of UTM_KEYS) {
            if (typeof parsed[key] === 'string' && parsed[key].trim()) {
                clean[key] = parsed[key].trim();
            }
        }
        return Object.keys(clean).length > 0 ? clean : null;
    } catch {
        return null;
    }
};
