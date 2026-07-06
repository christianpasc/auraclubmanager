// Shared LGPD helper: anyone under 18 is a minor and requires documented
// guardian consent before their personal data (or images/videos) is stored.
export function isMinorFromBirthDate(birthDate?: string | null): boolean {
    if (!birthDate) return false;
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 18);
    return new Date(birthDate) > cutoff;
}
