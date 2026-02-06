
import React from 'react';
import { Search, Filter, Grid, List, LucideIcon } from 'lucide-react';

interface PageHeaderProps {
    searchPlaceholder?: string;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    showFilters?: boolean;
    onFilterClick?: () => void;
    actionLabel?: string;
    actionIcon?: LucideIcon;
    onActionClick?: () => void;
    viewMode?: 'grid' | 'list';
    onViewModeChange?: (mode: 'grid' | 'list') => void;
    showViewToggle?: boolean;
}

const PageHeader: React.FC<PageHeaderProps> = ({
    searchPlaceholder = 'Buscar...',
    searchValue = '',
    onSearchChange,
    showFilters = true,
    onFilterClick,
    actionLabel,
    actionIcon: ActionIcon,
    onActionClick,
    viewMode,
    onViewModeChange,
    showViewToggle = false,
}) => {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={searchValue}
                        onChange={(e) => onSearchChange?.(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
                    />
                </div>

                {showViewToggle && onViewModeChange && (
                    <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                        <button
                            onClick={() => onViewModeChange('grid')}
                            className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid'
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-slate-400 hover:bg-slate-50'
                                }`}
                        >
                            <Grid className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => onViewModeChange('list')}
                            className={`p-1.5 rounded-md transition-colors ${viewMode === 'list'
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-slate-400 hover:bg-slate-50'
                                }`}
                        >
                            <List className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3">
                {showFilters && (
                    <button
                        onClick={onFilterClick}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <Filter className="w-4 h-4" />
                        Filtros
                    </button>
                )}

                {actionLabel && onActionClick && (
                    <button
                        onClick={onActionClick}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-lg transition-all shadow-lg shadow-primary/20"
                    >
                        {ActionIcon && <ActionIcon className="w-4 h-4" />}
                        {actionLabel}
                    </button>
                )}
            </div>
        </div>
    );
};

export default PageHeader;
