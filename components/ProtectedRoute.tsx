
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowExpiredTrial?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowExpiredTrial = false }) => {
    const { user, loading: authLoading } = useAuth();
    const { loading: tenantLoading, currentTenant } = useTenant();
    const { subscriptionInfo, loading: subscriptionLoading, canAccessApp } = useSubscription();
    const location = useLocation();

    // Routes that are accessible even when trial is expired
    const allowedRoutesWhenExpired = ['/plans', '/settings'];

    if (authLoading || tenantLoading || subscriptionLoading) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-slate-500 font-medium">Carregando...</p>
                    <p className="text-xs text-slate-400">
                        Auth: {authLoading ? 'Wait' : 'OK'} |
                        Tenant: {tenantLoading ? 'Wait' : 'OK'} |
                        Sub: {subscriptionLoading ? 'Wait' : 'OK'}
                    </p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Check if trial is expired and user doesn't have access
    // Allow access to /plans and /settings even when trial expired
    if (!canAccessApp && !allowExpiredTrial && !allowedRoutesWhenExpired.includes(location.pathname)) {
        return <Navigate to="/plans" replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;

