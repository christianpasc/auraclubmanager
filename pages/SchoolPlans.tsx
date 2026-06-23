import React, { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, Loader2, RefreshCw, Check, X, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTenant } from '../contexts/TenantContext';
import { schoolPlanService, SchoolPlan } from '../services/schoolPlanService';
import { paymentProvider } from '../services/payment';
import ConfirmModal from '../components/ConfirmModal';

const INTERVALS = ['monthly', 'quarterly', 'semiannual', 'annual', 'one_time'] as const;
const CURRENCIES = ['EUR', 'GBP', 'USD', 'BRL', 'CAD', 'AUD', 'CHF', 'MXN'];

const EMPTY: Omit<SchoolPlan, 'id' | 'tenant_id' | 'created_at' | 'updated_at'> = {
  name: '',
  description: '',
  interval: 'monthly',
  amount: 0,
  currency: 'EUR',
  is_active: true,
};

const SchoolPlans: React.FC = () => {
  const { t, formatCurrency } = useLanguage();
  const { currentTenant } = useTenant();

  const intervalLabel = (interval: string): string => {
    const key = interval === 'one_time' ? 'planType.oneTime' : `planType.${interval}`;
    return t(key);
  };

  const [plans, setPlans] = useState<SchoolPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; plan: SchoolPlan | null }>({ open: false, plan: null });
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<{ id: string; type: 'ok' | 'err'; text: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; plan: SchoolPlan | null; loading: boolean }>({ open: false, plan: null, loading: false });
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const stripeActive = !!(currentTenant?.stripe_connect_charges_enabled && currentTenant?.stripe_connect_payouts_enabled);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      setPlans(await schoolPlanService.getAll());
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setForm({ ...EMPTY, currency: currentTenant?.stripe_connect_currency || 'EUR' });
    setModal({ open: true, plan: null });
  };

  const openEdit = (plan: SchoolPlan) => {
    setForm({
      name: plan.name,
      description: plan.description || '',
      interval: plan.interval,
      amount: plan.amount,
      currency: plan.currency || 'EUR',
      is_active: plan.is_active ?? true,
    });
    setModal({ open: true, plan });
  };

  const handleSave = async () => {
    if (!form.name.trim() || form.amount <= 0) return;
    setSaving(true);
    try {
      if (modal.plan?.id) {
        await schoolPlanService.update(modal.plan.id, form);
      } else {
        await schoolPlanService.create(form);
      }
      await load();
      setModal({ open: false, plan: null });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (plan: SchoolPlan) => {
    await schoolPlanService.toggleActive(plan.id!, !(plan.is_active));
    await load();
  };

  const handleSync = async (plan: SchoolPlan) => {
    if (!currentTenant?.id || !plan.id) return;
    setSyncingId(plan.id);
    setSyncMessage(null);
    try {
      await paymentProvider.syncPlan(plan.id, currentTenant.id);
      await load();
      setSyncMessage({ id: plan.id, type: 'ok', text: t('schoolPlans.syncSuccess') });
    } catch (err: any) {
      setSyncMessage({ id: plan.id, type: 'err', text: err.message || t('schoolPlans.syncError') });
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.plan?.id) return;
    setDeleteModal(d => ({ ...d, loading: true }));
    try {
      await schoolPlanService.delete(deleteModal.plan!.id!);
      await load();
      setDeleteModal({ open: false, plan: null, loading: false });
    } catch {
      setDeleteModal(d => ({ ...d, loading: false }));
    }
  };

  const hasSyncId = (plan: SchoolPlan) =>
    !!(plan.stripe_product_id || plan.stripe_live_product_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('schoolPlans.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('schoolPlans.subtitle')}</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition"
        >
          <Plus className="w-4 h-4" /> {t('schoolPlans.newPlan')}
        </button>
      </div>

      {!stripeActive && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          {t('payment.stripeNotActive')} — {t('settings.tab.payments')}
        </div>
      )}

      {actionMsg && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
          <Check className="w-4 h-4" /> {actionMsg}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16 text-slate-400">{t('schoolPlans.noPlans')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div key={plan.id} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">{plan.name}</h3>
                  {plan.description && <p className="text-xs text-slate-500 mt-0.5">{plan.description}</p>}
                </div>
                <button
                  onClick={() => handleToggle(plan)}
                  className={`flex-shrink-0 ${plan.is_active ? 'text-green-500' : 'text-slate-300'}`}
                  title={plan.is_active ? t('schoolPlans.active') : t('schoolPlans.inactive')}
                >
                  {plan.is_active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-600">
                <span className="font-bold text-slate-800">
                  {formatCurrency(Number(plan.amount))}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">
                  {intervalLabel(plan.interval)}
                </span>
                <span className="text-xs text-slate-400">{plan.currency || 'EUR'}</span>
              </div>

              {/* Stripe sync status */}
              {stripeActive && (
                <div className="flex items-center gap-2">
                  {hasSyncId(plan) ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                      <Check className="w-3.5 h-3.5" /> {t('schoolPlans.synced')}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600">{t('schoolPlans.notSynced')}</span>
                  )}
                </div>
              )}

              {syncMessage?.id === plan.id && (
                <p className={`text-xs ${syncMessage.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                  {syncMessage.text}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => openEdit(plan)}
                  className="p-1.5 text-slate-400 hover:text-primary transition"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {stripeActive && (
                  <button
                    onClick={() => handleSync(plan)}
                    disabled={syncingId === plan.id}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 disabled:opacity-60 transition"
                  >
                    {syncingId === plan.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <RefreshCw className="w-3.5 h-3.5" />}
                    {t('schoolPlans.syncStripe')}
                  </button>
                )}
                <button
                  onClick={() => setDeleteModal({ open: true, plan, loading: false })}
                  className="p-1.5 text-slate-400 hover:text-red-500 transition ml-auto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800">
                {modal.plan ? t('schoolPlans.title') : t('schoolPlans.newPlan')}
              </h2>
              <button onClick={() => setModal({ open: false, plan: null })} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('schoolPlans.name')} *</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={t('schoolPlans.namePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('schoolPlans.description')}</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('schoolPlans.amount')} *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{t('schoolPlans.currency')}</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={form.currency}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  >
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('schoolPlans.interval')}</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.interval}
                  onChange={e => setForm(f => ({ ...f, interval: e.target.value as SchoolPlan['interval'] }))}
                >
                  {INTERVALS.map(iv => (
                    <option key={iv} value={iv}>{intervalLabel(iv)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setModal({ open: false, plan: null })}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || form.amount <= 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, plan: null, loading: false })}
        onConfirm={handleDelete}
        title={t('schoolPlans.deleteConfirm')}
        message={deleteModal.plan?.name || ''}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        isDestructive
        loading={deleteModal.loading}
      />
    </div>
  );
};

export default SchoolPlans;
