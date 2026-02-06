import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { userService } from '../services/userService';

export interface UserPermissions extends Record<string, boolean> {
    view_dashboard: boolean;
    view_athletes: boolean;
    manage_athletes: boolean;
    view_enrollments: boolean;
    manage_enrollments: boolean;
    view_trainings: boolean;
    manage_trainings: boolean;
    view_competitions: boolean;
    manage_competitions: boolean;
    view_games: boolean;
    manage_games: boolean;
    view_finance: boolean;
    manage_finance: boolean;
    view_monthly_fees: boolean;
    manage_monthly_fees: boolean;
    manage_settings: boolean;
    manage_users: boolean;
}

interface UsePermissionsResult {
    permissions: UserPermissions | null;
    role: string | null;
    isOwner: boolean;
    isAdmin: boolean;
    loading: boolean;
    hasPermission: (permission: keyof UserPermissions) => boolean;
    canManage: (resource: string) => boolean;
    canView: (resource: string) => boolean;
    refreshPermissions: () => Promise<void>;
}

export const usePermissions = (): UsePermissionsResult => {
    const { user } = useAuth();
    const { currentTenant } = useTenant();
    const [permissions, setPermissions] = useState<UserPermissions | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [isOwner, setIsOwner] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadPermissions = useCallback(async () => {
        if (!user || !currentTenant?.id) {
            setPermissions(null);
            setRole(null);
            setIsOwner(false);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('tenant_users')
                .select('role, is_owner, permissions')
                .eq('tenant_id', currentTenant.id)
                .eq('user_id', user.id)
                .single();

            if (error) {
                console.error('Error loading permissions:', error);
                // Default to view-only permissions if error
                setPermissions(userService.getDefaultPermissions('member') as UserPermissions);
                setRole('member');
                setIsOwner(false);
            } else {
                const userRole = data.role || 'member';
                const userIsOwner = data.is_owner || false;

                // If user is owner, give all permissions
                if (userIsOwner) {
                    setPermissions(userService.getDefaultPermissions('owner') as UserPermissions);
                } else {
                    // Use stored permissions or defaults for role
                    setPermissions(
                        (data.permissions as UserPermissions) ||
                        (userService.getDefaultPermissions(userRole) as UserPermissions)
                    );
                }
                setRole(userRole);
                setIsOwner(userIsOwner);
            }
        } catch (error) {
            console.error('Error in loadPermissions:', error);
            setPermissions(userService.getDefaultPermissions('member') as UserPermissions);
        } finally {
            setLoading(false);
        }
    }, [user, currentTenant]);

    useEffect(() => {
        loadPermissions();
    }, [loadPermissions]);

    const hasPermission = useCallback((permission: keyof UserPermissions): boolean => {
        if (isOwner) return true;
        if (!permissions) return false;
        return permissions[permission] === true;
    }, [permissions, isOwner]);

    const canManage = useCallback((resource: string): boolean => {
        if (isOwner) return true;
        const key = `manage_${resource}` as keyof UserPermissions;
        return hasPermission(key);
    }, [hasPermission, isOwner]);

    const canView = useCallback((resource: string): boolean => {
        if (isOwner) return true;
        const viewKey = `view_${resource}` as keyof UserPermissions;
        const manageKey = `manage_${resource}` as keyof UserPermissions;
        return hasPermission(viewKey) || hasPermission(manageKey);
    }, [hasPermission, isOwner]);

    const isAdmin = role === 'admin' || role === 'owner' || isOwner;

    return {
        permissions,
        role,
        isOwner,
        isAdmin,
        loading,
        hasPermission,
        canManage,
        canView,
        refreshPermissions: loadPermissions,
    };
};

export default usePermissions;
