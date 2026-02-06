
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

interface SidebarItemProps {
    icon: LucideIcon;
    label: string;
    path: string;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, path }) => {
    return (
        <NavLink
            to={path}
            className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded transition-colors ${isActive
                    ? 'bg-white/10 border-l-4 border-primary text-white font-semibold'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`
            }
        >
            <Icon className="w-5 h-5" />
            <span className="text-sm">{label}</span>
        </NavLink>
    );
};

export default SidebarItem;
