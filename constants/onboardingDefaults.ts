// Defaults the onboarding wizard suggests on step 3 (structure).
// Nothing here is written automatically: every item is shown pre-checked and the
// user can uncheck or edit it before anything reaches the database.

export interface SuggestedAgeCategory {
    /** The "under N" age that names the category (9 → "Sub-9" / "U9"). */
    age: number;
    minBirthYear: number;
    maxBirthYear: number;
    sortOrder: number;
}

// Base categories used by Brazilian and European youth football alike. Each one
// spans a two-year band, except the oldest which absorbs the remaining years.
const BASE_AGES = [9, 11, 13, 15, 17, 20];

/**
 * Age categories for a given season year.
 * For 2026, Sub-13 covers players born in 2013 and 2014 — i.e. those turning 13
 * or 12 during the season. Bounds match ageCategoryService.matchCategory, which
 * tests `birthYear >= min_birth_year && birthYear <= max_birth_year`.
 */
export function suggestedAgeCategories(seasonYear: number): SuggestedAgeCategory[] {
    return BASE_AGES.map((age, index) => ({
        age,
        minBirthYear: seasonYear - age,
        // Each band ends just before the next-younger category begins, so the
        // categories are adjacent with no gaps and no overlaps. The youngest one
        // has nothing below it, so it gets the same two-year span as the others.
        maxBirthYear: index === 0
            ? seasonYear - age + 1
            : seasonYear - BASE_AGES[index - 1] - 1,
        sortOrder: index + 1,
    }));
}

/** Category display name, localized by prefix ("Sub-" in pt/es, "U" in en/fr). */
export function ageCategoryName(prefix: string, age: number): string {
    return `${prefix}${age}`;
}

/** The season the wizard proposes: the current calendar year, marked as current. */
export function suggestedSeasonYear(now: Date = new Date()): number {
    return now.getFullYear();
}
