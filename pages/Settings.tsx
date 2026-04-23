
import React, { useState, useEffect, useRef } from 'react';
import { Building2, User, Bell, Shield, Camera, Save, Globe, Check, Loader2, Users, Plus, Edit2, Trash2, Eye, EyeOff, X, Lock, Mail, AlertTriangle, GraduationCap, CreditCard } from 'lucide-react';
import { useLanguage, AVAILABLE_LANGUAGES, AVAILABLE_CURRENCIES } from '../contexts/LanguageContext';
import { useTenant } from '../contexts/TenantContext';
import { storageService } from '../services/storageService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { tenantService, TenantUser } from '../services/tenantService';
import { userService, UserProfile, NotificationSettings, DEFAULT_NOTIFICATION_SETTINGS } from '../services/userService';
import { usePermissions } from '../hooks/usePermissions';
import UserManagementModal from '../components/UserManagementModal';
import ConfirmModal from '../components/ConfirmModal';
import { subscriptionService, PlanLimits } from '../services/subscriptionService';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('club');
  const { language, setLanguage, t, currency, setCurrency } = useLanguage();

  const { currentTenant, refreshTenants } = useTenant();

  const { user } = useAuth();
  const { isAdmin, isOwner } = usePermissions();

  // Common states
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Club settings state
  const [clubName, setClubName] = useState('');
  const [clubLogo, setClubLogo] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('Brazil');
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

  // Plan limits
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);

  // Language state
  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const [selectedCurrency, setSelectedCurrency] = useState(currency);

  // Organization type state
  const [organizationType, setOrganizationType] = useState<'school' | 'club'>(currentTenant?.organization_type || 'school');

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<Array<{ value: string; label: string }>>([]);
  const [newMethodLabel, setNewMethodLabel] = useState('');
  const [editingMethodIdx, setEditingMethodIdx] = useState<number | null>(null);
  const [editingMethodLabel, setEditingMethodLabel] = useState('');

  // Categories state (custom only — defaults are built from t() at render time)
  const [customIncomeCategories, setCustomIncomeCategories] = useState<string[]>([]);
  const [customExpenseCategories, setCustomExpenseCategories] = useState<string[]>([]);
  const [newIncomeCategory, setNewIncomeCategory] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState('');

  // Load data on mount
  useEffect(() => {
    if (currentTenant) {
      setClubName(currentTenant.name || '');
      setClubLogo(currentTenant.logo_url || null);
      setOrganizationType(currentTenant.organization_type || 'school');
      const settings = currentTenant.settings as any;
      if (settings) {
        setAddress(settings.address || '');
        setCountry(settings.country || 'Brazil');
        // Load payment methods or set defaults
        if (settings.payment_methods && Array.isArray(settings.payment_methods) && settings.payment_methods.length > 0) {
          setPaymentMethods(settings.payment_methods);
        } else {
          setPaymentMethods([
            { value: 'cash', label: t('paymentMethod.cash') },
            { value: 'card', label: t('paymentMethod.card') },
          ]);
        }
        // Load custom categories
        setCustomIncomeCategories(Array.isArray(settings.income_categories) ? settings.income_categories : []);
        setCustomExpenseCategories(Array.isArray(settings.expense_categories) ? settings.expense_categories : []);
      } else {
        setPaymentMethods([
          { value: 'cash', label: t('paymentMethod.cash') },
          { value: 'card', label: t('paymentMethod.card') },
        ]);
      }
    }
  }, [currentTenant]);

  useEffect(() => {
    loadProfile();
  }, [user]);

  useEffect(() => {
    if (currentTenant?.id && activeTab === 'users') {
      loadUsers();
      subscriptionService.checkPlanLimits(currentTenant.id).then(limits => {
        if (limits) setPlanLimits(limits);
      });
    }
  }, [currentTenant, activeTab]);

  useEffect(() => {
    setSelectedLanguage(language);
    setSelectedCurrency(currency);
  }, [language, currency]);

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
      const { data: existingUser, error: checkError } = await supabase
        .from('tenant_users')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('user_id', user.id)
        .single();

      if (checkError && checkError.code === 'PGRST116') {
        await supabase.from('tenant_users').insert({
          tenant_id: currentTenant.id,
          user_id: user.id,
          role: 'owner',
          is_owner: true,
        });
      }

      const { data, error } = await supabase.functions.invoke('get-tenant-users', {
        body: { tenantId: currentTenant.id }
      });

      if (error) throw error;

      if (data?.success && data?.users) {
        setTenantUsers(data.users);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleLogoSelect = (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setClubLogo(previewUrl);
    setLogoFile(file);
  };

  const handleSaveClub = async () => {
    if (!currentTenant?.id) return;
    setSaving(true);
    setError(null);
    const hasNewLogo = !!logoFile;
    try {
      let logoUrl = currentTenant.logo_url;
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${currentTenant.id}-logo-${Date.now()}.${fileExt}`;
        const filePath = `logos/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('tenants')
          .upload(filePath, logoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('tenants').getPublicUrl(filePath);
        logoUrl = data.publicUrl;
        setLogoFile(null);
      }
      await tenantService.update(currentTenant.id, {
        name: clubName,
        logo_url: logoUrl || undefined,
        organization_type: organizationType,
        settings: {
          ...(currentTenant.settings as any),
          address,
          country,
        },
      });
      setSaved(true);
      // Refresh context so sidebar reflects org type change immediately
      await refreshTenants();
      setTimeout(() => {
        setSaved(false);
        if (hasNewLogo) window.location.reload();
      }, 1000);

    } catch (err) {
      setError(t('settings.errorSaving'));
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
      if (avatarFile) {
        await userService.uploadAvatar(avatarFile);
        setAvatarFile(null);
        setAvatarPreview(null);
      }
      await userService.updateProfile({ full_name: profileName, phone: profilePhone });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        if (hasNewAvatar || profileName !== profile?.full_name) window.location.reload();
      }, 1000);
    } catch (err) {
      setError(t('settings.errorSavingProfile'));
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
      setError(t('settings.errorSaving'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (newPassword.length < 6) {
      setPasswordError(t('settings.security.passwordMin'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('settings.security.passwordMismatch'));
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
        setPasswordError(result.error || t('settings.security.errorChanging'));
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

  const handleSavePaymentMethods = async () => {
    if (!currentTenant?.id) return;
    setSaving(true);
    setError(null);
    try {
      await tenantService.update(currentTenant.id, {
        settings: {
          ...(currentTenant.settings as any),
          payment_methods: paymentMethods,
        },
      });
      await refreshTenants();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(t('settings.errorSaving'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPaymentMethod = () => {
    const label = newMethodLabel.trim();
    if (!label) return;
    const value = label.toLowerCase().replace(/\s+/g, '_');
    setPaymentMethods(prev => [...prev, { value, label }]);
    setNewMethodLabel('');
  };

  const handleDeletePaymentMethod = (idx: number) => {
    setPaymentMethods(prev => prev.filter((_, i) => i !== idx));
  };

  const handleStartEditMethod = (idx: number) => {
    setEditingMethodIdx(idx);
    setEditingMethodLabel(paymentMethods[idx].label);
  };

  const handleSaveEditMethod = (idx: number) => {
    const label = editingMethodLabel.trim();
    if (!label) return;
    setPaymentMethods(prev => prev.map((m, i) => i === idx ? { ...m, label } : m));
    setEditingMethodIdx(null);
    setEditingMethodLabel('');
  };

  const handleSaveCategories = async () => {
    if (!currentTenant?.id) return;
    setSaving(true);
    setError(null);
    try {
      await tenantService.update(currentTenant.id, {
        settings: {
          ...(currentTenant.settings as any),
          income_categories: customIncomeCategories,
          expense_categories: customExpenseCategories,
        },
      });
      await refreshTenants();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(t('settings.errorSaving'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarSelect = (file: File) => {
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
      case 'owner':   return t('settings.users.role.owner');
      case 'admin':   return t('settings.users.role.admin');
      case 'manager': return t('settings.users.role.manager');
      case 'member':  return t('settings.users.role.member');
      default: return role;
    }
  };

  const tabs = [
    { id: 'club',          icon: Building2, label: t('settings.tab.club') },
    { id: 'preferences',   icon: Globe,     label: t('settings.tab.preferences') },
    { id: 'profile',       icon: User,      label: t('settings.tab.profile') },
    { id: 'notifications', icon: Bell,      label: t('settings.tab.notifications') },
    { id: 'security',      icon: Shield,    label: t('settings.tab.security') },
    { id: 'users',         icon: Users,     label: t('settings.tab.users') },
  ];

  const countryOptions = [
    { value: 'Afghanistan',          label: t('country.Afghanistan') },
    { value: 'Albania',              label: t('country.Albania') },
    { value: 'Algeria',              label: t('country.Algeria') },
    { value: 'Angola',               label: t('country.Angola') },
    { value: 'Argentina',            label: t('country.Argentina') },
    { value: 'Australia',            label: t('country.Australia') },
    { value: 'Austria',              label: t('country.Austria') },
    { value: 'Belgium',              label: t('country.Belgium') },
    { value: 'Bolivia',              label: t('country.Bolivia') },
    { value: 'Brazil',               label: t('country.Brazil') },
    { value: 'Canada',               label: t('country.Canada') },
    { value: 'Chile',                label: t('country.Chile') },
    { value: 'China',                label: t('country.China') },
    { value: 'Colombia',             label: t('country.Colombia') },
    { value: 'Croatia',              label: t('country.Croatia') },
    { value: 'Czech Republic',       label: t('country.Czech Republic') },
    { value: 'Denmark',              label: t('country.Denmark') },
    { value: 'Ecuador',              label: t('country.Ecuador') },
    { value: 'Egypt',                label: t('country.Egypt') },
    { value: 'England',              label: t('country.England') },
    { value: 'France',               label: t('country.France') },
    { value: 'Germany',              label: t('country.Germany') },
    { value: 'Ghana',                label: t('country.Ghana') },
    { value: 'Greece',               label: t('country.Greece') },
    { value: 'Hungary',              label: t('country.Hungary') },
    { value: 'India',                label: t('country.India') },
    { value: 'Indonesia',            label: t('country.Indonesia') },
    { value: 'Iran',                 label: t('country.Iran') },
    { value: 'Ireland',              label: t('country.Ireland') },
    { value: 'Israel',               label: t('country.Israel') },
    { value: 'Italy',                label: t('country.Italy') },
    { value: 'Japan',                label: t('country.Japan') },
    { value: 'Kenya',                label: t('country.Kenya') },
    { value: 'Mexico',               label: t('country.Mexico') },
    { value: 'Morocco',              label: t('country.Morocco') },
    { value: 'Netherlands',          label: t('country.Netherlands') },
    { value: 'New Zealand',          label: t('country.New Zealand') },
    { value: 'Nigeria',              label: t('country.Nigeria') },
    { value: 'Norway',               label: t('country.Norway') },
    { value: 'Paraguay',             label: t('country.Paraguay') },
    { value: 'Peru',                 label: t('country.Peru') },
    { value: 'Poland',               label: t('country.Poland') },
    { value: 'Portugal',             label: t('country.Portugal') },
    { value: 'Romania',              label: t('country.Romania') },
    { value: 'Russia',               label: t('country.Russia') },
    { value: 'Saudi Arabia',         label: t('country.Saudi Arabia') },
    { value: 'Scotland',             label: t('country.Scotland') },
    { value: 'Senegal',              label: t('country.Senegal') },
    { value: 'Serbia',               label: t('country.Serbia') },
    { value: 'South Africa',         label: t('country.South Africa') },
    { value: 'South Korea',          label: t('country.South Korea') },
    { value: 'Spain',                label: t('country.Spain') },
    { value: 'Sweden',               label: t('country.Sweden') },
    { value: 'Switzerland',          label: t('country.Switzerland') },
    { value: 'Turkey',               label: t('country.Turkey') },
    { value: 'Ukraine',              label: t('country.Ukraine') },
    { value: 'United Arab Emirates', label: t('country.United Arab Emirates') },
    { value: 'United States',        label: t('country.United States') },
    { value: 'Uruguay',              label: t('country.Uruguay') },
    { value: 'Venezuela',            label: t('country.Venezuela') },
  ].sort((a, b) => a.label.localeCompare(b.label));

  const SaveButton: React.FC<{ onClick: () => void; disabled?: boolean }> = ({ onClick, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled ?? saving}
      className="flex items-center gap-2 px-8 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
    >
      {saved ? <Check className="w-4 h-4" /> : saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      {saving ? t('settings.saving') : saved ? t('settings.saved') : t('settings.save')}
    </button>
  );

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all relative whitespace-nowrap ${activeTab === tab.id ? 'text-primary' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full" />}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">

        {/* ── Club Tab ──────────────────────────────────────────────────── */}
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
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleLogoSelect(e.target.files[0])} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">{t('settings.club.logoTitle')}</h3>
                <p className="text-sm text-slate-500 mt-1">{t('settings.club.logoHint')}</p>
                {logoFile && <p className="text-xs text-primary mt-1 font-semibold">{t('settings.club.logoSelected')}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('settings.club.tradeName')}</label>
                <input type="text" value={clubName} onChange={(e) => setClubName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('settings.club.country')}</label>
                <select value={country} onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none">
                  {countryOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('settings.club.address')}</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                  placeholder={t('settings.club.addressPlaceholder')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-700 mb-3">{t('settings.club.orgType')}</h3>
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <button type="button" onClick={() => setOrganizationType('school')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${organizationType === 'school' ? 'border-primary bg-primary/5 text-primary shadow-md shadow-primary/10' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'}`}>
                  <GraduationCap className="w-6 h-6" />
                  <span className="text-xs font-bold text-center">{t('settings.club.orgType.school')}</span>
                </button>
                <button type="button" onClick={() => setOrganizationType('club')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${organizationType === 'club' ? 'border-primary bg-primary/5 text-primary shadow-md shadow-primary/10' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'}`}>
                  <Shield className="w-6 h-6" />
                  <span className="text-xs font-bold text-center">{t('settings.club.orgType.club')}</span>
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">{t('settings.club.orgType.hint')}</p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="pt-6 flex justify-end gap-3">
              <SaveButton onClick={handleSaveClub} />
            </div>
          </div>
        )}

        {/* ── Preferences Tab ───────────────────────────────────────────── */}
        {activeTab === 'preferences' && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">{t('settings.preferences.title')}</h3>
              <p className="text-sm text-slate-500">{t('settings.preferences.subtitle')}</p>
            </div>

            {/* Language */}
            <div className="p-6 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Globe className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800">{t('settings.preferences.language')}</h4>
                  <p className="text-sm text-slate-500 mt-1">{t('settings.preferences.languageHint')}</p>
                  <div className="mt-4">
                    <select value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value as typeof language)}
                      className="w-full max-w-xs px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none">
                      {AVAILABLE_LANGUAGES.map(lang => (
                        <option key={lang.value} value={lang.value}>{lang.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <SaveButton onClick={handleSaveLanguage} disabled={saving || selectedLanguage === language} />
            </div>

            {/* Currency */}
            <div className="border-t border-slate-100 pt-8">
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <span className="text-primary font-bold text-lg leading-none">$</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800">{t('settings.preferences.currency')}</h4>
                    <p className="text-sm text-slate-500 mt-1">{t('settings.preferences.currencyHint')}</p>
                    <div className="mt-4">
                      <select
                        value={selectedCurrency}
                        onChange={(e) => setSelectedCurrency(e.target.value)}
                        className="w-full max-w-xs px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      >
                        {AVAILABLE_CURRENCIES.map(c => (
                          <option key={c.code} value={c.code}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <SaveButton
                  onClick={() => { setCurrency(selectedCurrency); }}
                  disabled={selectedCurrency === currency}
                />
              </div>
            </div>

            {/* Payment Methods */}
            <div className="border-t border-slate-100 pt-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <CreditCard className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800">{t('settings.preferences.paymentMethods')}</h4>
                  <p className="text-sm text-slate-500 mt-1">{t('settings.preferences.paymentMethodsHint')}</p>
                  <p className="text-xs text-slate-400 mt-1">{t('settings.preferences.paymentMethodDefaultHint')}</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {paymentMethods.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">{t('settings.preferences.noPaymentMethods')}</p>
                ) : (
                  paymentMethods.map((method, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      {editingMethodIdx === idx ? (
                        <>
                          <input
                            type="text"
                            value={editingMethodLabel}
                            onChange={(e) => setEditingMethodLabel(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveEditMethod(idx)}
                            className="flex-1 px-3 py-1.5 border border-primary/30 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEditMethod(idx)}
                            className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingMethodIdx(null)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm font-medium text-slate-700">{method.label}</span>
                          <button
                            onClick={() => handleStartEditMethod(idx)}
                            className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                            title={t('settings.preferences.editPaymentMethod')}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePaymentMethod(idx)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title={t('settings.preferences.deletePaymentMethod')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Add new method */}
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newMethodLabel}
                  onChange={(e) => setNewMethodLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPaymentMethod()}
                  placeholder={t('settings.preferences.paymentMethodNamePlaceholder')}
                  className="flex-1 max-w-xs px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <button
                  onClick={handleAddPaymentMethod}
                  disabled={!newMethodLabel.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" />
                  {t('settings.preferences.addPaymentMethod')}
                </button>
              </div>

              <div className="pt-6 flex justify-end">
                <SaveButton onClick={handleSavePaymentMethods} />
              </div>
            </div>


            {/* ── Transaction Categories: Income ───────────────────────── */}
            <div className="border-t border-slate-100 pt-8">
              <h4 className="font-bold text-slate-800 mb-1">{t('settings.preferences.incomeCategories')}</h4>
              <p className="text-sm text-slate-500 mb-4">{t('settings.preferences.incomeCategoriesHint')}</p>

              {/* Default income categories (read-only chips) */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  t('category.income.fees'), t('category.income.enrollments'),
                  t('category.income.sponsorships'), t('category.income.events'),
                  t('category.income.sales'), t('category.income.donations'),
                  t('category.income.other'),
                ].map((cat, i) => (
                  <span key={i} className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full border border-slate-200">
                    {cat}
                  </span>
                ))}
              </div>

              {/* Custom income categories */}
              {customIncomeCategories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {customIncomeCategories.map((cat, i) => (
                    <span key={i} className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full border border-primary/20">
                      {cat}
                      <button
                        type="button"
                        onClick={() => setCustomIncomeCategories(prev => prev.filter((_, idx) => idx !== i))}
                        className="hover:text-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3">
                <input
                  id="new-income-category"
                  type="text"
                  value={newIncomeCategory}
                  onChange={(e) => setNewIncomeCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newIncomeCategory.trim()) {
                      setCustomIncomeCategories(prev => [...prev, newIncomeCategory.trim()]);
                      setNewIncomeCategory('');
                    }
                  }}
                  placeholder={t('settings.preferences.categoryNamePlaceholder')}
                  className="flex-1 max-w-xs px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newIncomeCategory.trim()) {
                      setCustomIncomeCategories(prev => [...prev, newIncomeCategory.trim()]);
                      setNewIncomeCategory('');
                    }
                  }}
                  disabled={!newIncomeCategory.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" />
                  {t('settings.preferences.addCategory')}
                </button>
              </div>
            </div>

            {/* ── Transaction Categories: Expense ───────────────────────── */}
            <div className="border-t border-slate-100 pt-8">
              <h4 className="font-bold text-slate-800 mb-1">{t('settings.preferences.expenseCategories')}</h4>
              <p className="text-sm text-slate-500 mb-4">{t('settings.preferences.expenseCategoriesHint')}</p>

              {/* Default expense categories (read-only chips) */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  t('category.expense.infrastructure'), t('category.expense.equipment'),
                  t('category.expense.salaries'), t('category.expense.transport'),
                  t('category.expense.food'), t('category.expense.sportsMaterial'),
                  t('category.expense.marketing'), t('category.expense.maintenance'),
                  t('category.expense.taxes'), t('category.expense.other'),
                ].map((cat, i) => (
                  <span key={i} className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full border border-slate-200">
                    {cat}
                  </span>
                ))}
              </div>

              {/* Custom expense categories */}
              {customExpenseCategories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {customExpenseCategories.map((cat, i) => (
                    <span key={i} className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full border border-primary/20">
                      {cat}
                      <button
                        type="button"
                        onClick={() => setCustomExpenseCategories(prev => prev.filter((_, idx) => idx !== i))}
                        className="hover:text-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3">
                <input
                  id="new-expense-category"
                  type="text"
                  value={newExpenseCategory}
                  onChange={(e) => setNewExpenseCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newExpenseCategory.trim()) {
                      setCustomExpenseCategories(prev => [...prev, newExpenseCategory.trim()]);
                      setNewExpenseCategory('');
                    }
                  }}
                  placeholder={t('settings.preferences.categoryNamePlaceholder')}
                  className="flex-1 max-w-xs px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newExpenseCategory.trim()) {
                      setCustomExpenseCategories(prev => [...prev, newExpenseCategory.trim()]);
                      setNewExpenseCategory('');
                    }
                  }}
                  disabled={!newExpenseCategory.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" />
                  {t('settings.preferences.addCategory')}
                </button>
              </div>
            </div>

            <div className="pt-6 flex justify-end">
              <SaveButton onClick={handleSaveCategories} />
            </div>
          </div>
        )}


        {/* ── Profile Tab ───────────────────────────────────────────────── */}
        {activeTab === 'profile' && (
          <div className="space-y-8">
            {profileLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
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
                    <button onClick={() => avatarInputRef.current?.click()}
                      className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-6 h-6 text-white" />
                    </button>
                    <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleAvatarSelect(e.target.files[0])} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{t('settings.profile.photoTitle')}</h3>
                    <p className="text-sm text-slate-500 mt-1">{t('settings.profile.photoHint')}</p>
                    {avatarFile && <p className="text-xs text-primary mt-1 font-semibold">{t('settings.profile.photoSelected')}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t('settings.profile.fullName')}</label>
                    <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-600">{user?.email}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t('settings.profile.phone')}</label>
                    <input type="tel" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="(00) 00000-0000"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
                  </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="pt-6 flex justify-end">
                  <SaveButton onClick={handleSaveProfile} />
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Notifications Tab ─────────────────────────────────────────── */}
        {activeTab === 'notifications' && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">{t('settings.notifications.title')}</h3>
              <p className="text-sm text-slate-500">{t('settings.notifications.subtitle')}</p>
            </div>
            <div className="space-y-4">
              {[
                { key: 'email_new_enrollment',  label: t('settings.notifications.newEnrollment'),  desc: t('settings.notifications.newEnrollmentDesc')  },
                { key: 'email_payment_received', label: t('settings.notifications.paymentReceived'), desc: t('settings.notifications.paymentReceivedDesc') },
                { key: 'email_payment_overdue',  label: t('settings.notifications.paymentOverdue'),  desc: t('settings.notifications.paymentOverdueDesc')  },
                { key: 'email_training_reminder',label: t('settings.notifications.trainingReminder'),desc: t('settings.notifications.trainingReminderDesc') },
                { key: 'email_system_alerts',    label: t('settings.notifications.systemAlerts'),    desc: t('settings.notifications.systemAlertsDesc')    },
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
              <SaveButton onClick={handleSaveNotifications} />
            </div>
          </div>
        )}

        {/* ── Security Tab ──────────────────────────────────────────────── */}
        {activeTab === 'security' && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">{t('settings.security.title')}</h3>
              <p className="text-sm text-slate-500">{t('settings.security.subtitle')}</p>
            </div>
            <div className="max-w-md space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('settings.security.newPassword')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('settings.security.confirmPassword')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none" placeholder="••••••••" />
                </div>
              </div>
              {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
              <button onClick={handleChangePassword} disabled={saving || !newPassword || !confirmPassword}
                className="flex items-center gap-2 px-8 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all disabled:opacity-50">
                {saved ? <Check className="w-4 h-4" /> : saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {saving ? t('settings.security.changing') : saved ? t('settings.security.changed') : t('settings.security.changeBtn')}
              </button>
            </div>
          </div>
        )}

        {/* ── Users Tab ─────────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{t('settings.users.title')}</h3>
                <p className="text-sm text-slate-500">{t('settings.users.subtitle')}</p>
              </div>
              <button onClick={() => setUserModal({ isOpen: true, user: null })}
                disabled={planLimits ? !planLimits.can_add_user : false}
                className={`flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark ${planLimits && !planLimits.can_add_user ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <Plus className="w-4 h-4" />
                {t('settings.users.newUser')}
              </button>
            </div>

            {planLimits && !planLimits.can_add_user && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">{t('settings.users.limitReached')}</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {`${planLimits.current_users} / ${planLimits.max_users} ${t('settings.users.limitDesc')}`}
                  </p>
                </div>
              </div>
            )}

            {planLimits && planLimits.has_active_subscription && planLimits.max_users !== null && planLimits.can_add_user && (
              <div className="text-xs text-slate-500">
                {planLimits.current_users} / {planLimits.max_users} {t('settings.users.usersLabel')}
              </div>
            )}

            {usersLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
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
                        <p className="font-semibold text-slate-800">{tu.full_name || tu.email?.split('@')[0] || t('settings.users.noName')}</p>
                        <p className="text-sm text-slate-500">{tu.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {tu.is_pending && (
                        <span className="px-2.5 py-1 text-xs font-bold rounded uppercase bg-orange-100 text-orange-700">
                          {t('settings.users.pending')}
                        </span>
                      )}
                      <span className={`px-2.5 py-1 text-xs font-bold rounded uppercase ${tu.is_owner ? 'bg-amber-100 text-amber-700' : tu.role === 'admin' ? 'bg-purple-100 text-purple-700' : tu.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {tu.is_owner ? t('settings.users.role.owner') : getRoleLabel(tu.role)}
                      </span>
                      {!tu.is_owner && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setUserModal({ isOpen: true, user: tu })} className="p-1.5 text-slate-400 hover:text-primary">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteUserModal({ isOpen: true, user: tu, loading: false })} className="p-1.5 text-slate-400 hover:text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {tenantUsers.length === 0 && (
                  <div className="text-center py-12 text-slate-400">{t('settings.users.noUsers')}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <UserManagementModal
        isOpen={userModal.isOpen}
        onClose={() => setUserModal({ isOpen: false, user: null })}
        onSaved={loadUsers}
        editingUser={userModal.user}
      />

      <ConfirmModal
        isOpen={deleteUserModal.isOpen}
        onClose={() => setDeleteUserModal({ isOpen: false, user: null, loading: false })}
        onConfirm={handleRemoveUser}
        title={t('settings.users.removeTitle')}
        message={`${t('settings.users.removeConfirm')} "${deleteUserModal.user?.full_name}"?`}
        confirmLabel={t('settings.users.removeBtn')}
        cancelLabel={t('common.cancel')}
        isDestructive={true}
        loading={deleteUserModal.loading}
      />
    </div>
  );
};

export default Settings;
