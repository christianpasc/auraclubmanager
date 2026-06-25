import React from 'react';
import { ChevronDown, ChevronRight, LucideIcon } from 'lucide-react';

interface SidebarGroupProps {
    icon: LucideIcon;
    label: string;
    active: boolean;
    open: boolean;
    collapsed: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

const SidebarGroup: React.FC<SidebarGroupProps> = ({ icon: Icon, label, active, open, collapsed, onToggle, children }) => {
    if (collapsed) {
        return (
            <div className="relative group">
                <button
                    onClick={onToggle}
                    title={label}
                    className={`flex items-center justify-center w-full px-3 py-3 rounded transition-colors ${
                        active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`}
                >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                </button>
                <div className="absolute left-full top-0 ml-2 hidden group-hover:flex flex-col bg-[#1a2d4e] border border-white/10 rounded-lg shadow-xl py-2 min-w-[200px] z-50">
                    <span className="px-4 py-1.5 text-xs font-bold text-white/40 uppercase tracking-wide">{label}</span>
                    {children}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            <button
                onClick={onToggle}
                className={`flex items-center justify-between w-full px-4 py-3 rounded transition-colors ${
                    active ? 'bg-white/10 text-white font-semibold' : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
            >
                <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">{label}</span>
                </div>
                {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {open && <div className="pl-11 space-y-1 mt-1">{children}</div>}
        </div>
    );
};

export default SidebarGroup;
