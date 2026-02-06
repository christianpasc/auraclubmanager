import { supabase } from '../lib/supabase';

export interface UserProfile {
    id: string;
    email: string;
    full_name?: string;
    phone?: string;
    avatar_url?: string;
    current_tenant_id?: string;
    notification_settings?: NotificationSettings;
    created_at?: string;
    updated_at?: string;
}

export interface NotificationSettings {
    email_new_enrollment: boolean;
    email_payment_received: boolean;
    email_payment_overdue: boolean;
    email_training_reminder: boolean;
    email_system_alerts: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
    email_new_enrollment: true,
    email_payment_received: true,
    email_payment_overdue: true,
    email_training_reminder: false,
    email_system_alerts: true,
};

export const userService = {
    /**
     * Get current user's profile
     */
    async getCurrentProfile(): Promise<UserProfile | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('Error fetching profile:', error);
            return null;
        }

        return {
            id: user.id,
            email: user.email || '',
            full_name: profile?.full_name || user.user_metadata?.full_name,
            phone: profile?.phone,
            avatar_url: profile?.avatar_url,
            current_tenant_id: profile?.current_tenant_id,
            notification_settings: profile?.notification_settings || DEFAULT_NOTIFICATION_SETTINGS,
            created_at: profile?.created_at,
            updated_at: profile?.updated_at,
        };
    },

    /**
     * Update user profile
     */
    async updateProfile(updates: Partial<Pick<UserProfile, 'full_name' | 'phone' | 'avatar_url'>>) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Use upsert to create profile if it doesn't exist
        const { data, error } = await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                ...updates,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'id' })
            .select()
            .single();

        if (error) throw error;

        // Also update auth user metadata for name
        if (updates.full_name) {
            await supabase.auth.updateUser({
                data: { full_name: updates.full_name }
            });
        }

        return data;
    },

    /**
     * Update notification settings
     */
    async updateNotificationSettings(settings: Partial<NotificationSettings>) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Get current settings first
        const currentProfile = await this.getCurrentProfile();
        const currentSettings = currentProfile?.notification_settings || DEFAULT_NOTIFICATION_SETTINGS;

        const { data, error } = await supabase
            .from('profiles')
            .update({
                notification_settings: { ...currentSettings, ...settings },
                updated_at: new Date().toISOString(),
            })
            .eq('id', user.id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Change user password
     */
    async changePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    },

    /**
     * Upload avatar image
     */
    async uploadAvatar(file: File): Promise<string> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('profiles')
            .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('profiles')
            .getPublicUrl(filePath);

        // Update profile with new avatar URL
        await this.updateProfile({ avatar_url: data.publicUrl });

        return data.publicUrl;
    },

    /**
     * Invite a new user to a tenant
     */
    async inviteUserToTenant(
        email: string,
        tenantId: string,
        role: 'admin' | 'manager' | 'member' = 'member',
        permissions?: Record<string, boolean>
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Call Edge Function to create user and add to tenant
            // This uses the service role key to bypass RLS issues
            const { data, error } = await supabase.functions.invoke('invite-user', {
                body: {
                    email,
                    tenantId,
                    role,
                    permissions: permissions || this.getDefaultPermissions(role),
                }
            });

            if (error) {
                const errorMessage = error.message || 'Error calling invite function';
                return { success: false, error: errorMessage };
            }

            if (data?.error) {
                return { success: false, error: data.error };
            }

            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Get default permissions based on role
     */
    getDefaultPermissions(role: string): Record<string, boolean> {
        const basePermissions = {
            view_dashboard: true,
            view_athletes: true,
            manage_athletes: false,
            view_enrollments: true,
            manage_enrollments: false,
            view_trainings: true,
            manage_trainings: false,
            view_competitions: true,
            manage_competitions: false,
            view_games: true,
            manage_games: false,
            view_finance: false,
            manage_finance: false,
            view_monthly_fees: false,
            manage_monthly_fees: false,
            manage_settings: false,
            manage_users: false,
        };

        switch (role) {
            case 'admin':
            case 'owner':
                // Admin has all permissions
                return Object.fromEntries(
                    Object.keys(basePermissions).map(key => [key, true])
                );
            case 'manager':
                // Manager can manage most things except users and some settings
                return {
                    ...basePermissions,
                    manage_athletes: true,
                    manage_enrollments: true,
                    manage_trainings: true,
                    manage_competitions: true,
                    manage_games: true,
                    view_finance: true,
                    view_monthly_fees: true,
                };
            case 'member':
            default:
                // Member has view-only access
                return basePermissions;
        }
    },
};

export const AVAILABLE_ROLES = [
    { value: 'admin', label: 'Administrador', description: 'Acesso total ao sistema' },
    { value: 'manager', label: 'Gerente', description: 'Gerencia operações do dia-a-dia' },
    { value: 'member', label: 'Membro', description: 'Acesso de visualização apenas' },
];

export const PERMISSION_GROUPS = [
    {
        label: 'Dashboard',
        permissions: [
            { key: 'view_dashboard', label: 'Visualizar Dashboard' },
        ],
    },
    {
        label: 'Atletas',
        permissions: [
            { key: 'view_athletes', label: 'Visualizar Atletas' },
            { key: 'manage_athletes', label: 'Gerenciar Atletas' },
        ],
    },
    {
        label: 'Matrículas',
        permissions: [
            { key: 'view_enrollments', label: 'Visualizar Matrículas' },
            { key: 'manage_enrollments', label: 'Gerenciar Matrículas' },
        ],
    },
    {
        label: 'Treinos',
        permissions: [
            { key: 'view_trainings', label: 'Visualizar Treinos' },
            { key: 'manage_trainings', label: 'Gerenciar Treinos' },
        ],
    },
    {
        label: 'Competições',
        permissions: [
            { key: 'view_competitions', label: 'Visualizar Competições' },
            { key: 'manage_competitions', label: 'Gerenciar Competições' },
        ],
    },
    {
        label: 'Jogos',
        permissions: [
            { key: 'view_games', label: 'Visualizar Jogos' },
            { key: 'manage_games', label: 'Gerenciar Jogos' },
        ],
    },
    {
        label: 'Financeiro',
        permissions: [
            { key: 'view_finance', label: 'Visualizar Financeiro' },
            { key: 'manage_finance', label: 'Gerenciar Financeiro' },
            { key: 'view_monthly_fees', label: 'Visualizar Mensalidades' },
            { key: 'manage_monthly_fees', label: 'Gerenciar Mensalidades' },
        ],
    },
    {
        label: 'Configurações',
        permissions: [
            { key: 'manage_settings', label: 'Gerenciar Configurações' },
            { key: 'manage_users', label: 'Gerenciar Usuários' },
        ],
    },
];
