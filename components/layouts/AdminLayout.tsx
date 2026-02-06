import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../Header';

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


const AdminSidebar: React.FC = () => {
    const navigate = useNavigate();
    const { signOut } = useAuth();

    return (
        <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full z-50 border-r border-slate-800">
            <div className="p-6 flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold tracking-tight">Super Admin</h1>
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

    const getTitle = () => {
        switch (location.pathname) {
            case '/admin': return 'Visão Geral';
            case '/admin/users': return 'Gerenciar Usuários';
            default: return 'Admin';
        }
    };

    return (
        <div className="flex min-h-screen bg-slate-50">
            <AdminSidebar />
            <main className="flex-1 ml-64 min-h-screen flex flex-col">
                <Header title={getTitle()} />
                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
