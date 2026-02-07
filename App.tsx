import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { TenantProvider } from './contexts/TenantContext';
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
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import AdminLayout from './components/layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import { useAuth } from './contexts/AuthContext';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 lg:ml-64 min-h-screen flex flex-col">
        <Header title={getTitle()} onMenuClick={() => setSidebarOpen(true)} />
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
  const message = language === 'en-US' ? 'Page not found.' : language === 'es-ES' ? 'Página no encontrada.' : 'Página não encontrada.';

  return (
    <div className="flex flex-col items-center justify-center h-[70vh] text-slate-400">
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p>{message}</p>
    </div>
  );
};



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
      <SubscriptionProvider>
        <Routes>
          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedAdminLayout><AdminDashboard /></ProtectedAdminLayout>} />
          <Route path="/admin/users" element={<ProtectedAdminLayout><AdminUsers /></ProtectedAdminLayout>} />

          {/* Plans route - accessible even with expired trial */}
          <Route path="/plans" element={<ProtectedLayoutExpired><Plans /></ProtectedLayoutExpired>} />
          <Route path="/settings" element={<ProtectedLayoutExpired><Settings /></ProtectedLayoutExpired>} />

          {/* Protected Routes - require active trial or subscription */}
          <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
          <Route path="/athletes" element={<ProtectedLayout><Athletes /></ProtectedLayout>} />
          <Route path="/athletes/new" element={<ProtectedLayout><AthleteForm /></ProtectedLayout>} />
          <Route path="/athletes/:id" element={<ProtectedLayout><AthleteForm /></ProtectedLayout>} />
          <Route path="/enrollments" element={<ProtectedLayout><Enrollments /></ProtectedLayout>} />
          <Route path="/enrollments/new" element={<ProtectedLayout><EnrollmentForm /></ProtectedLayout>} />
          <Route path="/enrollments/:id" element={<ProtectedLayout><EnrollmentForm /></ProtectedLayout>} />
          <Route path="/competitions" element={<ProtectedLayout><Competitions /></ProtectedLayout>} />
          <Route path="/competitions/new" element={<ProtectedLayout><CompetitionForm /></ProtectedLayout>} />
          <Route path="/competitions/:id" element={<ProtectedLayout><CompetitionForm /></ProtectedLayout>} />
          <Route path="/games" element={<ProtectedLayout><Games /></ProtectedLayout>} />
          <Route path="/games/new" element={<ProtectedLayout><GameForm /></ProtectedLayout>} />
          <Route path="/games/:id" element={<ProtectedLayout><GameForm /></ProtectedLayout>} />
          <Route path="/training" element={<ProtectedLayout><Training /></ProtectedLayout>} />
          <Route path="/training/new" element={<ProtectedLayout><TrainingForm /></ProtectedLayout>} />
          <Route path="/training/:id" element={<ProtectedLayout><TrainingForm /></ProtectedLayout>} />
          <Route path="/finance" element={<ProtectedLayout><Finance /></ProtectedLayout>} />
          <Route path="/finance/fees" element={<ProtectedLayout><MonthlyFees /></ProtectedLayout>} />
          <Route path="/subscription" element={<ProtectedLayout><Subscription /></ProtectedLayout>} />
          <Route path="*" element={
            <ProtectedLayout>
              <NotFoundPage />
            </ProtectedLayout>
          } />
        </Routes>
      </SubscriptionProvider>
    </TenantProvider>
  );
};

// Router wrapper that decides which route set to use
const AppRouter: React.FC = () => {
  const location = useLocation();
  const isAuthRoute = ['/login', '/signup', '/forgot-password'].includes(location.pathname);

  if (isAuthRoute) {
    return <AuthRoutes />;
  }

  return <ProtectedRoutes />;
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

