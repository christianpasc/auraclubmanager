
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus, UserCheck, Clock, AlertTriangle, Edit2, Trash2, Loader2, X, ChevronDown } from 'lucide-react';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
import { enrollmentService, EnrollmentWithAthlete, planTypes, enrollmentStatuses } from '../services/enrollmentService';
import { useLanguage } from '../contexts/LanguageContext';

interface Filters {
  status: string;
  plan_type: string;
}

const Enrollments: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [enrollments, setEnrollments] = useState<EnrollmentWithAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({ status: '', plan_type: '' });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; enrollment: EnrollmentWithAthlete | null; loading: boolean }>({
    isOpen: false, enrollment: null, loading: false
  });

  useEffect(() => {
    loadEnrollments();
  }, []);

  const loadEnrollments = async () => {
    try {
      setLoading(true);
      const data = await enrollmentService.getAll();
      setEnrollments(data);
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('AbortError')) {
        console.log('Enrollments fetch aborted');
        return;
      }
      setError(t('enrollments.errorLoading'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredEnrollments = enrollments.filter(e => {
    const athleteName = e.athlete?.full_name?.toLowerCase() || '';
    const matchesSearch = !searchTerm || athleteName.includes(searchTerm.toLowerCase());
    const matchesStatus = !filters.status || e.status === filters.status;
    const matchesPlan = !filters.plan_type || e.plan_type === filters.plan_type;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  // Stats
  const activeCount = enrollments.filter(e => e.status === 'active').length;
  const pendingCount = enrollments.filter(e => e.status === 'pending').length;
  const expiredCount = enrollments.filter(e => e.status === 'expired' || e.status === 'cancelled').length;

  const openDeleteModal = (enrollment: EnrollmentWithAthlete) => {
    setDeleteModal({ isOpen: true, enrollment, loading: false });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, enrollment: null, loading: false });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.enrollment?.id) return;
    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      await enrollmentService.delete(deleteModal.enrollment.id);
      setEnrollments(enrollments.filter(e => e.id !== deleteModal.enrollment?.id));
      closeDeleteModal();
    } catch (err) {
      setError(t('enrollments.errorDeleting'));
      console.error(err);
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const clearFilters = () => setFilters({ status: '', plan_type: '' });
  const activeFiltersCount = [filters.status, filters.plan_type].filter(Boolean).length;

  const getStatusVariant = (status?: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'pending': return 'warning';
      case 'cancelled': return 'error';
      case 'expired': return 'neutral';
      default: return 'neutral';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'active': return t('enrollments.status.active');
      case 'pending': return t('enrollments.status.pending');
      case 'cancelled': return t('enrollments.status.cancelled');
      case 'expired': return t('enrollments.status.expired');
      default: return status || 'N/A';
    }
  };

  const getPlanLabel = (planType?: string) => {
    const found = planTypes.find(p => p.value === planType);
    return found?.label || planType || 'N/A';
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const locale = language === 'en-US' ? 'en-US' : language === 'es-ES' ? 'es-ES' : 'pt-BR';
    return new Date(dateStr).toLocaleDateString(locale);
  };

  const formatCurrency = (value?: number) => {
    if (!value) return '-';
    const locale = language === 'en-US' ? 'en-US' : language === 'es-ES' ? 'es-ES' : 'pt-BR';
    const currency = language === 'en-US' ? 'USD' : language === 'es-ES' ? 'EUR' : 'BRL';
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label={t('enrollments.active')} value={activeCount.toString()} subValue="" icon={UserCheck} iconColor="bg-green-50 text-green-600" />
        <StatCard label={t('enrollments.pending')} value={pendingCount.toString()} subValue="" icon={Clock} iconColor="bg-amber-50 text-amber-600" />
        <StatCard label={t('enrollments.inactive')} value={expiredCount.toString()} subValue="" icon={AlertTriangle} iconColor="bg-red-50 text-red-600" />
      </div>

      <PageHeader
        searchPlaceholder={t('enrollments.searchPlaceholder')}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        showFilters={true}
        onFilterClick={() => setShowFilters(!showFilters)}
        actionLabel={t('enrollments.newEnrollment')}
        actionIcon={FilePlus}
        onActionClick={() => navigate('/enrollments/new')}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('common.status')}</label>
              <div className="relative">
                <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none pr-8">
                  <option value="">{t('enrollments.allStatuses')}</option>
                  {enrollmentStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('enrollments.plan')}</label>
              <div className="relative">
                <select value={filters.plan_type} onChange={(e) => setFilters({ ...filters, plan_type: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none pr-8">
                  <option value="">{t('enrollments.allPlans')}</option>
                  {planTypes.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Results count */}
      <div className="text-sm text-slate-500">
        {filteredEnrollments.length === enrollments.length ? (
          <span>{enrollments.length} {t('enrollments.enrollments')}</span>
        ) : (
          <span>{filteredEnrollments.length} de {enrollments.length} {t('enrollments.enrollments')}</span>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('enrollments.athlete')}</th>
                <th className="hidden sm:table-cell px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('enrollments.plan')}</th>
                <th className="hidden md:table-cell px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">{t('enrollments.enrollmentDate')}</th>
                <th className="hidden lg:table-cell px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">{t('enrollments.monthlyFee')}</th>
                <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">{t('common.status')}</th>
                <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEnrollments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    {searchTerm || activeFiltersCount > 0 ? t('enrollments.noEnrollmentsFiltered') : t('enrollments.noEnrollments')}
                  </td>
                </tr>
              ) : (
                filteredEnrollments.map((enrollment) => (
                  <tr key={enrollment.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      <div className="flex items-center gap-2 md:gap-3">
                        {enrollment.athlete?.photo_url ? (
                          <img src={enrollment.athlete.photo_url} alt={enrollment.athlete.full_name} className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover border border-slate-200" />
                        ) : (
                          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {enrollment.athlete?.full_name?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{enrollment.athlete?.full_name || t('common.noName')}</p>
                          <p className="text-xs text-slate-500 truncate">{enrollment.athlete?.category || t('common.noCategory')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-3 md:px-6 py-3 md:py-4">
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded uppercase">
                        {getPlanLabel(enrollment.plan_type)}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 text-sm text-slate-600 text-center">{formatDate(enrollment.enrollment_date)}</td>
                    <td className="hidden lg:table-cell px-6 py-4 text-sm text-slate-800 text-center font-semibold">{formatCurrency(enrollment.monthly_fee)}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                      <StatusBadge status={getStatusLabel(enrollment.status)} variant={getStatusVariant(enrollment.status)} />
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-right">
                      <div className="flex items-center justify-end gap-1 md:gap-2">
                        <button onClick={() => navigate(`/enrollments/${enrollment.id}`)} className="p-1.5 text-slate-400 hover:text-primary transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => openDeleteModal(enrollment)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
        title={t('enrollments.deleteEnrollment')}
        message={`${t('enrollments.deleteConfirm')} "${deleteModal.enrollment?.athlete?.full_name}"?`}
        confirmLabel={t('enrollments.deleteEnrollment')}
        cancelLabel={t('common.cancel')}
        isDestructive={true}
        loading={deleteModal.loading}
      />
    </div>
  );
};

export default Enrollments;
