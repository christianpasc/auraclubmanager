import React, { useState, useEffect } from 'react';
import { Search, CheckCircle, Clock, AlertCircle, Download, CreditCard, Plus, Edit2, Trash2, Loader2, X, ChevronDown, Check } from 'lucide-react';
import { monthlyFeeService, MonthlyFee } from '../services/monthlyFeeService';
import { useLanguage } from '../contexts/LanguageContext';
import ConfirmModal from '../components/ConfirmModal';
import MonthlyFeeModal from '../components/MonthlyFeeModal';

interface Filters {
  status: string;
  month: string;
}

const MonthlyFees: React.FC = () => {
  const { t, language } = useLanguage();

  const [fees, setFees] = useState<MonthlyFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({ status: '', month: '' });

  const [feeModal, setFeeModal] = useState<{ isOpen: boolean; editingId: string | null }>({
    isOpen: false, editingId: null
  });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; fee: MonthlyFee | null; loading: boolean }>({
    isOpen: false, fee: null, loading: false
  });
  const [markPaidModal, setMarkPaidModal] = useState<{ isOpen: boolean; fee: MonthlyFee | null; loading: boolean }>({
    isOpen: false, fee: null, loading: false
  });

  useEffect(() => {
    loadFees();
  }, []);

  const loadFees = async () => {
    try {
      setLoading(true);
      await monthlyFeeService.updateOverdueStatus(); // Auto-update overdue fees
      const data = await monthlyFeeService.getAll();
      setFees(data);
    } catch (err) {
      setError(getText('Erro ao carregar mensalidades', 'Error loading fees', 'Error al cargar mensualidades'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getText = (pt: string, en: string, es: string) => {
    return language === 'en-US' ? en : language === 'es-ES' ? es : pt;
  };

  const formatCurrency = (value: number) => {
    const locale = language === 'en-US' ? 'en-US' : language === 'es-ES' ? 'es-ES' : 'pt-BR';
    const currency = language === 'en-US' ? 'USD' : language === 'es-ES' ? 'EUR' : 'BRL';
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const locale = language === 'en-US' ? 'en-US' : language === 'es-ES' ? 'es-ES' : 'pt-BR';
    return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getMonthYear = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(language, { month: 'long', year: 'numeric' });
  };

  // Calculate summary
  const summary = {
    totalExpected: fees.reduce((acc, f) => acc + Number(f.amount), 0),
    totalReceived: fees.filter(f => f.status === 'paid').reduce((acc, f) => acc + Number(f.amount), 0),
    totalPending: fees.filter(f => f.status === 'pending').reduce((acc, f) => acc + Number(f.amount), 0),
    totalOverdue: fees.filter(f => f.status === 'overdue').reduce((acc, f) => acc + Number(f.amount), 0),
    pendingCount: fees.filter(f => f.status === 'pending').length,
    overdueCount: fees.filter(f => f.status === 'overdue').length,
  };

  // Get unique months for filter
  const uniqueMonths = [...new Set(fees.map(f => f.due_date.substring(0, 7)))].sort().reverse();

  // Filter fees
  const filteredFees = fees.filter(f => {
    const athleteName = f.athlete?.full_name?.toLowerCase() || '';
    const matchesSearch = !searchTerm || athleteName.includes(searchTerm.toLowerCase());
    const matchesStatus = !filters.status || f.status === filters.status;
    const matchesMonth = !filters.month || f.due_date.startsWith(filters.month);
    return matchesSearch && matchesStatus && matchesMonth;
  });

  const activeFiltersCount = [filters.status, filters.month].filter(Boolean).length;
  const clearFilters = () => setFilters({ status: '', month: '' });

  const handleDelete = async () => {
    if (!deleteModal.fee?.id) return;
    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      await monthlyFeeService.delete(deleteModal.fee.id);
      setFees(fees.filter(f => f.id !== deleteModal.fee?.id));
      setDeleteModal({ isOpen: false, fee: null, loading: false });
    } catch (err) {
      console.error(err);
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleMarkAsPaid = async () => {
    if (!markPaidModal.fee?.id) return;
    setMarkPaidModal(prev => ({ ...prev, loading: true }));
    try {
      await monthlyFeeService.markAsPaid(markPaidModal.fee.id);
      await loadFees();
      setMarkPaidModal({ isOpen: false, fee: null, loading: false });
    } catch (err) {
      console.error(err);
      setMarkPaidModal(prev => ({ ...prev, loading: false }));
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      paid: 'bg-green-100 text-green-700',
      pending: 'bg-amber-100 text-amber-700',
      overdue: 'bg-red-100 text-red-700',
    };
    const labels = {
      paid: getText('Pago', 'Paid', 'Pagado'),
      pending: getText('Pendente', 'Pending', 'Pendiente'),
      overdue: getText('Atrasado', 'Overdue', 'Atrasado'),
    };
    return (
      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
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
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500 mb-1">{getText('Total Esperado', 'Expected Total', 'Total Esperado')}</p>
          <h3 className="text-xl font-bold text-slate-800">{formatCurrency(summary.totalExpected)}</h3>
          <p className="text-xs text-slate-400 mt-2">{fees.length} {getText('mensalidades', 'fees', 'mensualidades')}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">{getText('Recebido', 'Received', 'Recibido')}</p>
              <h3 className="text-xl font-bold text-green-600">{formatCurrency(summary.totalReceived)}</h3>
            </div>
            <div className="p-2 bg-green-50 rounded-lg text-green-600"><CheckCircle className="w-4 h-4" /></div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {summary.totalExpected > 0 ? Math.round((summary.totalReceived / summary.totalExpected) * 100) : 0}% {getText('do total', 'of total', 'del total')}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">{getText('Pendente', 'Pending', 'Pendiente')}</p>
              <h3 className="text-xl font-bold text-amber-600">{formatCurrency(summary.totalPending)}</h3>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><Clock className="w-4 h-4" /></div>
          </div>
          <p className="text-xs text-slate-400 mt-2">{summary.pendingCount} {getText('pagamentos', 'payments', 'pagos')}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">{getText('Atrasado', 'Overdue', 'Atrasado')}</p>
              <h3 className="text-xl font-bold text-red-600">{formatCurrency(summary.totalOverdue)}</h3>
            </div>
            <div className="p-2 bg-red-50 rounded-lg text-red-600"><AlertCircle className="w-4 h-4" /></div>
          </div>
          <p className="text-xs text-slate-400 mt-2">{summary.overdueCount} {getText('pagamentos', 'payments', 'pagos')}</p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Month Filter */}
          <div className="relative">
            <select
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: e.target.value })}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 outline-none shadow-sm appearance-none pr-10"
            >
              <option value="">{getText('Todos os Meses', 'All Months', 'Todos los Meses')}</option>
              {uniqueMonths.map(m => (
                <option key={m} value={m}>
                  {new Date(m + '-01').toLocaleDateString(language, { month: 'long', year: 'numeric' })}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={getText('Buscar atleta...', 'Search athlete...', 'Buscar atleta...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none shadow-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-50 transition-all shadow-sm">
            <Download className="w-4 h-4" /> {getText('Exportar', 'Export', 'Exportar')}
          </button>
          <button
            onClick={() => setFeeModal({ isOpen: true, editingId: null })}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-lg transition-all shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" /> {getText('Nova Mensalidade', 'New Fee', 'Nueva Mensualidad')}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Filter Chips */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilters({ ...filters, status: '' })}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!filters.status ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
        >
          {getText('Todos', 'All', 'Todos')}
        </button>
        <button
          onClick={() => setFilters({ ...filters, status: 'pending' })}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filters.status === 'pending' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
        >
          {getText('Pendentes', 'Pending', 'Pendientes')} ({summary.pendingCount})
        </button>
        <button
          onClick={() => setFilters({ ...filters, status: 'overdue' })}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filters.status === 'overdue' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
        >
          {getText('Atrasados', 'Overdue', 'Atrasados')} ({summary.overdueCount})
        </button>
        <button
          onClick={() => setFilters({ ...filters, status: 'paid' })}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filters.status === 'paid' ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
        >
          {getText('Pagos', 'Paid', 'Pagados')}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{getText('Atleta', 'Athlete', 'Atleta')}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{getText('Categoria', 'Category', 'Categoría')}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">{getText('Vencimento', 'Due Date', 'Vencimiento')}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">{getText('Valor', 'Amount', 'Monto')}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">{t('common.status')}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    {getText('Nenhuma mensalidade encontrada', 'No fees found', 'No se encontraron mensualidades')}
                  </td>
                </tr>
              ) : (
                filteredFees.map((fee) => (
                  <tr key={fee.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {fee.athlete?.photo_url ? (
                          <img src={fee.athlete.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {fee.athlete?.full_name?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                        <span className="text-sm font-semibold text-slate-800">{fee.athlete?.full_name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{fee.athlete?.category || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 text-center">{formatDate(fee.due_date)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-right text-slate-800">
                      {formatCurrency(fee.amount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(fee.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {fee.status !== 'paid' && (
                          <button
                            onClick={() => setMarkPaidModal({ isOpen: true, fee, loading: false })}
                            className="p-1.5 text-slate-400 hover:text-green-600 transition-colors"
                            title={getText('Marcar como pago', 'Mark as paid', 'Marcar como pagado')}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setFeeModal({ isOpen: true, editingId: fee.id! })}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteModal({ isOpen: true, fee, loading: false })}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        >
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

        {/* Results count */}
        {fees.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 text-sm text-slate-500">
            {filteredFees.length === fees.length ? (
              <span>{fees.length} {getText('mensalidades', 'fees', 'mensualidades')}</span>
            ) : (
              <span>{filteredFees.length} de {fees.length} {getText('mensalidades', 'fees', 'mensualidades')}</span>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <MonthlyFeeModal
        isOpen={feeModal.isOpen}
        onClose={() => setFeeModal({ isOpen: false, editingId: null })}
        onSaved={loadFees}
        feeId={feeModal.editingId}
      />

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, fee: null, loading: false })}
        onConfirm={handleDelete}
        title={getText('Excluir Mensalidade', 'Delete Fee', 'Eliminar Mensualidad')}
        message={getText(
          'Tem certeza que deseja excluir esta mensalidade? Esta ação não pode ser desfeita.',
          'Are you sure you want to delete this fee? This action cannot be undone.',
          '¿Está seguro de que desea eliminar esta mensualidad? Esta acción no se puede deshacer.'
        )}
        confirmLabel={getText('Excluir', 'Delete', 'Eliminar')}
        cancelLabel={getText('Cancelar', 'Cancel', 'Cancelar')}
        isDestructive={true}
        loading={deleteModal.loading}
      />

      <ConfirmModal
        isOpen={markPaidModal.isOpen}
        onClose={() => setMarkPaidModal({ isOpen: false, fee: null, loading: false })}
        onConfirm={handleMarkAsPaid}
        title={getText('Confirmar Pagamento', 'Confirm Payment', 'Confirmar Pago')}
        message={getText(
          `Deseja marcar a mensalidade de ${markPaidModal.fee?.athlete?.full_name || ''} como paga?`,
          `Do you want to mark ${markPaidModal.fee?.athlete?.full_name || ''}'s fee as paid?`,
          `¿Desea marcar la mensualidad de ${markPaidModal.fee?.athlete?.full_name || ''} como pagada?`
        )}
        confirmLabel={getText('Confirmar', 'Confirm', 'Confirmar')}
        cancelLabel={getText('Cancelar', 'Cancel', 'Cancelar')}
        isDestructive={false}
        loading={markPaidModal.loading}
      />
    </div>
  );
};

export default MonthlyFees;
