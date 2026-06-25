import React from 'react';
import { LucideIcon, Construction } from 'lucide-react';

interface AdminComingSoonProps {
    title: string;
    description: string;
    icon?: LucideIcon;
    phase: string;
}

const AdminComingSoon: React.FC<AdminComingSoonProps> = ({ title, description, icon: Icon = Construction, phase }) => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
            <Icon className="w-7 h-7 text-indigo-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">{title}</h3>
        <p className="text-sm text-slate-500 max-w-md">{description}</p>
        <p className="text-xs text-slate-400 mt-4">{phase}</p>
    </div>
);

export default AdminComingSoon;
