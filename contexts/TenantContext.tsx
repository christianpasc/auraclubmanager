
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { tenantService, Tenant } from '../services/tenantService';
import { useAuth } from './AuthContext';

// Global variable to store current tenant ID for use outside React
let _currentTenantId: string | null = null;

export const getCurrentTenantIdSync = (): string | null => _currentTenantId;

interface TenantContextType {
    currentTenant: Tenant | null;
    tenants: Tenant[];
    loading: boolean;
    setCurrentTenant: (tenant: Tenant) => Promise<void>;
    refreshTenants: () => Promise<void>;
    createTenant: (name: string) => Promise<Tenant>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const useTenant = () => {
    const context = useContext(TenantContext);
    if (!context) {
        throw new Error('useTenant must be used within a TenantProvider');
    }
    return context;
};

interface TenantProviderProps {
    children: ReactNode;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
    const { user } = useAuth();
    const [currentTenant, setCurrentTenantState] = useState<Tenant | null>(null);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);

    // Use useLayoutEffect to prevent flash of content before loading state is set
    React.useLayoutEffect(() => {
        if (user?.id) {
            setLoading(true);
            loadTenants();
        } else if (!user) {
            setCurrentTenantState(null);
            setTenants([]);
            setLoading(false);
        }
    }, [user?.id]);

    const loadTenants = async () => {
        if (!user?.id) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            // Fetch tenants and profile (for current_tenant_id) in parallel
            const [myTenants, { data: profile }] = await Promise.all([
                tenantService.getMyTenants(),
                // We access supabase directly here to avoid a redundant full tenant fetch in getCurrentTenant
                // We only need the ID to match against the list we just fetched
                import('../lib/supabase').then(({ supabase }) =>
                    supabase.from('profiles').select('current_tenant_id').eq('id', user.id).single()
                )
            ]);

            setTenants(myTenants);

            // Derive current tenant from the list instead of fetching it again
            let current = null;
            const currentId = profile?.current_tenant_id || null;
            if (currentId) {
                current = myTenants.find(t => t.id === currentId) || null;
            }

            setCurrentTenantState(current);
            _currentTenantId = current?.id || null;

            // If user has tenants but no current (or current not found in list), set the first one
            if (myTenants.length > 0 && !current) {
                // Determine which one to set
                const firstTenant = myTenants[0];

                // Fire and forget the update to profile to verify preference
                tenantService.setCurrentTenant(firstTenant.id!).catch(console.error);

                setCurrentTenantState(firstTenant);
                _currentTenantId = firstTenant.id || null;
            }
        } catch (error) {
            console.error('Error loading tenants:', error);
            // Even on error, we stop loading - user can still see the app
        } finally {
            setLoading(false);
        }
    };

    const setCurrentTenant = async (tenant: Tenant) => {
        await tenantService.setCurrentTenant(tenant.id!);
        setCurrentTenantState(tenant);
    };

    const refreshTenants = async () => {
        await loadTenants();
    };

    const createTenant = async (name: string) => {
        const slug = tenantService.generateSlug(name);
        const newTenant = await tenantService.create({ name, slug });
        await loadTenants();
        return newTenant;
    };

    return (
        <TenantContext.Provider
            value={{
                currentTenant,
                tenants,
                loading,
                setCurrentTenant,
                refreshTenants,
                createTenant,
            }}
        >
            {children}
        </TenantContext.Provider>
    );
};
