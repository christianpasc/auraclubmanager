
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

interface SidebarItemProps {
    icon: LucideIcon;
    label: string;
    path: string;
    collapsed?: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, path, collapsed }) => {
    return (
        <NavLink
            to={path}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
                `flex items-center gap-3 rounded transition-colors ${collapsed ? 'justify-center px-3 py-3' : 'px-4 py-3'} ${isActive
                    ? 'bg-white/10 border-l-4 border-primary text-white font-semibold'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`
            }
        >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm">{label}</span>}
        </NavLink>
    );
};

export default SidebarItem;
