
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Calendar, Users, ChevronRight, Plus, Search, Loader2, Trash2 } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import { competitionService, Competition, competitionStatuses, competitionTypes } from '../services/competitionService';
import { useLanguage } from '../contexts/LanguageContext';

const Competitions: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; competition: Competition | null; loading: boolean }>({
    isOpen: false, competition: null, loading: false
  });

  useEffect(() => {
    loadCompetitions();
  }, []);

  const loadCompetitions = async () => {
    try {
      setLoading(true);
      const data = await competitionService.getAll();
      setCompetitions(data);
    } catch (err) {
      setError(t('competitions.errorLoading'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCompetitions = competitions.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.category?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'ongoing': return 'bg-green-100 text-green-700';
      case 'upcoming': return 'bg-blue-100 text-blue-700';
      case 'finished': return 'bg-slate-100 text-slate-600';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'ongoing': return t('competitions.status.ongoing');
      case 'upcoming': return t('competitions.status.upcoming');
      case 'finished': return t('competitions.status.finished');
      case 'cancelled': return t('competitions.status.cancelled');
      default: return status || 'N/A';
    }
  };

  const getTypeLabel = (type?: string) => {
    switch (type) {
      case 'league': return t('competitions.type.league');
      case 'cup': return t('competitions.type.cup');
      case 'tournament': return t('competitions.type.tournament');
      case 'friendly': return t('competitions.type.friendly');
      case 'championship': return t('competitions.type.championship');
      default: return type || 'N/A';
    }
  };

  const formatDateRange = (start?: string, end?: string) => {
    if (!start && !end) return t('common.dateNotDefined');
    const locale = language === 'en-US' ? 'en-US' : language === 'es-ES' ? 'es-ES' : 'pt-BR';
    const formatDate = (d: string) => new Date(d).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
    if (start && end) return `${formatDate(start)} - ${formatDate(end)}`;
    if (start) return `${t('competitions.dateStart')}: ${formatDate(start)}`;
    return `${t('competitions.dateEnd')}: ${formatDate(end!)}`;
  };

  const openDeleteModal = (comp: Competition) => {
    setDeleteModal({ isOpen: true, competition: comp, loading: false });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, competition: null, loading: false });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.competition?.id) return;
    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      await competitionService.delete(deleteModal.competition.id);
      setCompetitions(competitions.filter(c => c.id !== deleteModal.competition?.id));
      closeDeleteModal();
    } catch (err) {
      setError(t('competitions.errorDeleting'));
      console.error(err);
      setDeleteModal(prev => ({ ...prev, loading: false }));
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
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t('competitions.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none shadow-sm"
          />
        </div>
        <button onClick={() => navigate('/competitions/new')} className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-lg transition-all shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4" />
          {t('competitions.newCompetition')}
        </button>
      </div>

      {/* Results count */}
      <div className="text-sm text-slate-500">
        {filteredCompetitions.length} {filteredCompetitions.length !== 1 ? t('competitions.competitions') : t('competitions.competition')}
      </div>

      {filteredCompetitions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Trophy className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500 font-medium">{searchTerm ? t('competitions.noCompetitionsFiltered') : t('competitions.noCompetitions')}</p>
          <p className="text-sm text-slate-400 mt-1">{t('competitions.clickToStart')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCompetitions.map((comp) => (
            <div key={comp.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden group hover:border-primary/30 hover:shadow-md transition-all">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-blue-50 rounded-lg text-primary">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(comp.status)}`}>
                      {getStatusLabel(comp.status)}
                    </span>
                    <button onClick={() => openDeleteModal(comp)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-slate-800 mb-1">{comp.name}</h3>
                <p className="text-sm text-slate-500 mb-6">{comp.season ? `${t('competitions.season')} ${comp.season}` : getTypeLabel(comp.type)}</p>

                <div className="space-y-3 mb-6">
                  {comp.category && (
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span>{comp.category}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>{formatDateRange(comp.start_date, comp.end_date)}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">{getTypeLabel(comp.type)}</span>
                  <button onClick={() => navigate(`/competitions/${comp.id}`)} className="flex items-center gap-1 text-sm font-bold text-primary hover:gap-2 transition-all">
                    {t('common.viewDetails')} <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Add New Card */}
          <button
            onClick={() => navigate('/competitions/new')}
            className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-primary hover:text-primary transition-all min-h-[280px]"
          >
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-current flex items-center justify-center mb-3">
              <Plus className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold">{t('competitions.newCompetition')}</span>
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
        title={t('competitions.deleteCompetition')}
        message={`${t('competitions.deleteConfirm')} "${deleteModal.competition?.name}"? ${t('competitions.deleteWarning')}`}
        confirmLabel={t('competitions.deleteCompetition')}
        cancelLabel={t('common.cancel')}
        isDestructive={true}
        loading={deleteModal.loading}
      />
    </div>
  );
};

export default Competitions;
