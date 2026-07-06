import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { TenantProvider, useTenant } from './contexts/TenantContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Athletes from './pages/Athletes';
import AthleteForm from './pages/AthleteForm';
import Competitions from './pages/Competitions';
import CompetitionForm from './pages/CompetitionForm';
import Games from './pages/Games';
import GameForm from './pages/GameForm';
import Training from './pages/Training';
import TrainingForm from './pages/TrainingForm';
import Finance from './pages/Finance';
import Subscription from './pages/Subscription';
import Plans from './pages/Plans';
import Settings from './pages/Settings';
import Enrollments from './pages/Enrollments';
import EnrollmentForm from './pages/EnrollmentForm';
import MonthlyFees from './pages/MonthlyFees';
import Prospects from './pages/Prospects';
import ProspectForm from './pages/ProspectForm';
import Seasons from './pages/Seasons';
import AgeCategories from './pages/AgeCategories';
import Groups from './pages/Groups';
import GroupForm from './pages/GroupForm';
import Guardians from './pages/Guardians';
import GuardianForm from './pages/GuardianForm';
import ClubSiteEditor from './pages/ClubSiteEditor';
import PublicSite from './pages/PublicSite';
import InvitationManager from './pages/InvitationManager';
import PublicInviteResponse from './pages/PublicInviteResponse';
import Store from './pages/Store';
import ProductForm from './pages/ProductForm';
import PublicStore from './pages/PublicStore';
import PublicInvoice from './pages/PublicInvoice';
import SponsorManager from './pages/SponsorManager';
import FacilityManager from './pages/FacilityManager';
import Assessments from './pages/Assessments';
import AssessmentForm from './pages/AssessmentForm';
import AssessmentTemplates from './pages/AssessmentTemplates';
import AthleteEvolution from './pages/AthleteEvolution';
import DevelopmentPlans from './pages/DevelopmentPlans';
import DevelopmentPlanForm from './pages/DevelopmentPlanForm';
import DrillLibrary from './pages/DrillLibrary';
import VideoLibrary from './pages/VideoLibrary';
import VideoPlayer from './pages/VideoPlayer';
import PerformanceDashboard from './pages/PerformanceDashboard';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import AdminLayout from './components/layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPlans from './pages/admin/AdminPlans';
import AdminStripe from './pages/admin/AdminStripe';
import AdminStripeEvents from './pages/admin/AdminStripeEvents';
import AdminPlatformUsers from './pages/admin/AdminPlatformUsers';
import AdminPalettes from './pages/admin/AdminPalettes';
import AdminIntegrations from './pages/admin/AdminIntegrations';
import AdminChatWidget from './pages/admin/AdminChatWidget';
import AdminHealthJobs from './pages/admin/AdminHealthJobs';
import AdminObservability from './pages/admin/AdminObservability';
import AdminAudit from './pages/admin/AdminAudit';
import AdminDeletionRequests from './pages/admin/AdminDeletionRequests';
import AdminMaintenance from './pages/admin/AdminMaintenance';
import { Wrench } from 'lucide-react';
import { platformSettingsService, PLATFORM_SETTING_KEYS, MaintenanceSetting, ChatWidgetSetting } from './services/platformSettingsService';
import Onboarding from './pages/Onboarding';
import SchoolPlans from './pages/SchoolPlans';
import FeatureGate from './components/FeatureGate';
import { useAuth } from './contexts/AuthContext';
import { ModuleKey } from './services/featureFlagService';
import HelpCenter from './pages/HelpCenter';
import HelpArticlePage from './pages/HelpArticlePage';
import AdminHelpCenter from './pages/admin/AdminHelpCenter';
import AdminHelpArticleEditor from './pages/admin/AdminHelpArticleEditor';
import { matchHelpRoute } from './constants/helpRouteMap';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('aura_sidebar_collapsed') === '1');

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('aura_sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  };

  // Close sidebar when route changes (mobile)
  React.useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const getTitle = () => {
    switch (location.pathname) {
      case '/': return t('pages.dashboard');
      case '/athletes': return t('pages.athletes');
      case '/enrollments': return t('pages.enrollments');
      case '/competitions': return t('pages.competitions');
      case '/games': return t('pages.games');
      case '/training': return t('pages.training');
      case '/finance': return t('pages.finance');
      case '/finance/fees': return t('pages.monthlyFees');
      case '/subscription': return t('pages.subscription');
      case '/plans': return t('pages.plans');
      case '/settings': return t('pages.settings');
      case '/prospects': return t('pages.prospects');
      default: return 'Aura Club';
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      <main className="flex-1 min-h-screen flex flex-col">
        <Header title={getTitle()} helpMatch={matchHelpRoute(location.pathname)} onMenuClick={() => setSidebarOpen(true)} />
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
};

// Special layout for pages that can be accessed even with expired trial
const ProtectedLayoutExpired: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ProtectedRoute allowExpiredTrial>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
};

const ProtectedAdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user || !isSuperAdmin) {
    return <React.Fragment />; // or redirect to login/dashboard
  }

  return <AdminLayout>{children}</AdminLayout>;
};

const NotFoundPage: React.FC = () => {
  const { language } = useLanguage();
  const messages: Record<string, string> = {
    'en-US': 'Page not found.',
    'es-ES': 'Página no encontrada.',
    'fr-FR': 'Page non trouvée.',
    'pt-BR': 'Página não encontrada.',
    'pt-PT': 'Página não encontrada.',
  };
  const message = messages[language] || messages['pt-BR'];

  return (
    <div className="flex flex-col items-center justify-center h-[70vh] text-slate-400">
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p>{message}</p>
    </div>
  );
};

// Wraps a page with a FeatureGate — shows blurred content + lock overlay when disabled
const Gated: React.FC<{ feature: ModuleKey; children: React.ReactNode }> = ({ feature, children }) => (
  <FeatureGate feature={feature}>{children}</FeatureGate>
);

// Component that renders auth routes outside of tenant/subscription context
const AuthRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
    </Routes>
  );
};

// Component that renders protected routes inside tenant/subscription context
const ProtectedRoutes: React.FC = () => {
  return (
    <TenantProvider>
      <OnboardingGate>
        <SubscriptionProvider>
          <Routes>
            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedAdminLayout><AdminDashboard /></ProtectedAdminLayout>} />
            <Route path="/admin/users" element={<ProtectedAdminLayout><AdminUsers /></ProtectedAdminLayout>} />
            <Route path="/admin/stripe" element={<ProtectedAdminLayout><AdminStripe /></ProtectedAdminLayout>} />
            <Route path="/admin/stripe-events" element={<ProtectedAdminLayout><AdminStripeEvents /></ProtectedAdminLayout>} />
            <Route path="/admin/plans" element={<ProtectedAdminLayout><AdminPlans /></ProtectedAdminLayout>} />
            <Route path="/admin/platform-users" element={<ProtectedAdminLayout><AdminPlatformUsers /></ProtectedAdminLayout>} />
            <Route path="/admin/palettes" element={<ProtectedAdminLayout><AdminPalettes /></ProtectedAdminLayout>} />
            <Route path="/admin/integrations" element={<ProtectedAdminLayout><AdminIntegrations /></ProtectedAdminLayout>} />
            <Route path="/admin/chat-widget" element={<ProtectedAdminLayout><AdminChatWidget /></ProtectedAdminLayout>} />
            <Route path="/admin/health" element={<ProtectedAdminLayout><AdminHealthJobs /></ProtectedAdminLayout>} />
            <Route path="/admin/observability" element={<ProtectedAdminLayout><AdminObservability /></ProtectedAdminLayout>} />
            <Route path="/admin/audit" element={<ProtectedAdminLayout><AdminAudit /></ProtectedAdminLayout>} />
            <Route path="/admin/deletion-requests" element={<ProtectedAdminLayout><AdminDeletionRequests /></ProtectedAdminLayout>} />
            <Route path="/admin/maintenance" element={<ProtectedAdminLayout><AdminMaintenance /></ProtectedAdminLayout>} />
            <Route path="/admin/help" element={<ProtectedAdminLayout><AdminHelpCenter /></ProtectedAdminLayout>} />
            <Route path="/admin/help/articles/new" element={<ProtectedAdminLayout><AdminHelpArticleEditor /></ProtectedAdminLayout>} />
            <Route path="/admin/help/articles/:id" element={<ProtectedAdminLayout><AdminHelpArticleEditor /></ProtectedAdminLayout>} />

            {/* Plans route - accessible even with expired trial */}
            <Route path="/plans" element={<ProtectedLayoutExpired><Plans /></ProtectedLayoutExpired>} />
            <Route path="/settings" element={<ProtectedLayoutExpired><Settings /></ProtectedLayoutExpired>} />

            {/* Protected Routes - require active trial or subscription */}
            <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
            <Route path="/athletes" element={<ProtectedLayout><Gated feature="athletes"><Athletes /></Gated></ProtectedLayout>} />
            <Route path="/athletes/new" element={<ProtectedLayout><AthleteForm /></ProtectedLayout>} />
            <Route path="/athletes/:id" element={<ProtectedLayout><AthleteForm /></ProtectedLayout>} />
            <Route path="/enrollments" element={<ProtectedLayout><Gated feature="enrollments"><Enrollments /></Gated></ProtectedLayout>} />
            <Route path="/enrollments/new" element={<ProtectedLayout><EnrollmentForm /></ProtectedLayout>} />
            <Route path="/enrollments/:id" element={<ProtectedLayout><EnrollmentForm /></ProtectedLayout>} />
            <Route path="/competitions" element={<ProtectedLayout><Gated feature="competitions"><Competitions /></Gated></ProtectedLayout>} />
            <Route path="/competitions/new" element={<ProtectedLayout><CompetitionForm /></ProtectedLayout>} />
            <Route path="/competitions/:id" element={<ProtectedLayout><CompetitionForm /></ProtectedLayout>} />
            <Route path="/games" element={<ProtectedLayout><Gated feature="games"><Games /></Gated></ProtectedLayout>} />
            <Route path="/games/new" element={<ProtectedLayout><GameForm /></ProtectedLayout>} />
            <Route path="/games/:id" element={<ProtectedLayout><GameForm /></ProtectedLayout>} />
            <Route path="/training" element={<ProtectedLayout><Gated feature="training"><Training /></Gated></ProtectedLayout>} />
            <Route path="/training/new" element={<ProtectedLayout><TrainingForm /></ProtectedLayout>} />
            <Route path="/training/:id" element={<ProtectedLayout><TrainingForm /></ProtectedLayout>} />
            <Route path="/prospects" element={<ProtectedLayout><Gated feature="scouting"><Prospects /></Gated></ProtectedLayout>} />
            <Route path="/prospects/new" element={<ProtectedLayout><ProspectForm /></ProtectedLayout>} />
            <Route path="/prospects/:id" element={<ProtectedLayout><ProspectForm /></ProtectedLayout>} />
            <Route path="/finance" element={<ProtectedLayout><Gated feature="finance"><Finance /></Gated></ProtectedLayout>} />
            <Route path="/finance/fees" element={<ProtectedLayout><MonthlyFees /></ProtectedLayout>} />
            <Route path="/school-plans" element={<ProtectedLayout><SchoolPlans /></ProtectedLayout>} />
            <Route path="/seasons" element={<ProtectedLayout><Gated feature="structure"><Seasons /></Gated></ProtectedLayout>} />
            <Route path="/age-categories" element={<ProtectedLayout><Gated feature="structure"><AgeCategories /></Gated></ProtectedLayout>} />
            <Route path="/groups" element={<ProtectedLayout><Gated feature="structure"><Groups /></Gated></ProtectedLayout>} />
            <Route path="/groups/new" element={<ProtectedLayout><GroupForm /></ProtectedLayout>} />
            <Route path="/groups/:id" element={<ProtectedLayout><GroupForm /></ProtectedLayout>} />
            <Route path="/guardians" element={<ProtectedLayout><Gated feature="structure"><Guardians /></Gated></ProtectedLayout>} />
            <Route path="/guardians/new" element={<ProtectedLayout><GuardianForm /></ProtectedLayout>} />
            <Route path="/guardians/:id" element={<ProtectedLayout><GuardianForm /></ProtectedLayout>} />
            <Route path="/club-site" element={<ProtectedLayout><Gated feature="site_marketing"><ClubSiteEditor /></Gated></ProtectedLayout>} />
            <Route path="/invitations" element={<ProtectedLayout><Gated feature="site_marketing"><InvitationManager /></Gated></ProtectedLayout>} />
            <Route path="/store" element={<ProtectedLayout><Gated feature="site_marketing"><Store /></Gated></ProtectedLayout>} />
            <Route path="/store/products/new" element={<ProtectedLayout><ProductForm /></ProtectedLayout>} />
            <Route path="/store/products/:id" element={<ProtectedLayout><ProductForm /></ProtectedLayout>} />
            <Route path="/sponsors" element={<ProtectedLayout><Gated feature="site_marketing"><SponsorManager /></Gated></ProtectedLayout>} />
            <Route path="/facilities" element={<ProtectedLayout><Gated feature="facilities"><FacilityManager /></Gated></ProtectedLayout>} />
            <Route path="/athletes/:id/evolution" element={<ProtectedLayout><Gated feature="assessments"><AthleteEvolution /></Gated></ProtectedLayout>} />
            <Route path="/development-plans" element={<ProtectedLayout><Gated feature="development_plans"><DevelopmentPlans /></Gated></ProtectedLayout>} />
            <Route path="/development-plans/new" element={<ProtectedLayout><Gated feature="development_plans"><DevelopmentPlanForm /></Gated></ProtectedLayout>} />
            <Route path="/development-plans/:id" element={<ProtectedLayout><Gated feature="development_plans"><DevelopmentPlanForm /></Gated></ProtectedLayout>} />
            <Route path="/drills" element={<ProtectedLayout><Gated feature="drill_library"><DrillLibrary /></Gated></ProtectedLayout>} />
            <Route path="/videos" element={<ProtectedLayout><Gated feature="video_analysis"><VideoLibrary /></Gated></ProtectedLayout>} />
            <Route path="/videos/:id" element={<ProtectedLayout><Gated feature="video_analysis"><VideoPlayer /></Gated></ProtectedLayout>} />
            <Route path="/athletes/:id/stats" element={<ProtectedLayout><Gated feature="performance_stats"><PerformanceDashboard /></Gated></ProtectedLayout>} />
            <Route path="/assessments" element={<ProtectedLayout><Gated feature="assessments"><Assessments /></Gated></ProtectedLayout>} />
            <Route path="/assessments/new" element={<ProtectedLayout><Gated feature="assessments"><AssessmentForm /></Gated></ProtectedLayout>} />
            <Route path="/assessments/:id" element={<ProtectedLayout><Gated feature="assessments"><AssessmentForm /></Gated></ProtectedLayout>} />
            <Route path="/assessment-templates" element={<ProtectedLayout><Gated feature="assessments"><AssessmentTemplates /></Gated></ProtectedLayout>} />
            <Route path="/subscription" element={<ProtectedLayout><Subscription /></ProtectedLayout>} />
            <Route path="*" element={
              <ProtectedLayout>
                <NotFoundPage />
              </ProtectedLayout>
            } />
          </Routes>
        </SubscriptionProvider>
      </OnboardingGate>
    </TenantProvider>
  );
};

// Renders Onboarding screen when user is logged in but has no tenant
const OnboardingGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { tenants, loading: tenantLoading } = useTenant();

  // Still loading — don't flash onboarding
  if (tenantLoading) return <>{children}</>;

  // User is logged in and has NO tenant → show onboarding
  if (user && tenants.length === 0) {
    return <Onboarding />;
  }

  return <>{children}</>;
};

// Public routes — no auth wrapper needed
const PublicRoutes: React.FC = () => (
  <Routes>
    <Route path="/site/:slug" element={<PublicSite />} />
    <Route path="/invite/:token" element={<PublicInviteResponse />} />
    <Route path="/shop/:slug" element={<PublicStore />} />
    <Route path="/pay/:invoiceId" element={<PublicInvoice />} />
    <Route path="/help" element={<HelpCenter />} />
    <Route path="/help/:slug" element={<HelpArticlePage />} />
    <Route path="*" element={<PublicSite />} />
  </Routes>
);

const MaintenancePage: React.FC<{ message: string }> = ({ message }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-8 text-center">
    <div className="max-w-sm">
      <Wrench className="w-12 h-12 mx-auto mb-4 text-amber-400" />
      <h1 className="text-2xl font-bold mb-2">Em manutenção</h1>
      <p className="text-slate-300">{message}</p>
    </div>
  </div>
);

const CHAT_CONSENT_KEY = 'aura_chat_consent';

// LGPD/GDPR: the support chat is a third-party script (Crisp/Tawk/etc.) that can
// set its own cookies — it only loads after the visitor explicitly accepts.
// Both choices persist, so the banner shows at most once per browser.
const ChatConsentBanner: React.FC<{ onAccept: () => void; onDecline: () => void }> = ({ onAccept, onDecline }) => (
  <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:max-w-md z-[60] bg-white border border-slate-200 rounded-xl shadow-xl p-4">
    <p className="text-sm text-slate-700">
      Usamos um widget de chat de terceiros para suporte, que pode utilizar cookies próprios. Deseja ativá-lo?
    </p>
    <div className="flex justify-end gap-2 mt-3">
      <button onClick={onDecline} className="px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-lg">
        Recusar
      </button>
      <button onClick={onAccept} className="px-4 py-1.5 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary-dark">
        Aceitar
      </button>
    </div>
  </div>
);

// Router wrapper that decides which route set to use
const AppRouter: React.FC = () => {
  const location = useLocation();
  const { isSuperAdmin } = useAuth();
  const [maintenance, setMaintenance] = useState<MaintenanceSetting | null>(null);
  const [maintenanceChecked, setMaintenanceChecked] = useState(false);
  const [chatWidget, setChatWidget] = useState<ChatWidgetSetting | null>(null);
  const [chatConsent, setChatConsent] = useState<string | null>(() => localStorage.getItem(CHAT_CONSENT_KEY));
  const [chatInjected, setChatInjected] = useState(false);

  useEffect(() => {
    platformSettingsService.get<MaintenanceSetting>(PLATFORM_SETTING_KEYS.MAINTENANCE)
      .then(setMaintenance)
      .finally(() => setMaintenanceChecked(true));
  }, []);

  useEffect(() => {
    platformSettingsService.get<ChatWidgetSetting>(PLATFORM_SETTING_KEYS.CHAT_WIDGET).then(setChatWidget);
  }, []);

  // Injects the configured support chat script once — only after explicit consent.
  useEffect(() => {
    if (chatInjected) return;
    if (chatConsent !== 'accepted') return;
    if (!chatWidget?.enabled || !chatWidget.embed_code) return;
    const container = document.createElement('div');
    container.innerHTML = chatWidget.embed_code;
    Array.from(container.childNodes).forEach(node => document.body.appendChild(node));
    setChatInjected(true);
  }, [chatWidget, chatConsent, chatInjected]);

  const decideChatConsent = (decision: 'accepted' | 'declined') => {
    localStorage.setItem(CHAT_CONSENT_KEY, decision);
    setChatConsent(decision);
  };

  const showChatBanner = !!chatWidget?.enabled && !!chatWidget.embed_code && chatConsent === null;

  const isAuthRoute = ['/login', '/signup', '/forgot-password'].includes(location.pathname);
  const isPublicRoute = location.pathname.startsWith('/site/') || location.pathname.startsWith('/invite/') || location.pathname.startsWith('/shop/') || location.pathname.startsWith('/pay/')
    || location.pathname === '/help' || location.pathname.startsWith('/help/');

  const chatBanner = showChatBanner
    ? <ChatConsentBanner onAccept={() => decideChatConsent('accepted')} onDecline={() => decideChatConsent('declined')} />
    : null;

  if (isAuthRoute) return <><AuthRoutes />{chatBanner}</>;
  if (isPublicRoute) return <><PublicRoutes />{chatBanner}</>;

  // Maintenance only gates the authenticated app — super admins always get through
  // so they can turn it back off, and the login screen is never blocked.
  if (maintenanceChecked && maintenance?.enabled && !isSuperAdmin) {
    return <MaintenancePage message={maintenance.message || 'Estamos em manutenção. Voltamos em breve.'} />;
  }

  return <><ProtectedRoutes />{chatBanner}</>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Router>
          <AppRouter />
        </Router>
      </LanguageProvider>
    </AuthProvider>
  );
};

export default App;

