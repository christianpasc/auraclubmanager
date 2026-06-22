import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, ArrowUpCircle, ArrowDownCircle, Filter, Plus, Edit2, Trash2,
  Loader2, X, ChevronDown, CreditCard, ShoppingBag, Building2, RefreshCcw,
  Link2, Mail, Check,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
import TransactionModal from '../components/TransactionModal';
import { financeService, Transaction } from '../services/financeService';
import { monthlyFeeService, MonthlyFee } from '../services/monthlyFeeService';
import { storeService, Order, ORDER_STATUS_LABELS } from '../services/storeService';
import { facilityService, Booking, BOOKING_STATUS_LABELS } from '../services/facilityService';
import { invoiceService, Invoice } from '../services/invoiceService';
import { paymentProvider } from '../services/payment';
import { useLanguage } from '../contexts/LanguageContext';
import { useTenant } from '../contexts/TenantContext';

const safeCall = <T,>(p: Promise<T>, def: T): Promise<T> => p.catch(() => def);

type TabId = 'summary' | 'transactions' | 'fees' | 'store' | 'facilities';

const ORDER_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
  pending: 'warning',
  confirmed: 'info',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'neutral',
};

const BOOKING_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'neutral'> = {
  confirmed: 'success',
  pending: 'warning',
  cancelled: 'neutral',
};

const Finance: React.FC = () => {
  const navigate = useNavigate();
  const { t, language, formatCurrency } = useLanguage();
  const { currentTenant } = useTenant();

  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthlyFees, setMonthlyFees] = useState<MonthlyFee[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stripe actions
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<string | null>(null);
  const [refundLoadingId, setRefundLoadingId] = useState<string | null>(null);
  const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null);
  const [resendLoadingId, setResendLoadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [stripeActionMsg, setStripeActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [refundConfirm, setRefundConfirm] = useState<{ open: boolean; invoice: Invoice | null }>({ open: false, invoice: null });
  const [cancelConfirm, setCancelConfirm] = useState<{ open: boolean; invoice: Invoice | null }>({ open: false, invoice: null });

  const stripeActive = !!(currentTenant?.stripe_connect_charges_enabled && currentTenant?.stripe_connect_payouts_enabled);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ type: '', category: '', status: '' });
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; transaction: Transaction | null; loading: boolean }>({
    isOpen: false, transaction: null, loading: false,
  });
  const [transactionModal, setTransactionModal] = useState<{ isOpen: boolean; editingId: string | null }>({
    isOpen: false, editingId: null,
  });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [txData, feeData, ordersData, bookingsData, invoicesData] = await Promise.all([
        financeService.getAll(),
        safeCall(monthlyFeeService.getAll(), []),
        safeCall(storeService.getOrders(), []),
        safeCall(facilityService.getBookings(), []),
        safeCall(invoiceService.getAll(), []),
      ]);
      setTransactions(txData);
      setMonthlyFees(feeData);
      setOrders(ordersData);
      setBookings(bookingsData);
      setInvoices(invoicesData);
    } catch {
      setError(t('finance.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
    return date.toLocaleDateString(language, { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // ---- Revenue aggregation ----
  const transactionIncome = transactions.filter(tx => tx.type === 'income').reduce((s, tx) => s + Number(tx.amount), 0);
  const transactionExpense = transactions.filter(tx => tx.type === 'expense').reduce((s, tx) => s + Number(tx.amount), 0);
  const feesReceived = monthlyFees.filter(f => f.status === 'paid').reduce((s, f) => s + Number(f.amount), 0);
  const feesPending = monthlyFees.filter(f => f.status === 'pending').reduce((s, f) => s + Number(f.amount), 0);
  const feesOverdue = monthlyFees.filter(f => f.status === 'overdue').reduce((s, f) => s + Number(f.amount), 0);
  const storeRevenue = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const storePipeline = orders.filter(o => ['pending', 'confirmed', 'shipped'].includes(o.status || '')).reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const facilityRevenue = bookings.filter(b => b.status === 'confirmed' && Number(b.cost || 0) > 0).reduce((s, b) => s + Number(b.cost || 0), 0);
  const facilityPending = bookings.filter(b => b.status === 'pending' && Number(b.cost || 0) > 0).reduce((s, b) => s + Number(b.cost || 0), 0);
  const totalRevenue = transactionIncome + feesReceived + storeRevenue + facilityRevenue;
  const balance = totalRevenue - transactionExpense;
  const toReceive = feesPending + storePipeline + facilityPending;

  const revenueBySource = [
    { name: t('finance.tab.transactions'), value: transactionIncome, color: '#6366f1' },
    { name: t('finance.tab.fees'), value: feesReceived, color: '#10b981' },
    { name: t('finance.tab.store'), value: storeRevenue, color: '#f59e0b' },
    { name: t('finance.tab.facilities'), value: facilityRevenue, color: '#3b82f6' },
  ];

  // ---- Transaction tab ----
  const tenantSettings = currentTenant?.settings as any;
  const defaultIncome = [
    t('category.income.fees'), t('category.income.enrollments'), t('category.income.sponsorships'),
    t('category.income.events'), t('category.income.sales'), t('category.income.donations'), t('category.income.other'),
  ];
  const defaultExpense = [
    t('category.expense.infrastructure'), t('category.expense.equipment'), t('category.expense.salaries'),
    t('category.expense.transport'), t('category.expense.food'), t('category.expense.sportsMaterial'),
    t('category.expense.marketing'), t('category.expense.maintenance'), t('category.expense.taxes'), t('category.expense.other'),
  ];
  const allCategories = [...new Set([
    ...defaultIncome, ...defaultExpense,
    ...(tenantSettings?.income_categories || []),
    ...(tenantSettings?.expense_categories || []),
  ])];

  const filteredTransactions = transactions.filter(tx => {
    const matchesType = !filters.type || tx.type === filters.type;
    const matchesCategory = !filters.category || tx.category === filters.category;
    const matchesStatus = !filters.status || tx.status === filters.status;
    return matchesType && matchesCategory && matchesStatus;
  });
  const activeFiltersCount = [filters.type, filters.category, filters.status].filter(Boolean).length;

  const getTxStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'info' => {
    switch (status) {
      case 'reconciled': return 'info';
      case 'paid': return 'success';
      case 'overdue': return 'error';
      default: return 'warning';
    }
  };

  const getTxStatusLabel = (status: string) => {
    switch (status) {
      case 'reconciled': return t('finance.status.reconciled');
      case 'paid': return t('finance.status.paid');
      case 'overdue': return t('finance.status.overdue');
      case 'pending': return t('finance.status.pending');
      default: return t('finance.status.pending');
    }
  };

  const getFeeStatusVariant = (status: string): 'success' | 'warning' | 'error' => {
    if (status === 'paid') return 'success';
    if (status === 'overdue') return 'error';
    return 'warning';
  };

  const handleDeleteTransaction = async () => {
    if (!deleteModal.transaction?.id) return;
    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      await financeService.delete(deleteModal.transaction.id);
      setTransactions(prev => prev.filter(tx => tx.id !== deleteModal.transaction?.id));
      setDeleteModal({ isOpen: false, transaction: null, loading: false });
    } catch {
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleChargeViaStripe = async (invoice: Invoice) => {
    if (!currentTenant?.id || !invoice.id) return;
    setCheckoutLoadingId(invoice.id);
    setStripeActionMsg(null);
    try {
      const baseUrl = window.location.origin + window.location.pathname;
      const result = await paymentProvider.createCheckoutSession({
        mode: 'subscription',
        tenantId: currentTenant.id,
        invoiceId: invoice.id,
        successUrl: `${baseUrl}#/finance?stripe_paid=1`,
        cancelUrl: `${baseUrl}#/finance`,
      });
      window.location.href = result.url;
    } catch (err: any) {
      setStripeActionMsg({ type: 'err', text: err.message || t('payment.actionError') });
      setCheckoutLoadingId(null);
    }
  };

  const handleCopyPayLink = async (invoice: Invoice) => {
    if (!invoice.id) return;
    const payUrl = `${window.location.origin}/#/pay/${invoice.id}`;
    try {
      await navigator.clipboard.writeText(payUrl);
      setCopiedId(invoice.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setStripeActionMsg({ type: 'err', text: t('payment.actionError') });
    }
  };

  const handleResendInvoiceEmail = async (invoice: Invoice) => {
    if (!invoice.id) return;
    setResendLoadingId(invoice.id);
    setStripeActionMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-invoice-email', {
        body: { invoice_id: invoice.id, base_url: window.location.origin },
      });
      if (error) throw error;
      if (data?.sent) {
        setStripeActionMsg({ type: 'ok', text: t('payment.emailSent') });
      } else {
        setStripeActionMsg({ type: 'err', text: t('payment.emailNoAddress') });
      }
    } catch (err: any) {
      setStripeActionMsg({ type: 'err', text: err.message || t('payment.actionError') });
    } finally {
      setResendLoadingId(null);
    }
  };

  const handleRefund = async () => {
    const invoice = refundConfirm.invoice;
    if (!invoice?.id || !invoice.stripe_payment_intent_id || !currentTenant?.id) return;
    setRefundLoadingId(invoice.id);
    setRefundConfirm({ open: false, invoice: null });
    try {
      await paymentProvider.refundPayment({
        tenantId: currentTenant.id,
        paymentIntentId: invoice.stripe_payment_intent_id,
      });
      await invoiceService.updateStatus(invoice.id, 'pending');
      setStripeActionMsg({ type: 'ok', text: t('payment.actionSuccess') });
      await loadAll();
    } catch (err: any) {
      setStripeActionMsg({ type: 'err', text: err.message || t('payment.actionError') });
    } finally {
      setRefundLoadingId(null);
    }
  };

  const handleCancelSubscription = async () => {
    const invoice = cancelConfirm.invoice;
    if (!invoice?.id || !invoice.stripe_subscription_id || !currentTenant?.id) return;
    setCancelLoadingId(invoice.id);
    setCancelConfirm({ open: false, invoice: null });
    try {
      await paymentProvider.cancelSubscription({
        tenantId: currentTenant.id,
        subscriptionId: invoice.stripe_subscription_id,
      });
      setStripeActionMsg({ type: 'ok', text: t('payment.actionSuccess') });
      await loadAll();
    } catch (err: any) {
      setStripeActionMsg({ type: 'err', text: err.message || t('payment.actionError') });
    } finally {
      setCancelLoadingId(null);
    }
  };

  const filteredOrders = orderStatusFilter
    ? orders.filter(o => (o.status || 'pending') === orderStatusFilter)
    : orders;

  const billableBookings = bookings.filter(b => Number(b.cost || 0) > 0);
  const paidBookingsCount = bookings.filter(b => b.status === 'confirmed' && Number(b.cost || 0) > 0).length;
  const pendingBookingsCount = bookings.filter(b => b.status === 'pending' && Number(b.cost || 0) > 0).length;

  const TABS: { id: TabId; label: string }[] = [
    { id: 'summary', label: t('finance.tab.summary') },
    { id: 'transactions', label: t('finance.tab.transactions') },
    { id: 'fees', label: t('finance.tab.fees') },
    { id: 'store', label: t('finance.tab.store') },
    { id: 'facilities', label: t('finance.tab.facilities') },
  ];

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

      {/* Tab Bar */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-0 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ---- TAB: RESUMO ---- */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              label={t('finance.balance')}
              value={formatCurrency(balance)}
              subValue=""
              icon={Wallet}
              iconColor={balance >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}
            />
            <StatCard
              label={t('finance.totalRevenue')}
              value={formatCurrency(totalRevenue)}
              subValue=""
              icon={ArrowUpCircle}
              iconColor="bg-green-50 text-green-600"
            />
            <StatCard
              label={t('finance.expenses')}
              value={formatCurrency(transactionExpense)}
              subValue=""
              icon={ArrowDownCircle}
              iconColor="bg-red-50 text-red-600"
            />
            <StatCard
              label={t('finance.toReceive')}
              value={formatCurrency(toReceive)}
              subValue=""
              icon={CreditCard}
              iconColor="bg-amber-50 text-amber-600"
            />
            <StatCard
              label={t('finance.overdueAmount')}
              value={formatCurrency(feesOverdue)}
              subValue=""
              icon={CreditCard}
              iconColor="bg-rose-50 text-rose-600"
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-800 mb-6">{t('finance.revenueBySource')}</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueBySource} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(v)} width={90} />
                  <Tooltip formatter={(val) => formatCurrency(Number(val))} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {revenueBySource.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: LANÇAMENTOS ---- */}
      {activeTab === 'transactions' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="font-bold text-slate-800">{t('finance.recentTransactions')}</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeFiltersCount > 0 ? 'bg-primary/10 text-primary' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>{t('common.filters')}</span>
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
                {t('finance.newEntry')}
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-slate-700">{t('common.filters')}</span>
                {activeFiltersCount > 0 && (
                  <button
                    onClick={() => setFilters({ type: '', category: '', status: '' })}
                    className="text-xs text-primary font-medium flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> {t('common.clearFilters')}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {([
                  { label: t('common.type'), field: 'type' as const, options: [
                    { value: '', label: t('finance.allTypes') },
                    { value: 'income', label: t('finance.income') },
                    { value: 'expense', label: t('finance.expense') },
                  ]},
                  { label: t('athletes.category'), field: 'category' as const, options: [
                    { value: '', label: t('finance.allCategories') },
                    ...allCategories.map(c => ({ value: c, label: c })),
                  ]},
                  { label: t('common.status'), field: 'status' as const, options: [
                    { value: '', label: t('finance.allTypes') },
                    { value: 'pending', label: t('finance.status.pending') },
                    { value: 'reconciled', label: t('finance.status.reconciled') },
                  ]},
                ] as const).map(({ label, field, options }) => (
                  <div key={field}>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</label>
                    <div className="relative">
                      <select
                        value={filters[field]}
                        onChange={(e) => setFilters({ ...filters, [field]: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none pr-8"
                      >
                        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">{t('finance.col.description')}</th>
                  <th className="hidden sm:table-cell px-6 py-4">{t('athletes.category')}</th>
                  <th className="hidden md:table-cell px-6 py-4">{t('finance.col.date')}</th>
                  <th className="hidden lg:table-cell px-6 py-4">{t('common.status')}</th>
                  <th className="px-6 py-4 text-right">{t('finance.col.amount')}</th>
                  <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      {activeFiltersCount > 0 ? t('finance.noEntriesFiltered') : t('finance.noEntries')}
                    </td>
                  </tr>
                ) : filteredTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${tx.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {tx.type === 'income'
                            ? <ArrowUpCircle className="w-4 h-4" />
                            : <ArrowDownCircle className="w-4 h-4" />
                          }
                        </div>
                        <span className="text-sm font-semibold text-slate-800">{tx.description}</span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-6 py-4 text-sm text-slate-500">{tx.category}</td>
                    <td className="hidden md:table-cell px-6 py-4 text-sm text-slate-500">{formatDate(tx.date)}</td>
                    <td className="hidden lg:table-cell px-6 py-4">
                      <StatusBadge status={getTxStatusLabel(tx.status)} variant={getTxStatusVariant(tx.status)} />
                    </td>
                    <td className={`px-6 py-4 text-sm font-bold text-right ${tx.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                      {tx.type === 'expense' ? '−' : '+'} {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setTransactionModal({ isOpen: true, editingId: tx.id! })}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteModal({ isOpen: true, transaction: tx, loading: false })}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {transactions.length > 0 && (
            <div className="px-6 py-3 border-t border-slate-100 text-sm text-slate-500">
              {filteredTransactions.length !== transactions.length
                ? `${filteredTransactions.length} ${t('common.of')} ${transactions.length} ${t('finance.entries')}`
                : `${transactions.length} ${t('finance.entries')}`
              }
            </div>
          )}
        </div>
      )}

      {/* Stripe action feedback */}
      {stripeActionMsg && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${stripeActionMsg.type === 'ok' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {stripeActionMsg.text}
          <button onClick={() => setStripeActionMsg(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ---- TAB: MENSALIDADES ---- */}
      {activeTab === 'fees' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label={t('monthlyFees.totalExpected')}
              value={formatCurrency(monthlyFees.reduce((s, f) => s + Number(f.amount), 0))}
              subValue=""
              icon={CreditCard}
              iconColor="bg-blue-50 text-blue-600"
            />
            <StatCard
              label={t('monthlyFees.received')}
              value={formatCurrency(feesReceived)}
              subValue={`${monthlyFees.filter(f => f.status === 'paid').length} ${t('finance.paidCount')}`}
              icon={ArrowUpCircle}
              iconColor="bg-green-50 text-green-600"
            />
            <StatCard
              label={t('finance.status.pending')}
              value={formatCurrency(feesPending)}
              subValue={`${monthlyFees.filter(f => f.status === 'pending').length} ${t('finance.pendingCount')}`}
              icon={CreditCard}
              iconColor="bg-amber-50 text-amber-600"
            />
            <StatCard
              label={t('finance.status.overdue')}
              value={formatCurrency(feesOverdue)}
              subValue={`${monthlyFees.filter(f => f.status === 'overdue').length} ${t('monthlyFees.fees')}`}
              icon={CreditCard}
              iconColor="bg-red-50 text-red-600"
            />
          </div>

          <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-4 rounded-xl border border-primary/20 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800">{t('finance.monthlyFees')}</h3>
              <p className="text-sm text-slate-600 mt-0.5">
                {t('finance.viewMonthlyFees')} → gerenciamento completo com emissão de parcelas
              </p>
            </div>
            <button
              onClick={() => navigate('/monthly-fees')}
              className="px-4 py-2 bg-white text-primary font-semibold text-sm rounded-lg border border-primary/20 hover:bg-primary hover:text-white transition-colors"
            >
              {t('finance.viewMonthlyFees')}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">{t('common.athlete')}</th>
                    <th className="hidden md:table-cell px-6 py-4">{t('finance.col.description')}</th>
                    <th className="px-6 py-4">{t('finance.col.date')}</th>
                    <th className="px-6 py-4">{t('common.status')}</th>
                    <th className="px-6 py-4 text-right">{t('finance.col.amount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyFees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">{t('finance.noEntries')}</td>
                    </tr>
                  ) : monthlyFees.slice(0, 20).map(fee => (
                    <tr key={fee.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-slate-800">{fee.athlete?.full_name || '—'}</td>
                      <td className="hidden md:table-cell px-6 py-4 text-sm text-slate-500">
                        {fee.description || `Parcela #${fee.installment_number}`}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{formatDate(fee.due_date)}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={getTxStatusLabel(fee.status)} variant={getFeeStatusVariant(fee.status)} />
                      </td>
                      <td className={`px-6 py-4 text-sm font-bold text-right ${
                        fee.status === 'paid' ? 'text-green-600' : fee.status === 'overdue' ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        {formatCurrency(fee.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {monthlyFees.length > 20 && (
              <div className="px-6 py-3 border-t border-slate-100 text-center">
                <button
                  onClick={() => navigate('/monthly-fees')}
                  className="text-sm text-primary font-semibold hover:underline"
                >
                  {t('finance.viewMonthlyFees')} ({monthlyFees.length})
                </button>
              </div>
            )}
          </div>

          {/* Invoices / Stripe Charges section */}
          {invoices.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-violet-500" />
                <span className="font-semibold text-slate-800">Cobranças Stripe</span>
                {!stripeActive && (
                  <span className="ml-auto text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{t('payment.stripeNotActive')}</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                      <th className="px-6 py-3">{t('common.athlete')}</th>
                      <th className="hidden md:table-cell px-6 py-3">Plano</th>
                      <th className="px-6 py-3">{t('finance.col.date')}</th>
                      <th className="px-6 py-3">{t('common.status')}</th>
                      <th className="px-6 py-3 text-right">{t('finance.col.amount')}</th>
                      {stripeActive && <th className="px-6 py-3" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.slice(0, 20).map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-semibold text-slate-800">{inv.athlete?.full_name || '—'}</td>
                        <td className="hidden md:table-cell px-6 py-4 text-sm text-slate-500">{inv.school_plan?.name || inv.description || '—'}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{formatDate(inv.due_date)}</td>
                        <td className="px-6 py-4">
                          <StatusBadge
                            status={getTxStatusLabel(inv.status)}
                            variant={getFeeStatusVariant(inv.status)}
                          />
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-right">{formatCurrency(inv.amount)}</td>
                        {stripeActive && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {(inv.status === 'pending' || inv.status === 'overdue') && (
                                <>
                                  <button
                                    onClick={() => handleChargeViaStripe(inv)}
                                    disabled={checkoutLoadingId === inv.id}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60 transition"
                                  >
                                    {checkoutLoadingId === inv.id
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : <CreditCard className="w-3.5 h-3.5" />}
                                    {checkoutLoadingId === inv.id ? t('payment.checkoutLoading') : t('payment.chargeViaStripe')}
                                  </button>
                                  <button
                                    onClick={() => handleCopyPayLink(inv)}
                                    title={t('payment.copyLink')}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
                                  >
                                    {copiedId === inv.id ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                                  </button>
                                  <button
                                    onClick={() => handleResendInvoiceEmail(inv)}
                                    disabled={resendLoadingId === inv.id}
                                    title={t('payment.resendEmail')}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-60 transition"
                                  >
                                    {resendLoadingId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                                  </button>
                                </>
                              )}
                              {inv.status === 'paid' && inv.stripe_payment_intent_id && (
                                <button
                                  onClick={() => setRefundConfirm({ open: true, invoice: inv })}
                                  disabled={refundLoadingId === inv.id}
                                  className="flex items-center gap-1 px-2.5 py-1 text-xs bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 disabled:opacity-60 transition"
                                >
                                  {refundLoadingId === inv.id
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <RefreshCcw className="w-3.5 h-3.5" />}
                                  {t('payment.refund')}
                                </button>
                              )}
                              {inv.stripe_subscription_id && inv.status !== 'cancelled' && (
                                <button
                                  onClick={() => setCancelConfirm({ open: true, invoice: inv })}
                                  disabled={cancelLoadingId === inv.id}
                                  className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-60 transition"
                                >
                                  {cancelLoadingId === inv.id
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <X className="w-3.5 h-3.5" />}
                                  {t('payment.cancelSub')}
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- TAB: LOJA ---- */}
      {activeTab === 'store' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label={t('finance.storeRevenue')}
              value={formatCurrency(storeRevenue)}
              subValue={`${orders.filter(o => o.status === 'delivered').length} ${t('store.tab.orders').toLowerCase()}`}
              icon={ShoppingBag}
              iconColor="bg-amber-50 text-amber-600"
            />
            <StatCard
              label={t('finance.pipeline')}
              value={formatCurrency(storePipeline)}
              subValue={`${orders.filter(o => ['pending', 'confirmed', 'shipped'].includes(o.status || '')).length} pedidos`}
              icon={ShoppingBag}
              iconColor="bg-blue-50 text-blue-600"
            />
            <StatCard
              label={t('finance.otherRevenue')}
              value={String(orders.length)}
              subValue={`${orders.filter(o => o.status === 'cancelled').length} cancelados`}
              icon={ShoppingBag}
              iconColor="bg-slate-50 text-slate-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setOrderStatusFilter('')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                orderStatusFilter === '' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('finance.allTypes')}
            </button>
            {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setOrderStatusFilter(value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  orderStatusFilter === value ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">{t('finance.buyer')}</th>
                    <th className="hidden md:table-cell px-6 py-4">{t('finance.items')}</th>
                    <th className="hidden md:table-cell px-6 py-4">{t('finance.col.date')}</th>
                    <th className="px-6 py-4">{t('common.status')}</th>
                    <th className="px-6 py-4 text-right">{t('finance.col.amount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">{t('finance.noOrders')}</td>
                    </tr>
                  ) : filteredOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-slate-800">{order.buyer_name}</p>
                        {order.buyer_email && <p className="text-xs text-slate-400">{order.buyer_email}</p>}
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 text-sm text-slate-500">
                        {order.items?.length ?? 0} {t('finance.items').toLowerCase()}
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 text-sm text-slate-500">
                        {order.created_at ? formatDate(order.created_at) : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge
                          status={ORDER_STATUS_LABELS[order.status || 'pending']}
                          variant={ORDER_STATUS_VARIANT[order.status || 'pending'] ?? 'warning'}
                        />
                      </td>
                      <td className={`px-6 py-4 text-sm font-bold text-right ${
                        order.status === 'delivered' ? 'text-green-600' : 'text-slate-700'
                      }`}>
                        {formatCurrency(Number(order.total_amount || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: INSTALAÇÕES ---- */}
      {activeTab === 'facilities' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label={t('finance.facilityRevenue')}
              value={formatCurrency(facilityRevenue)}
              subValue={`${paidBookingsCount} reservas confirmadas`}
              icon={Building2}
              iconColor="bg-blue-50 text-blue-600"
            />
            <StatCard
              label={t('finance.toReceive')}
              value={formatCurrency(facilityPending)}
              subValue={`${pendingBookingsCount} pendentes`}
              icon={Building2}
              iconColor="bg-amber-50 text-amber-600"
            />
            <StatCard
              label={t('finance.otherRevenue')}
              value={String(billableBookings.length)}
              subValue="reservas com custo"
              icon={Building2}
              iconColor="bg-slate-50 text-slate-500"
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">{t('facility.booking.newTitle').replace('Nova ', '')}</th>
                    <th className="hidden md:table-cell px-6 py-4">{t('finance.buyer')}</th>
                    <th className="hidden md:table-cell px-6 py-4">{t('finance.col.date')}</th>
                    <th className="px-6 py-4">{t('common.status')}</th>
                    <th className="px-6 py-4 text-right">{t('facility.cost')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {billableBookings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">{t('finance.noPaidBookings')}</td>
                    </tr>
                  ) : billableBookings.map(booking => (
                    <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-slate-800">{booking.title}</p>
                        {booking.facility?.name && (
                          <p className="text-xs text-slate-400">{booking.facility.name}</p>
                        )}
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 text-sm text-slate-500">
                        {booking.booked_by || '—'}
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 text-sm text-slate-500">
                        {formatDate(booking.start_at)}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge
                          status={BOOKING_STATUS_LABELS[booking.status || 'pending']}
                          variant={BOOKING_STATUS_VARIANT[booking.status || 'pending'] ?? 'warning'}
                        />
                      </td>
                      <td className={`px-6 py-4 text-sm font-bold text-right ${
                        booking.status === 'confirmed' ? 'text-green-600' : 'text-amber-600'
                      }`}>
                        {formatCurrency(Number(booking.cost || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, transaction: null, loading: false })}
        onConfirm={handleDeleteTransaction}
        title={t('finance.deleteTransaction')}
        message={`${t('finance.deleteConfirm')} "${deleteModal.transaction?.description}"? ${t('finance.deleteWarning')}`}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        isDestructive={true}
        loading={deleteModal.loading}
      />
      <TransactionModal
        isOpen={transactionModal.isOpen}
        onClose={() => setTransactionModal({ isOpen: false, editingId: null })}
        onSaved={loadAll}
        transactionId={transactionModal.editingId}
      />

      <ConfirmModal
        isOpen={refundConfirm.open}
        onClose={() => setRefundConfirm({ open: false, invoice: null })}
        onConfirm={handleRefund}
        title={t('payment.refund')}
        message={`${t('payment.refundConfirm')} ${formatCurrency(refundConfirm.invoice?.amount || 0)}?`}
        confirmLabel={t('payment.refund')}
        cancelLabel={t('common.cancel')}
        isDestructive={false}
        loading={refundLoadingId === refundConfirm.invoice?.id}
      />

      <ConfirmModal
        isOpen={cancelConfirm.open}
        onClose={() => setCancelConfirm({ open: false, invoice: null })}
        onConfirm={handleCancelSubscription}
        title={t('payment.cancelSub')}
        message={t('payment.cancelSubConfirm')}
        confirmLabel={t('payment.cancelSub')}
        cancelLabel={t('common.cancel')}
        isDestructive={true}
        loading={cancelLoadingId === cancelConfirm.invoice?.id}
      />
    </div>
  );
};

export default Finance;
