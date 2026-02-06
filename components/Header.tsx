
import React, { useState, useEffect } from 'react';
import { Bell, Search, Clock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { userService, UserProfile } from '../services/userService';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Link } from 'react-router-dom';

interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { language } = useLanguage();
  const { subscriptionInfo } = useSubscription();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<string>('');

  const getText = (pt: string, en: string, es: string) => {
    return language === 'en-US' ? en : language === 'es-ES' ? es : pt;
  };

  useEffect(() => {
    loadUserData();
  }, [user, currentTenant]);

  const loadUserData = async () => {
    if (!user) return;

    // Load profile
    const profileData = await userService.getCurrentProfile();
    if (profileData) {
      setProfile(profileData);
    }

    // Load role from tenant_users
    if (currentTenant?.id) {
      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('role, is_owner')
        .eq('tenant_id', currentTenant.id)
        .eq('user_id', user.id)
        .single();

      if (tenantUser) {
        if (tenantUser.is_owner) {
          setUserRole(getText('Proprietário', 'Owner', 'Propietario'));
        } else {
          switch (tenantUser.role) {
            case 'admin':
              setUserRole(getText('Administrador', 'Administrator', 'Administrador'));
              break;
            case 'manager':
              setUserRole(getText('Gerente', 'Manager', 'Gerente'));
              break;
            case 'member':
              setUserRole(getText('Membro', 'Member', 'Miembro'));
              break;
            default:
              setUserRole(tenantUser.role || '');
          }
        }
      }
    }
  };

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário';
  const avatarUrl = profile?.avatar_url;
  const firstLetter = displayName.charAt(0).toUpperCase();

  // Trial badge content
  const renderTrialBadge = () => {
    console.log('[Header] renderTrialBadge - subscriptionInfo:', subscriptionInfo);

    if (!subscriptionInfo) {
      console.log('[Header] No subscriptionInfo, badge hidden');
      return null;
    }

    // Don't show badge if has active subscription
    if (subscriptionInfo.hasActiveSubscription) {
      console.log('[Header] Has active subscription, badge hidden');
      return null;
    }

    console.log('[Header] Showing trial badge, status:', subscriptionInfo.subscriptionStatus);

    const { trialDaysRemaining, isTrialExpired } = subscriptionInfo;

    if (isTrialExpired) {
      return (
        <Link
          to="/plans"
          className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg border border-red-200 hover:bg-red-100 transition-colors"
        >
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm font-medium">
            {getText('Período de teste expirado', 'Trial expired', 'Período de prueba expirado')}
          </span>
        </Link>
      );
    }

    // Trial active - show days remaining
    const badgeColor = trialDaysRemaining <= 2 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-blue-50 text-blue-600 border-blue-200';

    return (
      <Link
        to="/plans"
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border hover:opacity-80 transition-opacity ${badgeColor}`}
      >
        <Clock className="w-4 h-4" />
        <span className="text-sm font-medium">
          {trialDaysRemaining === 1
            ? getText('1 dia restante', '1 day left', '1 día restante')
            : getText(`${trialDaysRemaining} dias restantes`, `${trialDaysRemaining} days left`, `${trialDaysRemaining} días restantes`)
          }
        </span>
      </Link>
    );
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-40">
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>

      <div className="flex items-center gap-6">
        {/* Trial Badge */}
        {renderTrialBadge()}

        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={getText('Buscar...', 'Search...', 'Buscar...')}
            className="pl-10 pr-4 py-1.5 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none w-64"
          />
        </div>

        <div className="flex items-center gap-4">
          <button className="p-2 text-slate-400 hover:text-slate-600 relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>

          <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold leading-none">{displayName}</p>
              <p className="text-xs text-slate-500 mt-1">{userRole}</p>
            </div>
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full border border-slate-300 object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border border-slate-200">
                  {firstLetter}
                </div>
              )}
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
