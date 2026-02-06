
import React, { useState, useEffect, useRef } from 'react';
import { Building2, User, Bell, Shield, Camera, Save, Globe, Check, Loader2, Users, Plus, Edit2, Trash2, Eye, EyeOff, X, Lock, Mail } from 'lucide-react';
import { useLanguage, AVAILABLE_LANGUAGES } from '../contexts/LanguageContext';
import { useTenant } from '../contexts/TenantContext';
import { storageService } from '../services/storageService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { tenantService, TenantUser } from '../services/tenantService';
import { userService, UserProfile, NotificationSettings, DEFAULT_NOTIFICATION_SETTINGS } from '../services/userService';
import { usePermissions } from '../hooks/usePermissions';
import UserManagementModal from '../components/UserManagementModal';
import ConfirmModal from '../components/ConfirmModal';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('club');
  const { language, setLanguage, t } = useLanguage();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { isAdmin, isOwner } = usePermissions();

  const getText = (pt: string, en: string, es: string) => {
    return language === 'en-US' ? en : language === 'es-ES' ? es : pt;
  };

  // Common states
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Club settings state
  const [clubName, setClubName] = useState('');
  const [clubLogo, setClubLogo] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [cnpj, setCnpj] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('SP');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Security state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);

  // Users state
  const [tenantUsers, setTenantUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userModal, setUserModal] = useState<{ isOpen: boolean; user: TenantUser | null }>({ isOpen: false, user: null });
  const [deleteUserModal, setDeleteUserModal] = useState<{ isOpen: boolean; user: any; loading: boolean }>({ isOpen: false, user: null, loading: false });

  // Language state
  const [selectedLanguage, setSelectedLanguage] = useState(language);

  // Load data on mount
  useEffect(() => {
    if (currentTenant) {
      setClubName(currentTenant.name || '');
      setClubLogo(currentTenant.logo_url || null);
      const settings = currentTenant.settings as any;
      if (settings) {
        setCnpj(settings.cnpj || '');
        setCity(settings.city || '');
        setState(settings.state || 'SP');
      }
    }
  }, [currentTenant]);

  useEffect(() => {
    loadProfile();
  }, [user]);

  useEffect(() => {
    if (currentTenant?.id && activeTab === 'users') {
      loadUsers();
    }
  }, [currentTenant, activeTab]);

  useEffect(() => {
    setSelectedLanguage(language);
  }, [language]);

  const loadProfile = async () => {
    setProfileLoading(true);
    try {
      const data = await userService.getCurrentProfile();
      if (data) {
        setProfile(data);
        setProfileName(data.full_name || '');
        setProfilePhone(data.phone || '');
        setNotifications(data.notification_settings || DEFAULT_NOTIFICATION_SETTINGS);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const loadUsers = async () => {
    if (!currentTenant?.id || !user?.id) return;
    setUsersLoading(true);
    try {
      // First, check if current user exists in tenant_users
      const { data: existingUser, error: checkError } = await supabase
        .from('tenant_users')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('user_id', user.id)
        .single();

      // If user doesn't exist in tenant_users, create the record as owner
      if (checkError && checkError.code === 'PGRST116') {
        console.log('Owner not found in tenant_users, creating...');
        await supabase
          .from('tenant_users')
          .insert({
            tenant_id: currentTenant.id,
            user_id: user.id,
            role: 'owner',
            is_owner: true,
          });
      }

      // Use Edge Function to get users with their emails
      const { data, error } = await supabase.functions.invoke('get-tenant-users', {
        body: { tenantId: currentTenant.id }
      });

      console.log('=== GET TENANT USERS RESPONSE ===');
      console.log('Data:', data);
      console.log('Error:', error);

      if (error) {
        console.error('Error calling get-tenant-users:', error);
        throw error;
      }

      if (data?.success && data?.users) {
        console.log('Users loaded:', data.users);
        setTenantUsers(data.users);
      } else if (data?.error) {
        console.error('Error from get-tenant-users:', data.error);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  // Handle logo selection (preview only)
  const handleLogoSelect = (file: File) => {
    // Create a preview URL
    const previewUrl = URL.createObjectURL(file);
    setClubLogo(previewUrl);
    setLogoFile(file);
  };

  // Save handlers
  const handleSaveClub = async () => {
    if (!currentTenant?.id) return;
    setSaving(true);
    setError(null);

    const hasNewLogo = !!logoFile;

    try {
      let logoUrl = currentTenant.logo_url;

      // Upload logo if a new file was selected
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${currentTenant.id}-logo-${Date.now()}.${fileExt}`;
        const filePath = `logos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('tenants')
          .upload(filePath, logoFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('tenants')
          .getPublicUrl(filePath);

        logoUrl = data.publicUrl;
        setLogoFile(null); // Clear the file after upload
      }

      await tenantService.update(currentTenant.id, {
        name: clubName,
        logo_url: logoUrl || undefined,
        settings: {
          ...(currentTenant.settings as any),
          cnpj,
          city,
          state,
        },
      });

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        // Reload to update sidebar with new logo
        if (hasNewLogo) {
          window.location.reload();
        }
      }, 1000);
    } catch (err) {
      setError(getText('Erro ao salvar', 'Error saving', 'Error al guardar'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError(null);

    const hasNewAvatar = !!avatarFile;

    try {
      // Upload avatar if a new file was selected
      if (avatarFile) {
        await userService.uploadAvatar(avatarFile);
        setAvatarFile(null);
        setAvatarPreview(null);
      }

      await userService.updateProfile({
        full_name: profileName,
        phone: profilePhone,
      });

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        // Reload to update header with new profile data
        if (hasNewAvatar || profileName !== profile?.full_name) {
          window.location.reload();
        }
      }, 1000);
    } catch (err) {
      setError(getText('Erro ao salvar perfil', 'Error saving profile', 'Error al guardar perfil'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    setError(null);
    try {
      await userService.updateNotificationSettings(notifications);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(getText('Erro ao salvar', 'Error saving', 'Error al guardar'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError(getText('A senha deve ter pelo menos 6 caracteres', 'Password must be at least 6 characters', 'La contraseña debe tener al menos 6 caracteres'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(getText('As senhas não coincidem', 'Passwords do not match', 'Las contraseñas no coinciden'));
      return;
    }

    setSaving(true);
    try {
      const result = await userService.changePassword(newPassword);
      if (result.success) {
        setSaved(true);
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setSaved(false), 2000);
      } else {
        setPasswordError(result.error || getText('Erro ao alterar senha', 'Error changing password', 'Error al cambiar contraseña'));
      }
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLanguage = async () => {
    setSaving(true);
    await setLanguage(selectedLanguage);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Handle avatar selection (preview only)
  const handleAvatarSelect = (file: File) => {
    // Create a preview URL
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    setAvatarFile(file);
  };

  const handleRemoveUser = async () => {
    if (!deleteUserModal.user || !currentTenant?.id) return;
    setDeleteUserModal(prev => ({ ...prev, loading: true }));
    try {
      await tenantService.removeUser(currentTenant.id, deleteUserModal.user.user_id);
      loadUsers();
      setDeleteUserModal({ isOpen: false, user: null, loading: false });
    } catch (err) {
      console.error('Error removing user:', err);
      setDeleteUserModal(prev => ({ ...prev, loading: false }));
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return getText('Proprietário', 'Owner', 'Propietario');
      case 'admin': return getText('Administrador', 'Admin', 'Administrador');
      case 'manager': return getText('Gerente', 'Manager', 'Gerente');
      case 'member': return getText('Membro', 'Member', 'Miembro');
      default: return role;
    }
  };

  const tabs = [
    { id: 'club', icon: Building2, label: getText('Clube', 'Club', 'Club') },
    { id: 'preferences', icon: Globe, label: getText('Preferências', 'Preferences', 'Preferencias') },
    { id: 'profile', icon: User, label: getText('Meu Perfil', 'My Profile', 'Mi Perfil') },
    { id: 'notifications', icon: Bell, label: getText('Notificações', 'Notifications', 'Notificaciones') },
    { id: 'security', icon: Shield, label: getText('Segurança', 'Security', 'Seguridad') },
    { id: 'users', icon: Users, label: getText('Usuários', 'Users', 'Usuarios') },
  ];

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all relative whitespace-nowrap ${activeTab === tab.id ? 'text-primary' : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full"></div>}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        {/* Club Tab */}
        {activeTab === 'club' && (
          <div className="space-y-8">
            <div className="flex items-center gap-6 pb-8 border-b border-slate-100">
              <div className="relative group">
                <img
                  src={clubLogo || 'https://via.placeholder.com/100x100?text=Logo'}
                  alt="Logo"
                  className="w-24 h-24 rounded-2xl border border-slate-200 object-cover"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera className="w-6 h-6 text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleLogoSelect(e.target.files[0])}
                />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">{getText('Logo do Clube', 'Club Logo', 'Logo del Club')}</h3>
                <p className="text-sm text-slate-500 mt-1">{getText('Recomendado: PNG ou JPG, min. 512x512px.', 'Recommended: PNG or JPG, min. 512x512px.', 'Recomendado: PNG o JPG, min. 512x512px.')}</p>
                {logoFile && (
                  <p className="text-xs text-primary mt-1 font-semibold">{getText('Nova imagem selecionada - clique em Salvar para aplicar', 'New image selected - click Save to apply', 'Nueva imagen seleccionada - haga clic en Guardar para aplicar')}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">{getText('Nome Fantasia', 'Trade Name', 'Nombre Comercial')}</label>
                <input
                  type="text"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">CNPJ</label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">{getText('Cidade', 'City', 'Ciudad')}</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">{getText('Estado (UF)', 'State', 'Estado')}</label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="SP">São Paulo</option>
                  <option value="RJ">Rio de Janeiro</option>
                  <option value="MG">Minas Gerais</option>
                  <option value="RS">Rio Grande do Sul</option>
                  <option value="PR">Paraná</option>
                  <option value="SC">Santa Catarina</option>
                  <option value="BA">Bahia</option>
                  <option value="GO">Goiás</option>
                  <option value="DF">Distrito Federal</option>
                  <option value="CE">Ceará</option>
                </select>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="pt-6 flex justify-end gap-3">
              <button
                onClick={handleSaveClub}
                disabled={saving}
                className="flex items-center gap-2 px-8 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
              >
                {saved ? <Check className="w-4 h-4" /> : saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? getText('Salvando...', 'Saving...', 'Guardando...') : saved ? getText('Salvo!', 'Saved!', '¡Guardado!') : getText('Salvar', 'Save', 'Guardar')}
              </button>
            </div>
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">{getText('Preferências do Sistema', 'System Preferences', 'Preferencias del Sistema')}</h3>
              <p className="text-sm text-slate-500">{getText('Configure como o sistema se comporta.', 'Configure how the system behaves.', 'Configure cómo se comporta el sistema.')}</p>
            </div>

            <div className="p-6 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Globe className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800">{getText('Idioma', 'Language', 'Idioma')}</h4>
                  <p className="text-sm text-slate-500 mt-1">{getText('Selecione o idioma do sistema.', 'Select the system language.', 'Seleccione el idioma del sistema.')}</p>
                  <div className="mt-4">
                    <select
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value as typeof language)}
                      className="w-full max-w-xs px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    >
                      {AVAILABLE_LANGUAGES.map(lang => (
                        <option key={lang.value} value={lang.value}>{lang.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 flex justify-end">
              <button
                onClick={handleSaveLanguage}
                disabled={saving || selectedLanguage === language}
                className="flex items-center gap-2 px-8 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
              >
                {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saving ? getText('Salvando...', 'Saving...', 'Guardando...') : saved ? getText('Salvo!', 'Saved!', '¡Guardado!') : getText('Salvar', 'Save', 'Guardar')}
              </button>
            </div>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-8">
            {profileLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-6 pb-8 border-b border-slate-100">
                  <div className="relative group">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar Preview" className="w-24 h-24 rounded-full border-2 border-primary object-cover" />
                    ) : profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-24 h-24 rounded-full border-2 border-slate-200 object-cover" />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
                        {profileName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    <button
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Camera className="w-6 h-6 text-white" />
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleAvatarSelect(e.target.files[0])}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{getText('Foto do Perfil', 'Profile Photo', 'Foto de Perfil')}</h3>
                    <p className="text-sm text-slate-500 mt-1">{getText('Clique para alterar sua foto.', 'Click to change your photo.', 'Haga clic para cambiar su foto.')}</p>
                    {avatarFile && (
                      <p className="text-xs text-primary mt-1 font-semibold">{getText('Nova foto selecionada - clique em Salvar para aplicar', 'New photo selected - click Save to apply', 'Nueva foto seleccionada - haga clic en Guardar para aplicar')}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">{getText('Nome Completo', 'Full Name', 'Nombre Completo')}</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-600">{user?.email}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">{getText('Telefone', 'Phone', 'Teléfono')}</label>
                    <input
                      type="tel"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="pt-6 flex justify-end">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="flex items-center gap-2 px-8 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
                  >
                    {saved ? <Check className="w-4 h-4" /> : saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? getText('Salvando...', 'Saving...', 'Guardando...') : saved ? getText('Salvo!', 'Saved!', '¡Guardado!') : getText('Salvar', 'Save', 'Guardar')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">{getText('Notificações por Email', 'Email Notifications', 'Notificaciones por Email')}</h3>
              <p className="text-sm text-slate-500">{getText('Configure quais notificações deseja receber.', 'Configure which notifications you want to receive.', 'Configure qué notificaciones desea recibir.')}</p>
            </div>

            <div className="space-y-4">
              {[
                { key: 'email_new_enrollment', label: getText('Nova matrícula', 'New enrollment', 'Nueva matrícula'), desc: getText('Quando um novo atleta é matriculado', 'When a new athlete is enrolled', 'Cuando un nuevo atleta se matricula') },
                { key: 'email_payment_received', label: getText('Pagamento recebido', 'Payment received', 'Pago recibido'), desc: getText('Quando um pagamento é confirmado', 'When a payment is confirmed', 'Cuando un pago es confirmado') },
                { key: 'email_payment_overdue', label: getText('Pagamento em atraso', 'Payment overdue', 'Pago atrasado'), desc: getText('Quando uma mensalidade está vencida', 'When a fee is overdue', 'Cuando una mensualidad está vencida') },
                { key: 'email_training_reminder', label: getText('Lembrete de treino', 'Training reminder', 'Recordatorio de entrenamiento'), desc: getText('Lembretes sobre treinos agendados', 'Reminders about scheduled trainings', 'Recordatorios sobre entrenamientos programados') },
                { key: 'email_system_alerts', label: getText('Alertas do sistema', 'System alerts', 'Alertas del sistema'), desc: getText('Atualizações importantes do sistema', 'Important system updates', 'Actualizaciones importantes del sistema') },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-slate-800">{item.label}</p>
                    <p className="text-sm text-slate-500">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => setNotifications(prev => ({ ...prev, [item.key]: !prev[item.key as keyof NotificationSettings] }))}
                    className={`w-12 h-6 rounded-full transition-colors relative ${notifications[item.key as keyof NotificationSettings] ? 'bg-primary' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifications[item.key as keyof NotificationSettings] ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-6 flex justify-end">
              <button
                onClick={handleSaveNotifications}
                disabled={saving}
                className="flex items-center gap-2 px-8 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
              >
                {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saving ? getText('Salvando...', 'Saving...', 'Guardando...') : saved ? getText('Salvo!', 'Saved!', '¡Guardado!') : getText('Salvar', 'Save', 'Guardar')}
              </button>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">{getText('Alterar Senha', 'Change Password', 'Cambiar Contraseña')}</h3>
              <p className="text-sm text-slate-500">{getText('Digite uma nova senha segura.', 'Enter a new secure password.', 'Ingrese una nueva contraseña segura.')}</p>
            </div>

            <div className="max-w-md space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">{getText('Nova Senha', 'New Password', 'Nueva Contraseña')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">{getText('Confirmar Senha', 'Confirm Password', 'Confirmar Contraseña')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}

              <button
                onClick={handleChangePassword}
                disabled={saving || !newPassword || !confirmPassword}
                className="flex items-center gap-2 px-8 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
              >
                {saved ? <Check className="w-4 h-4" /> : saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {saving ? getText('Alterando...', 'Changing...', 'Cambiando...') : saved ? getText('Alterado!', 'Changed!', '¡Cambiado!') : getText('Alterar Senha', 'Change Password', 'Cambiar Contraseña')}
              </button>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{getText('Usuários do Clube', 'Club Users', 'Usuarios del Club')}</h3>
                <p className="text-sm text-slate-500">{getText('Gerencie os usuários e suas permissões.', 'Manage users and their permissions.', 'Administre los usuarios y sus permisos.')}</p>
              </div>
              <button
                onClick={() => setUserModal({ isOpen: true, user: null })}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark"
              >
                <Plus className="w-4 h-4" />
                {getText('Novo Usuário', 'New User', 'Nuevo Usuario')}
              </button>
            </div>

            {usersLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {tenantUsers.map((tu) => (
                  <div key={tu.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg group">
                    <div className="flex items-center gap-3">
                      {tu.avatar_url ? (
                        <img src={tu.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${tu.is_pending ? 'bg-orange-100 text-orange-600' : 'bg-primary/10 text-primary'}`}>
                          {(tu.full_name || tu.email)?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-slate-800">
                          {tu.full_name || tu.email?.split('@')[0] || getText('Sem nome', 'No name', 'Sin nombre')}
                        </p>
                        <p className="text-sm text-slate-500">{tu.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {tu.is_pending && (
                        <span className="px-2.5 py-1 text-xs font-bold rounded uppercase bg-orange-100 text-orange-700">
                          {getText('Pendente', 'Pending', 'Pendiente')}
                        </span>
                      )}
                      <span className={`px-2.5 py-1 text-xs font-bold rounded uppercase ${tu.is_owner ? 'bg-amber-100 text-amber-700' :
                        tu.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          tu.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-600'
                        }`}>
                        {tu.is_owner ? getText('Proprietário', 'Owner', 'Propietario') : getRoleLabel(tu.role)}
                      </span>
                      {!tu.is_owner && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setUserModal({ isOpen: true, user: tu })}
                            className="p-1.5 text-slate-400 hover:text-primary"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteUserModal({ isOpen: true, user: tu, loading: false })}
                            className="p-1.5 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {tenantUsers.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    {getText('Nenhum usuário encontrado', 'No users found', 'No se encontraron usuarios')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Management Modal */}
      <UserManagementModal
        isOpen={userModal.isOpen}
        onClose={() => setUserModal({ isOpen: false, user: null })}
        onSaved={loadUsers}
        editingUser={userModal.user}
      />

      {/* Delete User Confirmation */}
      <ConfirmModal
        isOpen={deleteUserModal.isOpen}
        onClose={() => setDeleteUserModal({ isOpen: false, user: null, loading: false })}
        onConfirm={handleRemoveUser}
        title={getText('Remover Usuário', 'Remove User', 'Eliminar Usuario')}
        message={getText(
          `Tem certeza que deseja remover "${deleteUserModal.user?.full_name}" do clube?`,
          `Are you sure you want to remove "${deleteUserModal.user?.full_name}" from the club?`,
          `¿Está seguro de que desea eliminar "${deleteUserModal.user?.full_name}" del club?`
        )}
        confirmLabel={getText('Remover', 'Remove', 'Eliminar')}
        cancelLabel={getText('Cancelar', 'Cancel', 'Cancelar')}
        isDestructive={true}
        loading={deleteUserModal.loading}
      />
    </div>
  );
};

export default Settings;
