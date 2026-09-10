import React from 'react';
import { Link } from 'react-router-dom';
import { LucideIcon, Plus, ArrowRight } from 'lucide-react';

interface Action {
    label: string;
    to: string;
}

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    /** One sentence on what this entity is for in the club's workflow. */
    description: string;
    /** The action that fills this list. */
    action?: Action;
    /**
     * Shown when the list cannot be filled yet because something upstream is
     * missing (an enrollment needs a plan, for instance).
     */
    prerequisite?: Action & { note: string };
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action, prerequisite }) => (
    <div className="flex flex-col items-center text-center px-6 py-14">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Icon className="w-6 h-6 text-primary" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-500 mt-1.5 max-w-md leading-relaxed">{description}</p>

        {prerequisite ? (
            <div className="mt-6 w-full max-w-md p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800 leading-relaxed">{prerequisite.note}</p>
                <Link
                    to={prerequisite.to}
                    className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-white border border-amber-300 text-amber-900 text-sm font-bold rounded-lg hover:bg-amber-100 transition-colors"
                >
                    {prerequisite.label}
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>
        ) : action ? (
            <Link
                to={action.to}
                className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all"
            >
                <Plus className="w-4 h-4" />
                {action.label}
            </Link>
        ) : null}
    </div>
);

export default EmptyState;
