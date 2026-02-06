
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon, Clock, MapPin, Dumbbell, Plus, Filter, Loader2, Trash2, Edit, List, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { trainingService, Training, trainingStatuses, trainingIntensities } from '../services/trainingService';
import { useTenant } from '../contexts/TenantContext';
import { useLanguage } from '../contexts/LanguageContext';
import ConfirmModal from '../components/ConfirmModal';

type ViewMode = 'list' | 'calendar';

interface Filters {
  category: string;
  status: string;
  intensity: string;
  dateFrom: string;
  dateTo: string;
}

const categories = ['Sub-7', 'Sub-9', 'Sub-11', 'Sub-13', 'Sub-15', 'Sub-17', 'Sub-20', 'Profissional'];

const TrainingPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const { t, language } = useLanguage();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({ category: '', status: '', intensity: '', dateFrom: '', dateTo: '' });

  const filteredTrainings = useMemo(() => {
    return trainings.filter(t => {
      if (filters.category && t.category !== filters.category) return false;
      if (filters.status && t.status !== filters.status) return false;
      if (filters.intensity && t.intensity !== filters.intensity) return false;
      if (filters.dateFrom && t.training_date < filters.dateFrom) return false;
      if (filters.dateTo && t.training_date > filters.dateTo) return false;
      return true;
    });
  }, [trainings, filters]);

  const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

  const weekdays = [
    t('training.weekdays.sun'),
    t('training.weekdays.mon'),
    t('training.weekdays.tue'),
    t('training.weekdays.wed'),
    t('training.weekdays.thu'),
    t('training.weekdays.fri'),
    t('training.weekdays.sat'),
  ];

  useEffect(() => {
    if (currentTenant) {
      loadTrainings();
    }
  }, [currentTenant]);

  const loadTrainings = async () => {
    try {
      setLoading(true);
      const data = await trainingService.getAll();
      setTrainings(data);
    } catch (error) {
      console.error('Error loading trainings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await trainingService.delete(deleteId);
      setTrainings(prev => prev.filter(t => t.id !== deleteId));
      setDeleteId(null);
    } catch (error) {
      console.error('Error deleting training:', error);
    }
  };

  const getStatusStyle = (status?: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'scheduled': return t('training.status.scheduled');
      case 'in_progress': return t('training.status.inProgress');
      case 'completed': return t('training.status.completed');
      case 'cancelled': return t('training.status.cancelled');
      default: return t('training.status.scheduled');
    }
  };

  const getIntensityLabel = (intensity?: string) => {
    return trainingIntensities.find(i => i.value === intensity)?.label || intensity;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return t('common.noDate');
    try {
      const date = new Date(dateString + 'T00:00:00');
      if (isNaN(date.getTime())) return t('common.invalidDate');
      const locale = language === 'en-US' ? 'en-US' : language === 'es-ES' ? 'es-ES' : 'pt-BR';
      return date.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short' });
    } catch {
      return t('common.invalidDate');
    }
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-bold text-slate-800">{t('training.title')}</h3>
          <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {filteredTrainings.length} {filteredTrainings.length !== 1 ? t('training.trainings') : t('training.training')}
          </span>
        </div>
        <div className="flex gap-3">
          {/* View Toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
              title={t('training.list')}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
              title={t('training.calendar')}
            >
              <CalendarIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-sm font-semibold transition-colors ${activeFilterCount > 0 ? 'border-primary text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
              <Filter className="w-4 h-4" />
              {t('common.filters')}
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 bg-primary text-white text-xs rounded-full">{activeFilterCount}</span>
              )}
            </button>

            {showFilters && (
              <div className="absolute right-0 top-12 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-bold text-slate-800">{t('common.filters')}</span>
                  <button onClick={() => setShowFilters(false)} className="p-1 text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('training.category')}</label>
                    <select
                      value={filters.category}
                      onChange={(e) => setFilters(f => ({ ...f, category: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                    >
                      <option value="">{t('training.allCategories')}</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('training.status')}</label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                    >
                      <option value="">{t('training.allStatuses')}</option>
                      {trainingStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('training.intensity')}</label>
                    <select
                      value={filters.intensity}
                      onChange={(e) => setFilters(f => ({ ...f, intensity: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                    >
                      <option value="">{t('training.allIntensities')}</option>
                      {trainingIntensities.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('training.from')}</label>
                      <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('training.to')}</label>
                      <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => setFilters({ category: '', status: '', intensity: '', dateFrom: '', dateTo: '' })}
                      className="w-full py-2 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      {t('common.clearFilters')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('/training/new')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark shadow-sm"
          >
            <Plus className="w-4 h-4" /> {t('training.scheduleTraining')}
          </button>
        </div>
      </div>

      {filteredTrainings.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Dumbbell className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-bold text-slate-800 mb-2">{t('training.noTrainings')}</h3>
          <p className="text-sm text-slate-500 mb-6">{t('training.startScheduling')}</p>
          <button
            onClick={() => navigate('/training/new')}
            className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark"
          >
            {t('training.scheduleFirst')}
          </button>
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filteredTrainings.map((train) => (
              <div
                key={train.id}
                className="p-6 flex flex-col md:flex-row md:items-center gap-6 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/training/${train.id}`)}
              >
                <div className="flex items-center gap-4 md:w-48">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-500 uppercase">
                      {formatDate(train.training_date)}
                    </span>
                    <span className="text-lg font-bold text-slate-800">
                      {formatTime(train.training_time) || '—'}
                    </span>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    {train.category && (
                      <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded uppercase">
                        {train.category}
                      </span>
                    )}
                    <h4 className="font-bold text-slate-800">{train.focus || t('training.training')}</h4>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    {train.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" /> {train.location}
                      </div>
                    )}
                    {train.intensity && (
                      <div className="flex items-center gap-1">
                        <Dumbbell className="w-4 h-4" /> {getIntensityLabel(train.intensity)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusStyle(train.status)}`}>
                    {getStatusLabel(train.status)}
                  </span>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => navigate(`/training/${train.id}`)}
                      className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(train.id!)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Calendar View */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-slate-800">
              {currentMonth.toLocaleDateString(language === 'en-US' ? 'en-US' : language === 'es-ES' ? 'es-ES' : 'pt-BR', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-slate-100">
            {weekdays.map(day => (
              <div key={day} className="p-2 text-center text-xs font-bold text-slate-500 uppercase">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {(() => {
              const year = currentMonth.getFullYear();
              const month = currentMonth.getMonth();
              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const today = new Date();
              const days = [];

              // Empty cells before first day
              for (let i = 0; i < firstDay; i++) {
                days.push(<div key={`empty-${i}`} className="p-2 min-h-24 border-b border-r border-slate-100 bg-slate-50" />);
              }

              // Days of month
              for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayTrainings = filteredTrainings.filter(t => t.training_date === dateStr);
                const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;

                days.push(
                  <div
                    key={day}
                    className={`p-2 min-h-24 border-b border-r border-slate-100 ${isToday ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                  >
                    <span className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-slate-700'}`}>{day}</span>
                    <div className="mt-1 space-y-1">
                      {dayTrainings.slice(0, 3).map(t => (
                        <button
                          key={t.id}
                          onClick={() => navigate(`/training/${t.id}`)}
                          className="w-full text-left px-1.5 py-0.5 bg-primary/10 hover:bg-primary/20 rounded text-[10px] font-semibold text-primary truncate"
                        >
                          {formatTime(t.training_time)} {t.category || t.focus}
                        </button>
                      ))}
                      {dayTrainings.length > 3 && (
                        <span className="block text-[10px] text-slate-400 pl-1">+{dayTrainings.length - 3} {t('training.more')}</span>
                      )}
                    </div>
                  </div>
                );
              }

              return days;
            })()}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        title={t('training.deleteTraining')}
        message={t('training.deleteConfirm')}
        confirmLabel={t('common.delete')}
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
};

export default TrainingPage;
