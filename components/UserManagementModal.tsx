import React, { useState, useEffect } from 'react';
import { X, Loader2, ChevronDown, Mail, Shield, Check } from 'lucide-react';
import { userService, AVAILABLE_ROLES, PERMISSION_GROUPS } from '../services/userService';
import { tenantService, TenantUser } from '../services/tenantService';
import { useTenant } from '../contexts/TenantContext';
import { useLanguage } from '../contexts/LanguageContext';

interface UserManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    editingUser?: TenantUser | null;
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({
    isOpen,
    onClose,
    onSaved,
    editingUser,
}) => {
    const { currentTenant } = useTenant();
    const { language } = useLanguage();
    const isEditing = !!editingUser;

    const [email, setEmail] = useState('');
    const [role, setRole] = useState<string>('member');
    const [permissions, setPermissions] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPermissions, setShowPermissions] = useState(false);

    const getText = (pt: string, en: string, es: string) => {
        return language === 'en-US' ? en : language === 'es-ES' ? es : pt;
    };

    useEffect(() => {
        if (isOpen) {
            if (editingUser) {
                setRole(editingUser.role || 'member');
                setPermissions((editingUser as any).permissions || userService.getDefaultPermissions(editingUser.role || 'member'));
            } else {
                setEmail('');
                setRole('member');
                setPermissions(userService.getDefaultPermissions('member'));
            }
            setError(null);
            setShowPermissions(false);
        }
    }, [isOpen, editingUser]);

    const handleRoleChange = (newRole: string) => {
        setRole(newRole);
        // Update permissions based on new role
        setPermissions(userService.getDefaultPermissions(newRole));
    };

    const togglePermission = (key: string) => {
        setPermissions(prev => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentTenant?.id) return;

        setSaving(true);
        setError(null);

        try {
            if (isEditing && editingUser) {
                // Update existing user's role and permissions
                await tenantService.updateUserRole(currentTenant.id, editingUser.user_id, role, permissions);
            } else {
                // Invite new user
                if (!email.trim()) {
                    setError(getText('Email é obrigatório', 'Email is required', 'El email es requerido'));
                    setSaving(false);
                    return;
                }

                const result = await userService.inviteUserToTenant(
                    email.trim(),
                    currentTenant.id,
                    role as 'admin' | 'manager' | 'member',
                    permissions
                );

                if (!result.success) {
                    setError(result.error || getText('Erro ao convidar usuário', 'Error inviting user', 'Error al invitar usuario'));
                    setSaving(false);
                    return;
                }
            }

            onSaved();
            onClose();
        } catch (err: any) {
            setError(err.message || getText('Erro ao salvar', 'Error saving', 'Error al guardar'));
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800">
                        {isEditing
                            ? getText('Editar Usuário', 'Edit User', 'Editar Usuario')
                            : getText('Convidar Usuário', 'Invite User', 'Invitar Usuario')
                        }
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    {/* Email (only for new users) */}
                    {!isEditing && (
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                <Mail className="w-4 h-4 inline mr-2" />
                                {getText('Email do Usuário', 'User Email', 'Email del Usuario')} *
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="usuario@email.com"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                {getText(
                                    'O usuário receberá um email para criar sua senha.',
                                    'The user will receive an email to set their password.',
                                    'El usuario recibirá un email para crear su contraseña.'
                                )}
                            </p>
                        </div>
                    )}

                    {/* Role Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            <Shield className="w-4 h-4 inline mr-2" />
                            {getText('Perfil de Acesso', 'Access Profile', 'Perfil de Acceso')}
                        </label>
                        <div className="space-y-2">
                            {AVAILABLE_ROLES.map((r) => (
                                <label
                                    key={r.value}
                                    className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${role === r.value
                                            ? 'border-primary bg-primary/5'
                                            : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="role"
                                        value={r.value}
                                        checked={role === r.value}
                                        onChange={() => handleRoleChange(r.value)}
                                        className="hidden"
                                    />
                                    <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${role === r.value ? 'border-primary bg-primary' : 'border-slate-300'
                                        }`}>
                                        {role === r.value && <Check className="w-2.5 h-2.5 text-white" />}
                                    </div>
                                    <div>
                                        <span className="font-semibold text-slate-800">{r.label}</span>
                                        <p className="text-xs text-slate-500">{r.description}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Custom Permissions */}
                    <div>
                        <button
                            type="button"
                            onClick={() => setShowPermissions(!showPermissions)}
                            className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-dark"
                        >
                            <ChevronDown className={`w-4 h-4 transition-transform ${showPermissions ? 'rotate-180' : ''}`} />
                            {getText('Personalizar Permissões', 'Customize Permissions', 'Personalizar Permisos')}
                        </button>

                        {showPermissions && (
                            <div className="mt-4 space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                                {PERMISSION_GROUPS.map((group) => (
                                    <div key={group.label}>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{group.label}</h4>
                                        <div className="space-y-1">
                                            {group.permissions.map((perm) => (
                                                <label
                                                    key={perm.key}
                                                    className="flex items-center gap-2 cursor-pointer py-1"
                                                >
                                                    <div
                                                        onClick={() => togglePermission(perm.key)}
                                                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${permissions[perm.key]
                                                                ? 'bg-primary border-primary'
                                                                : 'border-slate-300 bg-white'
                                                            }`}
                                                    >
                                                        {permissions[perm.key] && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <span className="text-sm text-slate-700">{perm.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            {getText('Cancelar', 'Cancel', 'Cancelar')}
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 px-4 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isEditing
                                ? getText('Salvar', 'Save', 'Guardar')
                                : getText('Convidar', 'Invite', 'Invitar')
                            }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserManagementModal;
