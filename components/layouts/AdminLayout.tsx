import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut, Shield, X, Menu } from 'lucide-react';
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
                    <h1 className="text-xl font-bold tracking-tight">Super Admin</h1>
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
                <AdminSidebarItem icon={LayoutDashboard} label="Dashboard" path="/admin" />
                <AdminSidebarItem icon={Users} label="Usuários (Tenants)" path="/admin/users" />
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

    const getTitle = () => {
        switch (location.pathname) {
            case '/admin': return 'Visão Geral';
            case '/admin/users': return 'Gerenciar Usuários';
            default: return 'Admin';
        }
    };

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
