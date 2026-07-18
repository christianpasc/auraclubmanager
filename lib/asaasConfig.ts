// Asaas environment auto-detection, mirroring lib/stripe.ts's stripeConfig.
// localhost / LAN → sandbox, anything else → production. The chosen mode is
// sent to every asaas-* edge function via the x-asaas-mode header, so the
// function picks the matching root key + base URL without swapping secrets.

const isProduction = window.location.hostname !== 'localhost'
    && window.location.hostname !== '127.0.0.1'
    && !window.location.hostname.includes('192.168.');

export const asaasConfig = {
    isProduction,
    get mode(): 'sandbox' | 'production' {
        return isProduction ? 'production' : 'sandbox';
    },
};

export const asaasModeHeader = (): Record<string, string> => ({ 'x-asaas-mode': asaasConfig.mode });
