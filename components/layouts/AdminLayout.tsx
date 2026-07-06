import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import {
    LayoutDashboard, Users, LogOut, Shield, X, Menu, CreditCard,
    Wallet, Bell, UserCog, Palette, Plug, MessageCircle, Activity,
    BarChart3, FileSearch, Wrench, ArrowLeftRight, HelpCircle, ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface AdminSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const AdminSidebarItem: React.FC<{ icon: React.ElementType, label: string, path: string }> = ({ icon: Icon, label, path }) => {
    return (
        <NavLink
            to={path}
            end={path === '/admin'}
            className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                    ? 'bg-white/10 text-white font-semibold'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`
            }
        >
            <Icon className="w-5 h-5" />
            <span className="text-sm">{label}</span>
        </NavLink>
    );
};

const AdminSectionDivider: React.FC = () => <div className="h-px bg-white/10 mx-2 my-2" />;

const NAV_ITEMS: { icon: React.ElementType; label: string; path: string }[] = [
    { icon: LayoutDashboard, label: 'Visão Geral', path: '/admin' },
    { icon: Users, label: 'Contas', path: '/admin/users' },
    { icon: Wallet, label: 'Stripe', path: '/admin/stripe' },
    { icon: Bell, label: 'Notificações Stripe', path: '/admin/stripe-events' },
    { icon: CreditCard, label: 'Planos', path: '/admin/plans' },
    { icon: UserCog, label: 'Usuários', path: '/admin/platform-users' },
    { icon: Palette, label: 'Paletas', path: '/admin/palettes' },
    { icon: HelpCircle, label: 'Central de Ajuda', path: '/admin/help' },
    { icon: Plug, label: 'Integrações', path: '/admin/integrations' },
    { icon: MessageCircle, label: 'Widget de Chat', path: '/admin/chat-widget' },
    { icon: Activity, label: 'Saúde & Jobs', path: '/admin/health' },
    { icon: BarChart3, label: 'Observabilidade', path: '/admin/observability' },
    { icon: FileSearch, label: 'Auditoria', path: '/admin/audit' },
    { icon: ShieldAlert, label: 'Exclusões (LGPD)', path: '/admin/deletion-requests' },
];

const MAINTENANCE_ITEM = { icon: Wrench, label: 'Manutenção', path: '/admin/maintenance' };

const PAGE_TITLES: Record<string, string> = {
    '/admin': 'Visão Geral',
    '/admin/users': 'Contas',
    '/admin/stripe': 'Stripe',
    '/admin/stripe-events': 'Notificações Stripe',
    '/admin/plans': 'Planos',
    '/admin/platform-users': 'Usuários',
    '/admin/palettes': 'Paletas',
    '/admin/help': 'Central de Ajuda',
    '/admin/integrations': 'Integrações',
    '/admin/chat-widget': 'Widget de Chat',
    '/admin/health': 'Saúde & Jobs',
    '/admin/observability': 'Observabilidade',
    '/admin/audit': 'Auditoria',
    '/admin/deletion-requests': 'Exclusões (LGPD)',
    '/admin/maintenance': 'Manutenção',
};

const AdminSidebar: React.FC<AdminSidebarProps> = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const { signOut } = useAuth();

    return (
        <aside className={`
            w-64 bg-slate-900 text-white flex flex-col fixed h-full z-50 border-r border-slate-800
            transform transition-transform duration-300 ease-in-out
            ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0
        `}>
            <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center">
                        <Shield className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight">Admin SaaS</h1>
                </div>
                {/* Close button for mobile */}
                <button
                    onClick={onClose}
                    className="lg:hidden p-1 text-white/70 hover:text-white transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>

            <Link
                to="/"
                className="flex items-center gap-2 mx-3 mb-3 px-4 py-2 rounded-lg text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Ir para o sistema
            </Link>

            <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
                {NAV_ITEMS.map(item => (
                    <AdminSidebarItem key={item.path} icon={item.icon} label={item.label} path={item.path} />
                ))}

                <AdminSectionDivider />
                <AdminSidebarItem icon={MAINTENANCE_ITEM.icon} label={MAINTENANCE_ITEM.label} path={MAINTENANCE_ITEM.path} />
            </nav>

            <div className="p-4 border-t border-white/10">
                <button
                    onClick={async () => {
                        await signOut();
                        navigate('/login');
                    }}
                    className="flex items-center gap-3 w-full px-4 py-3 text-white/70 hover:text-white transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    <span className="text-sm">Sair</span>
                </button>
            </div>
        </aside>
    );
};

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Close sidebar on route change (mobile)
    useEffect(() => {
        setSidebarOpen(false);
    }, [location.pathname]);

    const getTitle = () => PAGE_TITLES[location.pathname] || 'Admin';

    return (
        <div className="flex min-h-screen bg-slate-50">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <main className="flex-1 lg:ml-64 min-h-screen flex flex-col">
                {/* Admin Header with hamburger */}
                <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-8 sticky top-0 z-40">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden p-2 -ml-2 mr-3 text-slate-600 hover:text-slate-800 transition-colors"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <h2 className="text-lg font-bold text-slate-800">{getTitle()}</h2>
                </header>
                <div className="p-4 lg:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
