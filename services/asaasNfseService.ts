import { supabase } from '../lib/supabase';
import { asaasModeHeader } from '../lib/asaasConfig';
import { platformSettingsService, PLATFORM_SETTING_KEYS, AsaasNfseSetting } from './platformSettingsService';

// NFS-e (nota fiscal de serviço) integration — disabled by default. The flag
// lives in platform_settings; the actual issuing runs server-side in the
// asaas-nfse edge function, which no-ops while the flag is off.
export const asaasNfseService = {
    async isEnabled(): Promise<boolean> {
        const setting = await platformSettingsService.get<AsaasNfseSetting>(PLATFORM_SETTING_KEYS.ASAAS_NFSE);
        return !!setting?.enabled;
    },

    async setEnabled(enabled: boolean): Promise<void> {
        await platformSettingsService.set(PLATFORM_SETTING_KEYS.ASAAS_NFSE, { enabled });
    },

    // Issues an NFS-e for a paid member invoice (only works when the flag is on
    // and the club's municipal fiscal config exists in Asaas).
    async issueForInvoice(tenantId: string, invoiceId: string, serviceDescription?: string): Promise<{ enabled: boolean; success?: boolean; nfse_id?: string; message?: string }> {
        const { data, error } = await supabase.functions.invoke('asaas-nfse', {
            body: { tenant_id: tenantId, invoice_id: invoiceId, service_description: serviceDescription },
            headers: asaasModeHeader(),
        });
        if (error) {
            let msg = data?.error || error.message || 'Erro ao emitir NFS-e.';
            try {
                const body = await (error as any).context?.json?.();
                if (body?.error) msg = body.error;
            } catch {}
            throw new Error(msg);
        }
        if (data?.error) throw new Error(data.error);
        return data;
    },
};
