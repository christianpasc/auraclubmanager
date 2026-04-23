import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, ArrowUpCircle, ArrowDownCircle, Download, Filter, Plus, Edit2, Trash2, Loader2, X, ChevronDown, CreditCard } from 'lucide-react';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
import TransactionModal from '../components/TransactionModal';
import { financeService, Transaction } from '../services/financeService';
import { monthlyFeeService, MonthlyFee } from '../services/monthlyFeeService';
import { useLanguage } from '../contexts/LanguageContext';
import { useTenant } from '../contexts/TenantContext';

interface Filters {
  type: string;
  category: string;
  status: string;
}

const Finance: React.FC = () => {
  const navigate = useNavigate();
  const { t, language, formatCurrency } = useLanguage();
  const { currentTenant } = useTenant();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthlyFees, setMonthlyFees] = useState<MonthlyFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({ type: '', category: '', status: '' });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; transaction: Transaction | null; loading: boolean }>({
    isOpen: false,
    transaction: null,
    loading: false,
  });
  const [transactionModal, setTransactionModal] = useState<{ isOpen: boolean; editingId: string | null }>({
    isOpen: false,
    editingId: null,
  });

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const [txData, feeData] = await Promise.all([
        financeService.getAll(),
        monthlyFeeService.getAll(),
      ]);
      setTransactions(txData);
      setMonthlyFees(feeData); // Load all fees, not just paid
    } catch (err) {
      setError(t('finance.errorLoading'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(language, { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Only count paid fees as income
  const paidFees = monthlyFees.filter(f => f.status === 'paid');
  const monthlyFeesIncome = paidFees.reduce((acc, f) => acc + Number(f.amount), 0);
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0) + monthlyFeesIncome;
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  // Unified item type for display
  type UnifiedItem = {
    id: string;
    type: 'income' | 'expense' | 'fee';
    description: string;
    category: string;
    date: string;
    amount: number;
    status: string;
    isMonthlyFee: boolean;
    originalFee?: MonthlyFee;
    originalTransaction?: Transaction;
  };

  // Combine transactions and monthly fees into unified list
  const unifiedItems: UnifiedItem[] = [
    ...transactions.map(tx => ({
      id: tx.id!,
      type: tx.type as 'income' | 'expense',
      description: tx.description,
      category: tx.category,
      date: tx.date,
      amount: tx.amount,
      status: tx.status,
      isMonthlyFee: false,
      originalTransaction: tx,
    })),
    ...monthlyFees.map(fee => ({
      id: fee.id!,
      type: 'fee' as const,
      description: fee.description || `${t('finance.monthlyFee')} - ${fee.athlete?.full_name || ''}`,
      category: t('finance.monthlyFee'),
      date: fee.due_date,
      amount: fee.amount,
      status: fee.status,
      isMonthlyFee: true,
      originalFee: fee,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filter unified items
  const filteredItems = unifiedItems.filter(item => {
    const matchesType = !filters.type ||
      (filters.type === 'income' && (item.type === 'income' || (item.type === 'fee' && item.status === 'paid'))) ||
      (filters.type === 'expense' && item.type === 'expense') ||
      (filters.type === 'fee' && item.type === 'fee');
    const matchesCategory = !filters.category || item.category === filters.category;
    const matchesStatus = !filters.status || item.status === filters.status;
    return matchesType && matchesCategory && matchesStatus;
  });

  const activeFiltersCount = [filters.type, filters.category, filters.status].filter(Boolean).length;
  const clearFilters = () => setFilters({ type: '', category: '', status: '' });

  // Translated default categories + custom tenant categories
  const defaultIncome = [
    t('category.income.fees'), t('category.income.enrollments'), t('category.income.sponsorships'),
    t('category.income.events'), t('category.income.sales'), t('category.income.donations'), t('category.income.other'),
  ];
  const defaultExpense = [
    t('category.expense.infrastructure'), t('category.expense.equipment'), t('category.expense.salaries'),
    t('category.expense.transport'), t('category.expense.food'), t('category.expense.sportsMaterial'),
    t('category.expense.marketing'), t('category.expense.maintenance'), t('category.expense.taxes'), t('category.expense.other'),
  ];
  const tenantSettings = currentTenant?.settings as any;
  const allCategories = [
    ...new Set([
      ...defaultIncome,
      ...defaultExpense,
      ...(tenantSettings?.income_categories || []),
      ...(tenantSettings?.expense_categories || []),
    ])
  ];

  const openDeleteModal = (transaction: Transaction) => {
    setDeleteModal({ isOpen: true, transaction, loading: false });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, transaction: null, loading: false });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.transaction?.id) return;

    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      await financeService.delete(deleteModal.transaction.id);
      setTransactions(transactions.filter(t => t.id !== deleteModal.transaction?.id));
      closeDeleteModal();
    } catch (err) {
      setError(t('finance.errorDeleting'));
      console.error(err);
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'reconciled': return 'info';
      case 'paid': return 'success';
      case 'overdue': return 'error';
      case 'pending': return 'warning';
      default: return 'warning';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'reconciled': return t('finance.status.reconciled');
      case 'paid': return t('finance.status.paid');
      case 'overdue': return t('finance.status.overdue');
      case 'pending': return t('finance.status.pending');
      default: return t('finance.status.pending');
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
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          label={t('finance.balance')}
          value={formatCurrency(balance)}
          subValue=""
          icon={Wallet}
          iconColor={balance >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}
        />
        <StatCard
          label={t('finance.revenue')}
          value={formatCurrency(totalIncome)}
          subValue=""
          icon={ArrowUpCircle}
          iconColor="bg-green-50 text-green-600"
        />
        <StatCard
          label={t('finance.expenses')}
          value={formatCurrency(totalExpense)}
          subValue=""
          icon={ArrowDownCircle}
          iconColor="bg-red-50 text-red-600"
        />
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Monthly Fees Quick Access */}
      {monthlyFees.length > 0 && (
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-4 rounded-xl border border-primary/20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <CreditCard className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">{t('finance.monthlyFees')}</h3>
              <p className="text-sm text-slate-600">
                {paidFees.length} {t('finance.paidCount')} ({formatCurrency(monthlyFeesIncome)}) • {monthlyFees.filter(f => f.status === 'pending').length} {t('finance.pendingCount')}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/monthly-fees')}
            className="px-4 py-2 bg-white text-primary font-semibold text-sm rounded-lg border border-primary/20 hover:bg-primary hover:text-white transition-colors"
          >
            {t('finance.viewMonthlyFees')}
          </button>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="font-bold text-slate-800">
            {t('finance.recentTransactions')}
          </h3>
          <div className="flex flex-wrap gap-2">
            <button className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-100">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{t('common.export')}</span>
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${activeFiltersCount > 0
                ? 'bg-primary/10 text-primary'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">{t('common.filters')}</span>
              {activeFiltersCount > 0 && (
                <span className="w-5 h-5 bg-primary text-white rounded-full text-xs flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setTransactionModal({ isOpen: true, editingId: null })}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('finance.newEntry')}</span>
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="p-4 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-slate-700">{t('common.filters')}</h4>
              {activeFiltersCount > 0 && (
                <button onClick={clearFilters} className="text-xs text-primary hover:text-primary-dark font-medium flex items-center gap-1">
                  <X className="w-3 h-3" /> {t('common.clearFilters')} ({activeFiltersCount})
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  {t('common.type')}
                </label>
                <div className="relative">
                  <select
                    value={filters.type}
                    onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none pr-8"
                  >
                    <option value="">{t('finance.allTypes')}</option>
                    <option value="income">{t('finance.income')}</option>
                    <option value="expense">{t('finance.expense')}</option>
                    <option value="fee">{t('finance.monthlyFee')}</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  {t('athletes.category')}
                </label>
                <div className="relative">
                  <select
                    value={filters.category}
                    onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none pr-8"
                  >
                    <option value="">{t('finance.allCategories')}</option>
                    {allCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  {t('common.status')}
                </label>
                <div className="relative">
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none pr-8"
                  >
                    <option value="">{t('finance.allTypes')}</option>
                    <option value="pending">{t('finance.status.pending')}</option>
                    <option value="reconciled">{t('finance.status.reconciled')}</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-3 md:px-6 py-3 md:py-4">{t('finance.col.description')}</th>
                <th className="hidden sm:table-cell px-3 md:px-6 py-3 md:py-4">{t('athletes.category')}</th>
                <th className="hidden md:table-cell px-6 py-4">{t('finance.col.date')}</th>
                <th className="hidden lg:table-cell px-6 py-4">{t('common.status')}</th>
                <th className="px-3 md:px-6 py-3 md:py-4 text-right">{t('finance.col.amount')}</th>
                <th className="px-3 md:px-6 py-3 md:py-4 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    {activeFiltersCount > 0
                      ? t('finance.noEntriesFiltered')
                      : t('finance.noEntries')
                    }
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={`${item.isMonthlyFee ? 'fee' : 'tx'}-${item.id}`} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className={`p-1.5 md:p-2 rounded-full ${item.type === 'fee'
                          ? (item.status === 'paid' ? 'bg-green-100 text-green-600' : item.status === 'overdue' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600')
                          : item.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                          }`}>
                          {item.type === 'fee'
                            ? <CreditCard className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            : item.type === 'income' ? <ArrowUpCircle className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <ArrowDownCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          }
                        </div>
                        <span className="text-sm font-semibold text-slate-800 truncate max-w-[120px] md:max-w-none">{item.description}</span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-3 md:px-6 py-3 md:py-4 text-sm text-slate-500">{item.category}</td>
                    <td className="hidden md:table-cell px-6 py-4 text-sm text-slate-500">{formatDate(item.date)}</td>
                    <td className="hidden lg:table-cell px-6 py-4">
                      <StatusBadge
                        status={getStatusLabel(item.status)}
                        variant={getStatusVariant(item.status)}
                      />
                    </td>
                    <td className={`px-3 md:px-6 py-3 md:py-4 text-sm font-bold text-right ${item.type === 'expense' ? 'text-red-600' :
                      (item.type === 'fee' && item.status !== 'paid') ? 'text-amber-600' : 'text-green-600'
                      }`}>
                      {item.type === 'expense' ? '-' : item.status === 'paid' || item.type === 'income' ? '+' : ''} {formatCurrency(item.amount)}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-right">
                      {!item.isMonthlyFee ? (
                        <div className="flex items-center justify-end gap-1 md:gap-2">
                          <button
                            onClick={() => setTransactionModal({ isOpen: true, editingId: item.id })}
                            className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(item.originalTransaction!)}
                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => navigate('/monthly-fees')}
                          className="text-xs text-primary hover:underline"
                        >
                          {t('common.view')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Results count */}
        {unifiedItems.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 text-sm text-slate-500">
            {filteredItems.length === unifiedItems.length ? (
              <span>{unifiedItems.length} {t('finance.entries')}</span>
            ) : (
              <span>{filteredItems.length} {t('common.of')} {unifiedItems.length} {t('finance.entries')}</span>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
        title={t('finance.deleteTransaction')}
        message={`${t('finance.deleteConfirm')} "${deleteModal.transaction?.description}"? ${t('finance.deleteWarning')}`}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        isDestructive={true}
        loading={deleteModal.loading}
      />

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={transactionModal.isOpen}
        onClose={() => setTransactionModal({ isOpen: false, editingId: null })}
        onSaved={loadTransactions}
        transactionId={transactionModal.editingId}
      />
    </div>
  );
};

export default Finance;
