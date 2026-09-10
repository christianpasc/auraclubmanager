// Country list shared by the onboarding wizard (step 1) and Settings > Club.
// Values are the canonical English names stored in tenants.settings.country --
// club-connect-onboard maps them to ISO codes, so do not localize the value.
// Labels come from the country.* i18n keys in LanguageContext.
export const COUNTRY_VALUES: string[] = [
    'Afghanistan',
    'Albania',
    'Algeria',
    'Angola',
    'Argentina',
    'Australia',
    'Austria',
    'Belgium',
    'Bolivia',
    'Brazil',
    'Canada',
    'Chile',
    'China',
    'Colombia',
    'Croatia',
    'Czech Republic',
    'Denmark',
    'Ecuador',
    'Egypt',
    'England',
    'France',
    'Germany',
    'Ghana',
    'Greece',
    'Hungary',
    'India',
    'Indonesia',
    'Iran',
    'Ireland',
    'Israel',
    'Italy',
    'Japan',
    'Kenya',
    'Mexico',
    'Morocco',
    'Netherlands',
    'New Zealand',
    'Nigeria',
    'Norway',
    'Paraguay',
    'Peru',
    'Poland',
    'Portugal',
    'Romania',
    'Russia',
    'Saudi Arabia',
    'Scotland',
    'Senegal',
    'Serbia',
    'South Africa',
    'South Korea',
    'Spain',
    'Sweden',
    'Switzerland',
    'Turkey',
    'Ukraine',
    'United Arab Emirates',
    'United States',
    'Uruguay',
    'Venezuela',
];

export interface CountryOption {
    value: string;
    label: string;
}

/** Builds the localized, alphabetically sorted country list for a <select>. */
export function buildCountryOptions(t: (key: string) => string): CountryOption[] {
    return COUNTRY_VALUES
        .map(value => ({ value, label: t('country.' + value) }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

// Suggested display currency per country, used to pre-fill the onboarding
// preferences step. Only the 18 codes offered by AVAILABLE_CURRENCIES are used,
// so countries with a currency the app does not carry fall back to USD.
const COUNTRY_CURRENCY: Record<string, string> = {
    Brazil: 'BRL',
    'United States': 'USD',
    Canada: 'CAD',
    Australia: 'AUD',
    Japan: 'JPY',
    China: 'CNY',
    Switzerland: 'CHF',
    Argentina: 'ARS',
    Chile: 'CLP',
    Colombia: 'COP',
    Mexico: 'MXN',
    Peru: 'PEN',
    Uruguay: 'UYU',
    Paraguay: 'PYG',
    Bolivia: 'BOB',
    // Pound sterling
    England: 'GBP',
    Scotland: 'GBP',
    // Eurozone
    Austria: 'EUR',
    Belgium: 'EUR',
    Croatia: 'EUR',
    Finland: 'EUR',
    France: 'EUR',
    Germany: 'EUR',
    Greece: 'EUR',
    Ireland: 'EUR',
    Italy: 'EUR',
    Netherlands: 'EUR',
    Portugal: 'EUR',
    Spain: 'EUR',
};

/** Currency to propose for a country; USD when we have nothing better. */
export function currencyForCountry(country: string | undefined | null): string {
    if (!country) return 'BRL';
    return COUNTRY_CURRENCY[country] || 'USD';
}
