/**
 * WhatsApp numbers, normalized to E.164.
 *
 * Brazil is the default market, so a number typed the way a Brazilian types it
 * — "(11) 98765-4321" — becomes +5511987654321. Someone who types a country
 * code explicitly is kept as typed, because signup is served in five languages
 * and refusing +351 or +1 would turn away the international signups the
 * waitlist is still collecting.
 */

/** The number in E.164 ("+5511987654321"), or null when it cannot be one. */
export const normalizePhone = (input: string): string | null => {
    const raw = (input ?? '').trim();
    if (!raw) return null;

    const explicitCountry = raw.startsWith('+');
    const digits = raw.replace(/\D/g, '');
    if (!digits) return null;

    // Typed with a country code: trust it, only check it could be a number.
    // E.164 allows up to 15 digits in total.
    if (explicitCountry) {
        return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
    }

    // International prefix dialled the old way, e.g. 00351912345678.
    if (digits.startsWith('00')) {
        const rest = digits.slice(2);
        return rest.length >= 8 && rest.length <= 15 ? `+${rest}` : null;
    }

    // Already carries 55 without the plus: 5511987654321.
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
        const national = digits.slice(2);
        return isBrazilianNumber(national) ? `+55${national}` : null;
    }

    // No country code at all: assume Brazil.
    if (digits.length === 10 || digits.length === 11) {
        return isBrazilianNumber(digits) ? `+55${digits}` : null;
    }

    return null;
};

/**
 * DDD plus subscriber number, Brazilian rules: mobile numbers have nine
 * digits and start with 9; landlines have eight and start with 2–5. Landlines
 * are accepted because WhatsApp Business can be registered on one, and plenty
 * of small academies use exactly that.
 */
const isBrazilianNumber = (national: string): boolean => {
    const ddd = Number(national.slice(0, 2));
    if (!Number.isInteger(ddd) || ddd < 11 || ddd > 99) return false;

    const subscriber = national.slice(2);
    if (subscriber.length === 9) return subscriber.startsWith('9');
    if (subscriber.length === 8) return /^[2-5]/.test(subscriber);
    return false;
};
