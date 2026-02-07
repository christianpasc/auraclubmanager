
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, MoreVertical, Edit2, Trash2, Loader2, X, ChevronDown } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
import { athleteService, Athlete } from '../services/athleteService';
import { useLanguage } from '../contexts/LanguageContext';

interface Filters {
  category: string;
  position: string;
  status: string;
}

const Athletes: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({ category: '', position: '', status: '' });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; athlete: Athlete | null; loading: boolean }>({
    isOpen: false,
    athlete: null,
    loading: false,
  });

  const categories = ['Sub-7', 'Sub-9', 'Sub-11', 'Sub-13', 'Sub-15', 'Sub-17', 'Sub-20', 'Profissional'];
  const positions = ['Goleiro', 'Zagueiro', 'Lateral Direito', 'Lateral Esquerdo', 'Volante', 'Meio-Campo', 'Meia Atacante', 'Ponta Direita', 'Ponta Esquerda', 'Centroavante'];
  const statuses = [
    { value: 'active', label: t('athletes.status.active') },
    { value: 'inactive', label: t('athletes.status.inactive') },
    { value: 'injured', label: t('athletes.status.injured') },
    { value: 'suspended', label: t('athletes.status.suspended') },
  ];

  useEffect(() => {
    loadAthletes();
  }, []);

  const loadAthletes = async () => {
    try {
      setLoading(true);
      const data = await athleteService.getAll();
      setAthletes(data);
    } catch (err) {
      setError(t('athletes.errorLoading'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteModal = (athlete: Athlete) => {
    setDeleteModal({ isOpen: true, athlete, loading: false });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, athlete: null, loading: false });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.athlete?.id) return;

    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      await athleteService.delete(deleteModal.athlete.id);
      setAthletes(athletes.filter(a => a.id !== deleteModal.athlete?.id));
      closeDeleteModal();
    } catch (err) {
      setError(t('athletes.errorDeleting'));
      console.error(err);
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const filteredAthletes = athletes.filter(a => {
    const matchesSearch = a.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.category?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesCategory = !filters.category || a.category === filters.category;
    const matchesPosition = !filters.position || a.position === filters.position;
    const matchesStatus = !filters.status || a.status === filters.status;
    return matchesSearch && matchesCategory && matchesPosition && matchesStatus;
  });

  const activeFiltersCount = [filters.category, filters.position, filters.status].filter(Boolean).length;

  const clearFilters = () => setFilters({ category: '', position: '', status: '' });

  const getStatusVariant = (status?: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'neutral';
      case 'injured': return 'warning';
      case 'suspended': return 'error';
      default: return 'neutral';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'active': return t('athletes.status.active');
      case 'inactive': return t('athletes.status.inactive');
      case 'injured': return t('athletes.status.injured');
      case 'suspended': return t('athletes.status.suspended');
      default: return status || 'N/A';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        searchPlaceholder={t('athletes.searchPlaceholder')}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        showViewToggle={true}
        viewMode={view}
        onViewModeChange={setView}
        showFilters={true}
        onFilterClick={() => setShowFilters(!showFilters)}
        actionLabel={t('athletes.registerAthlete')}
        actionIcon={UserPlus}
        onActionClick={() => navigate('/athletes/new')}
      />

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-700">{t('common.filters')}</h3>
            {activeFiltersCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-primary hover:text-primary-dark font-medium flex items-center gap-1">
                <X className="w-3 h-3" /> {t('common.clearFilters')} ({activeFiltersCount})
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('athletes.category')}</label>
              <div className="relative">
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none pr-8"
                >
                  <option value="">{t('athletes.allCategories')}</option>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('athletes.position')}</label>
              <div className="relative">
                <select
                  value={filters.position}
                  onChange={(e) => setFilters({ ...filters, position: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none pr-8"
                >
                  <option value="">{t('athletes.allPositions')}</option>
                  {positions.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('common.status')}</label>
              <div className="relative">
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none pr-8"
                >
                  <option value="">{t('athletes.allStatuses')}</option>
                  {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Tags */}
      {activeFiltersCount > 0 && !showFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">{t('athletes.activeFilters')}:</span>
          {filters.category && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
              {filters.category}
              <button onClick={() => setFilters({ ...filters, category: '' })} className="hover:text-primary-dark"><X className="w-3 h-3" /></button>
            </span>
          )}
          {filters.position && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
              {filters.position}
              <button onClick={() => setFilters({ ...filters, position: '' })} className="hover:text-primary-dark"><X className="w-3 h-3" /></button>
            </span>
          )}
          {filters.status && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
              {getStatusLabel(filters.status)}
              <button onClick={() => setFilters({ ...filters, status: '' })} className="hover:text-primary-dark"><X className="w-3 h-3" /></button>
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Results count */}
      <div className="text-sm text-slate-500">
        {filteredAthletes.length === athletes.length ? (
          <span>{athletes.length} {t('athletes.athletes')}</span>
        ) : (
          <span>{filteredAthletes.length} de {athletes.length} {t('athletes.athletes')}</span>
        )}
      </div>

      {view === 'list' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('athletes.athlete')}</th>
                  <th className="hidden md:table-cell px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('athletes.cpf')}</th>
                  <th className="hidden sm:table-cell px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('athletes.category')}</th>
                  <th className="hidden lg:table-cell px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('athletes.position')}</th>
                  <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">{t('common.status')}</th>
                  <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAthletes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      {searchTerm || activeFiltersCount > 0 ? t('athletes.noAthletesFiltered') : t('athletes.noAthletes')}
                    </td>
                  </tr>
                ) : (
                  filteredAthletes.map((athlete) => (
                    <tr key={athlete.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-3 md:px-6 py-3 md:py-4">
                        <div className="flex items-center gap-2 md:gap-3">
                          {athlete.photo_url ? (
                            <img src={athlete.photo_url} alt={athlete.full_name} className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover border border-slate-200" />
                          ) : (
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                              {athlete.full_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{athlete.full_name}</p>
                            <p className="text-xs text-slate-500 truncate hidden sm:block">{athlete.email || t('common.noEmail')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 text-sm text-slate-600">{athlete.cpf || '-'}</td>
                      <td className="hidden sm:table-cell px-3 md:px-6 py-3 md:py-4">
                        {athlete.category ? (
                          <span className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-full">{athlete.category}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="hidden lg:table-cell px-6 py-4 text-sm text-slate-600">{athlete.position || '-'}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                        <StatusBadge status={getStatusLabel(athlete.status)} variant={getStatusVariant(athlete.status)} />
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-right">
                        <div className="flex items-center justify-end gap-1 md:gap-2">
                          <button onClick={() => navigate(`/athletes/${athlete.id}`)} className="p-1.5 text-slate-400 hover:text-primary transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => openDeleteModal(athlete)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAthletes.map((athlete) => (
            <div
              key={athlete.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 relative group hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/athletes/${athlete.id}`)}
            >
              <button className="absolute top-4 right-4 text-slate-400"><MoreVertical className="w-5 h-5" /></button>
              <div className="flex flex-col items-center text-center">
                {athlete.photo_url ? (
                  <img src={athlete.photo_url} alt={athlete.full_name} className="w-20 h-20 rounded-full object-cover border-2 border-slate-200 mb-4" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold mb-4">
                    {athlete.full_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <h3 className="text-base font-bold text-slate-800 mb-1">{athlete.full_name}</h3>
                {athlete.category && (
                  <span className="px-3 py-1 bg-blue-50 text-primary text-[11px] font-bold rounded-full uppercase tracking-wider mb-2">{athlete.category}</span>
                )}
                <p className="text-sm text-slate-500">{athlete.position || t('common.noPosition')}</p>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-50 flex justify-between items-center text-xs text-slate-400">
                <span>{athlete.join_date ? new Date(athlete.join_date).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : '-'}</span>
                <span className={`flex items-center gap-1 font-medium ${athlete.status === 'active' ? 'text-green-600' : 'text-slate-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${athlete.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                  {getStatusLabel(athlete.status)}
                </span>
              </div>
            </div>
          ))}
          <button
            onClick={() => navigate('/athletes/new')}
            className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-primary hover:text-primary transition-all group"
          >
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-current flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <UserPlus className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold">{t('athletes.newAthlete')}</span>
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
        title={t('athletes.deleteAthlete')}
        message={`${t('athletes.deleteConfirm')} "${deleteModal.athlete?.full_name}"? ${t('athletes.deleteWarning')}`}
        confirmLabel={t('athletes.deleteAthlete')}
        cancelLabel={t('common.cancel')}
        isDestructive={true}
        loading={deleteModal.loading}
      />
    </div>
  );
};

export default Athletes;

