
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { subscriptionService, SubscriptionInfo } from '../services/subscriptionService';
import { useTenant } from './TenantContext';
import { useAuth } from './AuthContext';

interface SubscriptionContextType {
    subscriptionInfo: SubscriptionInfo | null;
    loading: boolean;
    refreshSubscription: () => Promise<void>;
    canAccessApp: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
    const context = useContext(SubscriptionContext);
    if (!context) {
        throw new Error('useSubscription must be used within a SubscriptionProvider');
    }
    return context;
};

interface SubscriptionProviderProps {
    children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
    const { user } = useAuth();
    const { currentTenant, loading: tenantLoading } = useTenant();
    const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
    const [loading, setLoading] = useState(true);

    // Use useLayoutEffect to prevent flash of content before loading state is set
    React.useLayoutEffect(() => {
        // Only log if something important changed
        /* 
        console.log('[SubscriptionContext] useEffect triggered:', {
            hasUser: !!user,
            hasTenant: !!currentTenant,
            tenantId: currentTenant?.id,
            tenantLoading
        });
        */

        if (user?.id && currentTenant?.id && !tenantLoading) {
            setLoading(true);
            loadSubscriptionInfo();
        } else if (!user) {
            // No user = no subscription info needed
            setSubscriptionInfo(null);
            setLoading(false);
        } else if (!tenantLoading && !currentTenant) {
            // Finished loading but no tenant
            setSubscriptionInfo(null);
            setLoading(false);
        }
    }, [user?.id, currentTenant?.id, tenantLoading]);

    const loadSubscriptionInfo = async () => {
        if (!currentTenant?.id) {
            console.log('[SubscriptionContext] No tenant ID, skipping load');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            console.log('[SubscriptionContext] Loading subscription for tenant:', currentTenant.id);
            const info = await subscriptionService.getTrialInfo(currentTenant.id);
            console.log('[SubscriptionContext] Loaded subscription info:', info);
            setSubscriptionInfo(info);
        } catch (error) {
            console.error('[SubscriptionContext] Error loading subscription info:', error);
            setSubscriptionInfo(null);
        } finally {
            setLoading(false);
        }
    };

    const refreshSubscription = async () => {
        await loadSubscriptionInfo();
    };

    // User can access app ONLY if:
    // 1. subscriptionInfo is loaded AND (trial is active OR has active subscription)
    // If subscriptionInfo is null but we finished loading, they cannot access (safety)
    const canAccessApp = (() => {
        // Still loading = allow access temporarily (will re-check after load)
        if (loading) return true;

        // No subscription info after loading = cannot access
        if (!subscriptionInfo) return true; // Be permissive if we couldn't load info

        // Check if trial is active or has subscription
        return subscriptionInfo.subscriptionStatus === 'trial' ||
            subscriptionInfo.subscriptionStatus === 'active';
    })();



    return (
        <SubscriptionContext.Provider
            value={{
                subscriptionInfo,
                loading,
                refreshSubscription,
                canAccessApp,
            }}
        >
            {children}
        </SubscriptionContext.Provider>
    );
};


