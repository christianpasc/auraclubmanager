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
import { getPaymentProvider, resolvePaymentProviderId } from '../services/payment';
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

interface DateFilters {
  search: string;
  startDate: string;
  endDate: string;
  month: string;
  year: string;
}
const emptyDateFilters: DateFilters = { search: '', startDate: '', endDate: '', month: '', year: '' };
const currentMonthDateFilters = (): DateFilters => {
  const now = new Date();
  return { search: '', startDate: '', endDate: '', month: String(now.getMonth() + 1), year: String(now.getFullYear()) };
};

const matchesDateRange = (dateStr: string | null | undefined, f: DateFilters): boolean => {
  if (!f.startDate && !f.endDate && !f.month && !f.year) return true;
  if (!dateStr) return false;
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  if (f.startDate && d < new Date(f.startDate + 'T00:00:00')) return false;
  if (f.endDate && d > new Date(f.endDate + 'T23:59:59')) return false;
  if (f.month && (d.getMonth() + 1) !== Number(f.month)) return false;
  if (f.year && d.getFullYear() !== Number(f.year)) return false;
  return true;
};

const matchesSearchText = (text: string | null | undefined, search: string): boolean => {
  if (!search.trim()) return true;
  return (text || '').toLowerCase().includes(search.trim().toLowerCase());
};

const collectYears = (dateLists: (string | null | undefined)[][]): number[] => {
  const years = new Set<number>();
  dateLists.forEach(list => list.forEach(d => {
    if (d) years.add(new Date(d.includes('T') ? d : d + 'T00:00:00').getFullYear());
  }));
  years.add(new Date().getFullYear());
  return Array.from(years).sort((a, b) => b - a);
};

interface FinanceFilterBarProps {
  value: DateFilters;
  onChange: (next: DateFilters) => void;
  searchPlaceholder: string;
  years: number[];
}
const FinanceFilterBar: React.FC<FinanceFilterBarProps> = ({ value, onChange, searchPlaceholder, years }) => {
  const { t, language } = useLanguage();
  const monthNames = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(language, { month: 'long' }));
  const activeCount = [value.search, value.startDate, value.endDate, value.month, value.year].filter(Boolean).length;
  const inputClass = 'px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none';
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <label className="block text-xs font-semibold text-slate-500 mb-1">{t('common.search')}</label>
        <input
          value={value.search}
          onChange={e => onChange({ ...value, search: e.target.value })}
          placeholder={searchPlaceholder}
          className={`w-full ${inputClass}`}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">{t('finance.filter.startDate')}</label>
        <input type="date" value={value.startDate} onChange={e => onChange({ ...value, startDate: e.target.value })} className={inputClass} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">{t('finance.filter.endDate')}</label>
        <input type="date" value={value.endDate} onChange={e => onChange({ ...value, endDate: e.target.value })} className={inputClass} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">{t('finance.filter.month')}</label>
        <select value={value.month} onChange={e => onChange({ ...value, month: e.target.value })} className={inputClass}>
          <option value="">{t('finance.filter.allMonths')}</option>
          {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">{t('finance.filter.year')}</label>
        <select value={value.year} onChange={e => onChange({ ...value, year: e.target.value })} className={inputClass}>
          <option value="">{t('finance.filter.allYears')}</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {activeCount > 0 && (
        <button onClick={() => onChange(emptyDateFilters)}
          className="flex items-center gap-1 px-3 py-2 text-xs text-primary font-semibold hover:underline">
          <X className="w-3.5 h-3.5" /> {t('common.clearFilters')}
        </button>
      )}
    </div>
  );
};

const Finance: React.FC = () => {
  const navigate = useNavigate();
  const { t, language, formatCurrency } = useLanguage();
  const { currentTenant } = useTenant();

  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [feesView, setFeesView] = useState<'manual' | 'stripe'>('manual');
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

  // Which online payment rail this club uses, and whether it can charge members.
  const providerId = resolvePaymentProviderId(currentTenant as any);
  const isAsaas = providerId === 'asaas';
  const stripeActive = isAsaas
    ? !!currentTenant?.asaas_charges_enabled
    : !!(currentTenant?.stripe_connect_charges_enabled && currentTenant?.stripe_connect_payouts_enabled);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ type: '', category: '', status: '' });
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [summaryDateFilters, setSummaryDateFilters] = useState<DateFilters>(currentMonthDateFilters);
  const [txDateFilters, setTxDateFilters] = useState<DateFilters>(currentMonthDateFilters);
  const [feesDateFilters, setFeesDateFilters] = useState<DateFilters>(currentMonthDateFilters);
  const [storeDateFilters, setStoreDateFilters] = useState<DateFilters>(currentMonthDateFilters);
  const [facilitiesDateFilters, setFacilitiesDateFilters] = useState<DateFilters>(currentMonthDateFilters);
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

  // ---- Filters: shared years list + per-tab filtered datasets ----
  const allYears = collectYears([
    transactions.map(tx => tx.date),
    monthlyFees.map(f => f.due_date),
    invoices.map(i => i.due_date),
    orders.map(o => o.created_at),
    bookings.map(b => b.start_at),
  ]);

  // Resumo tab: filters all underlying datasets and recomputes the dashboard totals
  const summaryTransactions = transactions.filter(tx => matchesSearchText(tx.description, summaryDateFilters.search) && matchesDateRange(tx.date, summaryDateFilters));
  const summaryMonthlyFees = monthlyFees.filter(f => matchesSearchText(f.athlete?.full_name, summaryDateFilters.search) && matchesDateRange(f.due_date, summaryDateFilters));
  const summaryInvoices = invoices.filter(i => matchesSearchText(i.athlete?.full_name, summaryDateFilters.search) && matchesDateRange(i.due_date, summaryDateFilters));
  const summaryOrders = orders.filter(o => (matchesSearchText(o.buyer_name, summaryDateFilters.search) || matchesSearchText(o.buyer_email, summaryDateFilters.search)) && matchesDateRange(o.created_at, summaryDateFilters));
  const summaryBookings = bookings.filter(b => (matchesSearchText(b.title, summaryDateFilters.search) || matchesSearchText(b.booked_by, summaryDateFilters.search)) && matchesDateRange(b.start_at, summaryDateFilters));

  const summaryTxIncome = summaryTransactions.filter(tx => tx.type === 'income').reduce((s, tx) => s + Number(tx.amount), 0);
  const summaryTxExpense = summaryTransactions.filter(tx => tx.type === 'expense').reduce((s, tx) => s + Number(tx.amount), 0);
  const summaryFeesReceived = summaryMonthlyFees.filter(f => f.status === 'paid').reduce((s, f) => s + Number(f.amount), 0)
    + summaryInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
  const summaryFeesPending = summaryMonthlyFees.filter(f => f.status === 'pending').reduce((s, f) => s + Number(f.amount), 0)
    + summaryInvoices.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0);
  const summaryFeesOverdue = summaryMonthlyFees.filter(f => f.status === 'overdue').reduce((s, f) => s + Number(f.amount), 0)
    + summaryInvoices.filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.amount), 0);
  const summaryStoreRevenue = summaryOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const summaryStorePipeline = summaryOrders.filter(o => ['pending', 'confirmed', 'shipped'].includes(o.status || '')).reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const summaryFacilityRevenue = summaryBookings.filter(b => b.status === 'confirmed' && Number(b.cost || 0) > 0).reduce((s, b) => s + Number(b.cost || 0), 0);
  const summaryFacilityPending = summaryBookings.filter(b => b.status === 'pending' && Number(b.cost || 0) > 0).reduce((s, b) => s + Number(b.cost || 0), 0);
  const summaryTotalRevenue = summaryTxIncome + summaryFeesReceived + summaryStoreRevenue + summaryFacilityRevenue;
  const summaryBalance = summaryTotalRevenue - summaryTxExpense;
  const summaryToReceive = summaryFeesPending + summaryStorePipeline + summaryFacilityPending;
  const summaryRevenueBySource = [
    { name: t('finance.tab.transactions'), value: summaryTxIncome, color: '#6366f1' },
    { name: t('finance.tab.fees'), value: summaryFeesReceived, color: '#10b981' },
    { name: t('finance.tab.store'), value: summaryStoreRevenue, color: '#f59e0b' },
    { name: t('finance.tab.facilities'), value: summaryFacilityRevenue, color: '#3b82f6' },
  ];

  // Mensalidades tab: filters monthly fees / Stripe invoices independently of the global totals above
  const feesTabMonthlyFees = monthlyFees.filter(f => matchesSearchText(f.athlete?.full_name, feesDateFilters.search) && matchesDateRange(f.due_date, feesDateFilters));
  const feesTabInvoices = invoices.filter(i => matchesSearchText(i.athlete?.full_name, feesDateFilters.search) && matchesDateRange(i.due_date, feesDateFilters));
  const feesTabReceived = feesTabMonthlyFees.filter(f => f.status === 'paid').reduce((s, f) => s + Number(f.amount), 0)
    + feesTabInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
  const feesTabPending = feesTabMonthlyFees.filter(f => f.status === 'pending').reduce((s, f) => s + Number(f.amount), 0)
    + feesTabInvoices.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0);
  const feesTabOverdue = feesTabMonthlyFees.filter(f => f.status === 'overdue').reduce((s, f) => s + Number(f.amount), 0)
    + feesTabInvoices.filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.amount), 0);
  const feesTabPaidCount = feesTabMonthlyFees.filter(f => f.status === 'paid').length + feesTabInvoices.filter(i => i.status === 'paid').length;
  const feesTabPendingCount = feesTabMonthlyFees.filter(f => f.status === 'pending').length + feesTabInvoices.filter(i => i.status === 'pending').length;
  const feesTabOverdueCount = feesTabMonthlyFees.filter(f => f.status === 'overdue').length + feesTabInvoices.filter(i => i.status === 'overdue').length;
  const feesTabTotalExpected = feesTabMonthlyFees.reduce((s, f) => s + Number(f.amount), 0)
    + feesTabInvoices.filter(i => i.status !== 'cancelled').reduce((s, i) => s + Number(i.amount), 0);

  // Loja tab: status pills + search/date
  const filteredOrders = orders.filter(o => {
    const matchesStatus = !orderStatusFilter || (o.status || 'pending') === orderStatusFilter;
    const matchesSearch = matchesSearchText(o.buyer_name, storeDateFilters.search) || matchesSearchText(o.buyer_email, storeDateFilters.search);
    const matchesDate = matchesDateRange(o.created_at, storeDateFilters);
    return matchesStatus && matchesSearch && matchesDate;
  });
  const storeTabRevenue = filteredOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const storeTabPipeline = filteredOrders.filter(o => ['pending', 'confirmed', 'shipped'].includes(o.status || '')).reduce((s, o) => s + Number(o.total_amount || 0), 0);

  // Instalações tab: search/date over billable bookings
  const filteredBookings = bookings.filter(b => Number(b.cost || 0) > 0
    && (matchesSearchText(b.title, facilitiesDateFilters.search) || matchesSearchText(b.booked_by, facilitiesDateFilters.search))
    && matchesDateRange(b.start_at, facilitiesDateFilters));
  const facilityTabRevenue = filteredBookings.filter(b => b.status === 'confirmed').reduce((s, b) => s + Number(b.cost || 0), 0);
  const facilityTabPending = filteredBookings.filter(b => b.status === 'pending').reduce((s, b) => s + Number(b.cost || 0), 0);

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
    const matchesSearch = matchesSearchText(tx.description, txDateFilters.search);
    const matchesDate = matchesDateRange(tx.date, txDateFilters);
    return matchesType && matchesCategory && matchesStatus && matchesSearch && matchesDate;
  });
  const activeFiltersCount = [filters.type, filters.category, filters.status].filter(Boolean).length;
  const anyTxFilterActive = activeFiltersCount > 0
    || !!(txDateFilters.search || txDateFilters.startDate || txDateFilters.endDate || txDateFilters.month || txDateFilters.year);

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
      const result = await getPaymentProvider(currentTenant as any).createCheckoutSession({
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
    // Asaas exposes its own hosted invoice page; Stripe uses our /pay page.
    const payUrl = invoice.asaas_invoice_url || `${window.location.origin}/#/pay/${invoice.id}`;
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
    const paymentId = isAsaas ? invoice?.asaas_payment_id : invoice?.stripe_payment_intent_id;
    if (!invoice?.id || !paymentId || !currentTenant?.id) return;
    setRefundLoadingId(invoice.id);
    setRefundConfirm({ open: false, invoice: null });
    try {
      await getPaymentProvider(currentTenant as any).refundPayment({
        tenantId: currentTenant.id,
        paymentIntentId: paymentId,
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
    const subscriptionId = isAsaas ? invoice?.asaas_subscription_id : invoice?.stripe_subscription_id;
    if (!invoice?.id || !subscriptionId || !currentTenant?.id) return;
    setCancelLoadingId(invoice.id);
    setCancelConfirm({ open: false, invoice: null });
    try {
      await getPaymentProvider(currentTenant as any).cancelSubscription({
        tenantId: currentTenant.id,
        subscriptionId: subscriptionId,
      });
      setStripeActionMsg({ type: 'ok', text: t('payment.actionSuccess') });
      await loadAll();
    } catch (err: any) {
      setStripeActionMsg({ type: 'err', text: err.message || t('payment.actionError') });
    } finally {
      setCancelLoadingId(null);
    }
  };


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
          <FinanceFilterBar
            value={summaryDateFilters}
            onChange={setSummaryDateFilters}
            searchPlaceholder={t('finance.filter.searchSummary')}
            years={allYears}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              label={t('finance.balance')}
              value={formatCurrency(summaryBalance)}
              subValue=""
              icon={Wallet}
              iconColor={summaryBalance >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}
            />
            <StatCard
              label={t('finance.totalRevenue')}
              value={formatCurrency(summaryTotalRevenue)}
              subValue=""
              icon={ArrowUpCircle}
              iconColor="bg-green-50 text-green-600"
            />
            <StatCard
              label={t('finance.expenses')}
              value={formatCurrency(summaryTxExpense)}
              subValue=""
              icon={ArrowDownCircle}
              iconColor="bg-red-50 text-red-600"
            />
            <StatCard
              label={t('finance.toReceive')}
              value={formatCurrency(summaryToReceive)}
              subValue=""
              icon={CreditCard}
              iconColor="bg-amber-50 text-amber-600"
            />
            <StatCard
              label={t('finance.overdueAmount')}
              value={formatCurrency(summaryFeesOverdue)}
              subValue=""
              icon={CreditCard}
              iconColor="bg-rose-50 text-rose-600"
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-800 mb-6">{t('finance.revenueBySource')}</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summaryRevenueBySource} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(v)} width={90} />
                  <Tooltip formatter={(val) => formatCurrency(Number(val))} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {summaryRevenueBySource.map((entry, i) => (
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
        <div className="space-y-4">
          <FinanceFilterBar
            value={txDateFilters}
            onChange={setTxDateFilters}
            searchPlaceholder={t('finance.filter.searchTransactions')}
            years={allYears}
          />
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
                      {anyTxFilterActive ? t('finance.noEntriesFiltered') : t('finance.noEntries')}
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
          <FinanceFilterBar
            value={feesDateFilters}
            onChange={setFeesDateFilters}
            searchPlaceholder={t('finance.filter.searchFees')}
            years={allYears}
          />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label={t('monthlyFees.totalExpected')}
              value={formatCurrency(feesTabTotalExpected)}
              subValue=""
              icon={CreditCard}
              iconColor="bg-blue-50 text-blue-600"
            />
            <StatCard
              label={t('monthlyFees.received')}
              value={formatCurrency(feesTabReceived)}
              subValue={`${feesTabPaidCount} ${t('finance.paidCount')}`}
              icon={ArrowUpCircle}
              iconColor="bg-green-50 text-green-600"
            />
            <StatCard
              label={t('finance.status.pending')}
              value={formatCurrency(feesTabPending)}
              subValue={`${feesTabPendingCount} ${t('finance.pendingCount')}`}
              icon={CreditCard}
              iconColor="bg-amber-50 text-amber-600"
            />
            <StatCard
              label={t('finance.status.overdue')}
              value={formatCurrency(feesTabOverdue)}
              subValue={`${feesTabOverdueCount} ${t('monthlyFees.fees')}`}
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

          {/* Manual vs Stripe sub-tabs */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setFeesView('manual')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-all relative ${feesView === 'manual' ? 'text-primary' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Building2 className="w-4 h-4" /> {t('finance.manualPayments')} ({feesTabMonthlyFees.length})
              {feesView === 'manual' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />}
            </button>
            <button
              onClick={() => setFeesView('stripe')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-all relative ${feesView === 'stripe' ? 'text-primary' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <CreditCard className="w-4 h-4" /> {isAsaas ? 'Pagamentos Asaas' : t('finance.stripePayments')} ({feesTabInvoices.length})
              {feesView === 'stripe' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />}
            </button>
          </div>

          {feesView === 'manual' && (
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
                  {feesTabMonthlyFees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">{t('finance.noEntries')}</td>
                    </tr>
                  ) : feesTabMonthlyFees.slice(0, 20).map(fee => (
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
            {feesTabMonthlyFees.length > 20 && (
              <div className="px-6 py-3 border-t border-slate-100 text-center">
                <button
                  onClick={() => navigate('/monthly-fees')}
                  className="text-sm text-primary font-semibold hover:underline"
                >
                  {t('finance.viewMonthlyFees')} ({feesTabMonthlyFees.length})
                </button>
              </div>
            )}
          </div>
          )}

          {/* Invoices / Stripe Charges section */}
          {feesView === 'stripe' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {!stripeActive && (
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    {isAsaas ? 'Conta de recebimento do clube ainda não está ativa.' : t('payment.stripeNotActive')}
                  </span>
                </div>
              )}
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
                    {feesTabInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={stripeActive ? 6 : 5} className="px-6 py-12 text-center text-slate-400">{t('finance.noEntries')}</td>
                      </tr>
                    ) : feesTabInvoices.slice(0, 20).map(inv => (
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
                                    {checkoutLoadingId === inv.id ? t('payment.checkoutLoading') : (isAsaas ? 'Cobrar via Asaas' : t('payment.chargeViaStripe'))}
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
                              {inv.status === 'paid' && (isAsaas ? inv.asaas_payment_id : inv.stripe_payment_intent_id) && (
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
                              {(isAsaas ? inv.asaas_subscription_id : inv.stripe_subscription_id) && inv.status !== 'cancelled' && (
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
          <FinanceFilterBar
            value={storeDateFilters}
            onChange={setStoreDateFilters}
            searchPlaceholder={t('finance.filter.searchStore')}
            years={allYears}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label={t('finance.storeRevenue')}
              value={formatCurrency(storeTabRevenue)}
              subValue={`${filteredOrders.filter(o => o.status === 'delivered').length} ${t('store.tab.orders').toLowerCase()}`}
              icon={ShoppingBag}
              iconColor="bg-amber-50 text-amber-600"
            />
            <StatCard
              label={t('finance.pipeline')}
              value={formatCurrency(storeTabPipeline)}
              subValue={`${filteredOrders.filter(o => ['pending', 'confirmed', 'shipped'].includes(o.status || '')).length} pedidos`}
              icon={ShoppingBag}
              iconColor="bg-blue-50 text-blue-600"
            />
            <StatCard
              label={t('finance.otherRevenue')}
              value={String(filteredOrders.length)}
              subValue={`${filteredOrders.filter(o => o.status === 'cancelled').length} cancelados`}
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
          <FinanceFilterBar
            value={facilitiesDateFilters}
            onChange={setFacilitiesDateFilters}
            searchPlaceholder={t('finance.filter.searchFacilities')}
            years={allYears}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label={t('finance.facilityRevenue')}
              value={formatCurrency(facilityTabRevenue)}
              subValue={`${filteredBookings.filter(b => b.status === 'confirmed').length} reservas confirmadas`}
              icon={Building2}
              iconColor="bg-blue-50 text-blue-600"
            />
            <StatCard
              label={t('finance.toReceive')}
              value={formatCurrency(facilityTabPending)}
              subValue={`${filteredBookings.filter(b => b.status === 'pending').length} pendentes`}
              icon={Building2}
              iconColor="bg-amber-50 text-amber-600"
            />
            <StatCard
              label={t('finance.otherRevenue')}
              value={String(filteredBookings.length)}
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
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">{t('finance.noPaidBookings')}</td>
                    </tr>
                  ) : filteredBookings.map(booking => (
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
