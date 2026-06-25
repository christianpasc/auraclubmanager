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
  PieChart,
  DollarSign,
  Calendar,
  Clock,
  AlertTriangle,
  X,
  Radar,
  Layers,
  Heart,
  Tag,
  CalendarRange,
  UsersRound,
  Globe,
  Mail,
  ShoppingBag,
  Building2,
  CalendarDays,
  ClipboardList,
  Target,
  BookOpen,
  Video,
  LayoutList,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import SidebarItem from './SidebarItem';
import SidebarGroup from './SidebarGroup';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTenant } from '../contexts/TenantContext';
import { useSubscription } from '../contexts/SubscriptionContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const SectionLabel: React.FC<{ label: string; collapsed: boolean }> = ({ label, collapsed }) =>
  collapsed ? (
    <div className="hidden lg:block h-px bg-white/10 mx-2 my-2" />
  ) : (
    <p className="px-4 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-white/35">{label}</p>
  );

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, collapsed, onToggleCollapse }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { t } = useLanguage();
  const { currentTenant } = useTenant();
  const { subscriptionInfo } = useSubscription();

  const [financeOpen, setFinanceOpen] = useState(
    location.pathname.startsWith('/finance') || location.pathname.startsWith('/school-plans')
  );
  const [estruturaOpen, setEstruturaOpen] = useState(
    ['/groups', '/guardians', '/seasons', '/age-categories'].some(p => location.pathname.startsWith(p))
  );
  const siteMarketingPaths = ['/club-site', '/invitations', '/store', '/sponsors'];
  const [siteOpen, setSiteOpen] = useState(
    siteMarketingPaths.some(p => location.pathname.startsWith(p))
  );
  const developmentPaths = ['/assessments', '/assessment-templates', '/development-plans', '/drills', '/videos'];
  const [devOpen, setDevOpen] = useState(
    developmentPaths.some(p => location.pathname.startsWith(p))
  );
  const sportPaths = ['/competitions', '/games', '/training'];
  const [sportOpen, setSportOpen] = useState(
    sportPaths.some(p => location.pathname.startsWith(p))
  );

  const subLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-2 rounded text-xs transition-colors ${isActive ? 'text-white font-bold' : 'text-white/60 hover:text-white'}`;

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
      text-white flex flex-col fixed lg:relative h-full lg:h-auto z-50
      transform transition-all duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      lg:translate-x-0
      ${collapsed ? 'w-64 lg:w-20' : 'w-64'}
    `} style={{ background: '#1a2d4e' }}>
      {/* Club name + logo */}
      <div className={`relative m-3 rounded-lg flex items-center gap-3 flex-shrink-0 ${collapsed ? 'lg:justify-center lg:px-2 px-3' : 'px-3'} py-3`} style={{ background: 'rgba(0,0,0,0.25)' }}>
        {currentTenant?.logo_url ? (
          <img
            src={currentTenant.logo_url}
            alt={currentTenant.name || 'Logo'}
            className="w-8 h-8 rounded object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center flex-shrink-0">
            <Trophy className="w-5 h-5 text-white" />
          </div>
        )}
        <span className={`text-sm font-semibold tracking-tight truncate ${collapsed ? 'lg:hidden' : ''}`}>
          {currentTenant?.name || 'Aura Club'}
        </span>

        {/* Close button for mobile */}
        <button
          onClick={onClose}
          className="lg:hidden absolute top-1/2 -translate-y-1/2 right-2 p-1 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 lg:flex-none px-3 space-y-1 overflow-y-auto lg:overflow-visible">
        <SidebarItem icon={LayoutDashboard} label={t('nav.dashboard')} path="/" collapsed={collapsed} />

        <SectionLabel label={t('sidebar.teamSport')} collapsed={collapsed} />

        <SidebarItem icon={Radar} label={t('nav.prospects')} path="/prospects" collapsed={collapsed} />

        <SidebarItem icon={Users} label={t('nav.athletes')} path="/athletes" collapsed={collapsed} />

        {/* Desenvolvimento com Submenu */}
        <SidebarGroup
          icon={Target}
          label={t('sidebar.development')}
          active={developmentPaths.some(p => location.pathname.startsWith(p))}
          open={devOpen}
          collapsed={collapsed}
          onToggle={() => setDevOpen(!devOpen)}
        >
          <NavLink to="/assessments" className={subLinkClass}>
            <ClipboardList className="w-3.5 h-3.5" />
            {t('sidebar.assessments')}
          </NavLink>
          <NavLink to="/development-plans" className={subLinkClass}>
            <Target className="w-3.5 h-3.5" />
            {t('sidebar.developmentPlans')}
          </NavLink>
          <NavLink to="/drills" className={subLinkClass}>
            <BookOpen className="w-3.5 h-3.5" />
            {t('sidebar.drillLibrary')}
          </NavLink>
          <NavLink to="/videos" className={subLinkClass}>
            <Video className="w-3.5 h-3.5" />
            {t('sidebar.videos')}
          </NavLink>
        </SidebarGroup>

        {/* Esporte com Submenu */}
        <SidebarGroup
          icon={Trophy}
          label={t('sidebar.sport')}
          active={sportPaths.some(p => location.pathname.startsWith(p))}
          open={sportOpen}
          collapsed={collapsed}
          onToggle={() => setSportOpen(!sportOpen)}
        >
          <NavLink to="/competitions" className={subLinkClass}>
            <Trophy className="w-3.5 h-3.5" />
            {t('nav.competitions')}
          </NavLink>
          <NavLink to="/games" className={subLinkClass}>
            <Calendar className="w-3.5 h-3.5" />
            {t('nav.games')}
          </NavLink>
          <NavLink to="/training" className={subLinkClass}>
            <Dumbbell className="w-3.5 h-3.5" />
            {t('nav.training')}
          </NavLink>
        </SidebarGroup>

        <SectionLabel label={t('sidebar.management')} collapsed={collapsed} />

        <SidebarItem icon={FileText} label={t('nav.enrollments')} path="/enrollments" collapsed={collapsed} />

        {/* Financeiro com Submenu */}
        <SidebarGroup
          icon={Wallet}
          label={t('sidebar.finance')}
          active={location.pathname.startsWith('/finance') || location.pathname.startsWith('/school-plans')}
          open={financeOpen}
          collapsed={collapsed}
          onToggle={() => setFinanceOpen(!financeOpen)}
        >
          <NavLink to="/finance" end className={subLinkClass}>
            <PieChart className="w-3.5 h-3.5" />
            {t('sidebar.overview')}
          </NavLink>
          <NavLink to="/finance/fees" className={subLinkClass}>
            <DollarSign className="w-3.5 h-3.5" />
            {t('sidebar.monthlyFees')}
          </NavLink>
          <NavLink to="/school-plans" className={subLinkClass}>
            <LayoutList className="w-3.5 h-3.5" />
            {t('schoolPlans.sidebar')}
          </NavLink>
        </SidebarGroup>

        {/* Estrutura com Submenu */}
        <SidebarGroup
          icon={Layers}
          label={t('sidebar.structure')}
          active={['/groups', '/guardians', '/seasons', '/age-categories'].some(p => location.pathname.startsWith(p))}
          open={estruturaOpen}
          collapsed={collapsed}
          onToggle={() => setEstruturaOpen(!estruturaOpen)}
        >
          <NavLink to="/groups" className={subLinkClass}>
            <UsersRound className="w-3.5 h-3.5" />
            {t('sidebar.groups')}
          </NavLink>
          <NavLink to="/guardians" className={subLinkClass}>
            <Heart className="w-3.5 h-3.5" />
            {t('sidebar.guardians')}
          </NavLink>
          <NavLink to="/seasons" className={subLinkClass}>
            <CalendarRange className="w-3.5 h-3.5" />
            {t('sidebar.seasons')}
          </NavLink>
          <NavLink to="/age-categories" className={subLinkClass}>
            <Tag className="w-3.5 h-3.5" />
            {t('sidebar.ageCategories')}
          </NavLink>
        </SidebarGroup>

        {/* Site & Marketing com Submenu */}
        <SidebarGroup
          icon={Globe}
          label={t('sidebar.siteMarketing')}
          active={siteMarketingPaths.some(p => location.pathname.startsWith(p))}
          open={siteOpen}
          collapsed={collapsed}
          onToggle={() => setSiteOpen(!siteOpen)}
        >
          <NavLink to="/club-site" className={subLinkClass}>
            <Globe className="w-3.5 h-3.5" />
            {t('sidebar.clubSite')}
          </NavLink>
          <NavLink to="/invitations" className={subLinkClass}>
            <Mail className="w-3.5 h-3.5" />
            {t('sidebar.invitations')}
          </NavLink>
          <NavLink to="/store" className={subLinkClass}>
            <ShoppingBag className="w-3.5 h-3.5" />
            {t('sidebar.store')}
          </NavLink>
          <NavLink to="/sponsors" className={subLinkClass}>
            <Building2 className="w-3.5 h-3.5" />
            {t('sidebar.sponsors')}
          </NavLink>
        </SidebarGroup>

        <SidebarItem icon={CalendarDays} label={t('sidebar.facilities')} path="/facilities" collapsed={collapsed} />

        <div className="h-px bg-white/10 mx-2 my-3" />

        <SidebarItem icon={CreditCard} label={t('nav.subscription')} path="/subscription" collapsed={collapsed} />
        <SidebarItem icon={Settings} label={t('nav.settings')} path="/settings" collapsed={collapsed} />

        {/* Collapse toggle — desktop only, end of menu */}
        <button
          onClick={onToggleCollapse}
          className={`hidden lg:flex items-center gap-3 w-full px-4 py-3 rounded text-white/50 hover:bg-white/5 hover:text-white transition-colors ${collapsed ? 'justify-center px-0' : ''}`}
        >
          {collapsed ? <PanelLeftOpen className="w-5 h-5 flex-shrink-0" /> : <PanelLeftClose className="w-5 h-5 flex-shrink-0" />}
          {!collapsed && <span className="text-sm">{t('sidebar.collapse')}</span>}
        </button>
      </nav>

      <div className="p-4 border-t border-white/10 flex-shrink-0">
        {!collapsed && renderSubscriptionBox()}

        {/* Logout — mobile only; on desktop it lives in the Header next to the avatar */}
        <button
          onClick={async () => {
            await signOut();
            navigate('/login');
          }}
          className="lg:hidden flex items-center gap-3 w-full px-4 py-3 text-white/70 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{t('sidebar.logout')}</span>
        </button>
      </div>

      {/* Fills any remaining height so the dark background reaches the bottom of the page,
          without pushing the items above down when content is shorter than the viewport. */}
      <div className="hidden lg:block flex-1" />
    </aside>
  );
};

export default Sidebar;
