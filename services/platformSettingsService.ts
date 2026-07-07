
import { supabase } from '../lib/supabase';

export interface ChatWidgetSetting {
    enabled: boolean;
    embed_code: string;
}

export interface MaintenanceSetting {
    enabled: boolean;
    message: string;
}

// Asaas NFS-e (nota fiscal de serviço) issuance — off by default until the
// municipal service configuration is set up in Asaas. See asaas-nfse fn.
export interface AsaasNfseSetting {
    enabled: boolean;
}

export const PLATFORM_SETTING_KEYS = {
    CHAT_WIDGET: 'chat_widget',
    MAINTENANCE: 'maintenance',
    ASAAS_NFSE: 'asaas_nfse',
} as const;

export const platformSettingsService = {
    // Public, callable without auth — used on app boot.
    async get<T = unknown>(key: string): Promise<T | null> {
        const { data, error } = await supabase.rpc('get_platform_setting', { p_key: key });
        if (error) {
            console.error(`[platformSettingsService] Failed to read "${key}":`, error);
            return null;
        }
        return (data ?? null) as T | null;
    },

    async set(key: string, value: Record<string, unknown>): Promise<void> {
        const { error } = await supabase.rpc('admin_set_platform_setting', { p_key: key, p_value: value });
        if (error) throw error;
    },
};
