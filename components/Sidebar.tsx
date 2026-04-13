import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Trophy,
  CreditCard,
  Settings,
  LogOut,
  Wallet,
  Dumbbell,
  FileText,
  ChevronDown,
  ChevronRight,
  PieChart,
  DollarSign,
  Calendar,
  Clock,
  AlertTriangle,
  X
} from 'lucide-react';
import SidebarItem from './SidebarItem';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTenant } from '../contexts/TenantContext';
import { useSubscription } from '../contexts/SubscriptionContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { t, language } = useLanguage();
  const { currentTenant, isSchool } = useTenant();
  const { subscriptionInfo } = useSubscription();
  const [financeOpen, setFinanceOpen] = useState(location.pathname.startsWith('/finance'));

  const menuItems = [
    { icon: LayoutDashboard, label: t('nav.dashboard'), path: '/' },
    { icon: Users, label: t('nav.athletes'), path: '/athletes' },
    ...(isSchool ? [{ icon: FileText, label: t('nav.enrollments'), path: '/enrollments' }] : []),
    { icon: Trophy, label: t('nav.competitions'), path: '/competitions' },
    { icon: Calendar, label: t('nav.games'), path: '/games' },
    { icon: Dumbbell, label: t('nav.training'), path: '/training' },
  ];

  const bottomItems = [
    { icon: CreditCard, label: t('nav.subscription'), path: '/subscription' },
    { icon: Settings, label: t('nav.settings'), path: '/settings' },
  ];


  // Render subscription/trial info box
  const renderSubscriptionBox = () => {
    if (!subscriptionInfo) return null;

    const { subscriptionStatus, trialDaysRemaining, hasActiveSubscription } = subscriptionInfo;

    if (hasActiveSubscription) {
      return (
        <div className="bg-green-500/20 rounded-lg p-4 mb-4">
          <p className="text-xs font-semibold text-white uppercase tracking-wider">
            {t('sidebar.activePlan')}
          </p>
          <p className="text-[11px] text-white/70 mt-1">
            {t('sidebar.fullAccess')}
          </p>
        </div>
      );
    }

    if (subscriptionStatus === 'expired') {
      return (
        <NavLink to="/plans" className="block">
          <div className="bg-red-500/30 rounded-lg p-4 mb-4 hover:bg-red-500/40 transition-colors cursor-pointer">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-300" />
              <p className="text-xs font-semibold text-white uppercase tracking-wider">
                {t('sidebar.trialExpired')}
              </p>
            </div>
            <p className="text-[11px] text-white/70 mt-1">
              {t('sidebar.clickToPlan')}
            </p>
          </div>
        </NavLink>
      );
    }

    const badgeColor = trialDaysRemaining <= 2 ? 'bg-amber-500/30' : 'bg-blue-600/20';

    return (
      <NavLink to="/plans" className="block">
        <div className={`${badgeColor} rounded-lg p-4 mb-4 hover:opacity-80 transition-opacity cursor-pointer`}>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-white/80" />
            <p className="text-xs font-semibold text-white uppercase tracking-wider">
              {t('sidebar.trialPeriod')}
            </p>
          </div>
          <p className="text-[11px] text-white/70 mt-1">
            {trialDaysRemaining === 1
              ? t('sidebar.oneDayLeft')
              : t('sidebar.daysLeft').replace('{n}', String(trialDaysRemaining))
            }
          </p>
        </div>
      </NavLink>
    );
  };

  return (
    <aside className={`
      w-64 bg-slate-900 text-white flex flex-col fixed h-full z-50
      transform transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      lg:translate-x-0
    `}>
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {currentTenant?.logo_url ? (
            <img
              src={currentTenant.logo_url}
              alt={currentTenant.name || 'Logo'}
              className="w-8 h-8 rounded object-cover"
            />
          ) : (
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
          )}
          <h1 className="text-xl font-bold tracking-tight">Aura Club</h1>
        </div>
        {/* Close button for mobile */}
        <button
          onClick={onClose}
          className="lg:hidden p-1 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1 mt-4">
        {menuItems.map((item) => (
          <SidebarItem key={item.path} icon={item.icon} label={item.label} path={item.path} />
        ))}

        {/* Financeiro com Submenu */}
        <div className="space-y-1">
          <button
            onClick={() => setFinanceOpen(!financeOpen)}
            className={`flex items-center justify-between w-full px-4 py-3 rounded transition-colors ${location.pathname.startsWith('/finance')
              ? 'bg-white/10 text-white font-semibold'
              : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
          >
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5" />
              <span className="text-sm">{t('sidebar.finance')}</span>
            </div>
            {financeOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {financeOpen && (
            <div className="pl-11 space-y-1 mt-1">
              <NavLink
                to="/finance"
                end
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2 rounded text-xs transition-colors ${isActive ? 'text-white font-bold' : 'text-white/60 hover:text-white'
                  }`
                }
              >
                <PieChart className="w-3.5 h-3.5" />
                {t('sidebar.overview')}
              </NavLink>
              {isSchool && (
                <NavLink
                  to="/finance/fees"
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2 rounded text-xs transition-colors ${isActive ? 'text-white font-bold' : 'text-white/60 hover:text-white'
                    }`
                  }
                >
                  <DollarSign className="w-3.5 h-3.5" />
                   {t('sidebar.monthlyFees')}
                </NavLink>
              )}
            </div>
          )}
        </div>

        {bottomItems.map((item) => (
          <SidebarItem key={item.path} icon={item.icon} label={item.label} path={item.path} />
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        {renderSubscriptionBox()}

        <button
          onClick={async () => {
            await signOut();
            navigate('/login');
          }}
          className="flex items-center gap-3 w-full px-4 py-3 text-white/70 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm">{t('sidebar.logout')}</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

