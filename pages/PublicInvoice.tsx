import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CreditCard, Loader2, CheckCircle2, AlertTriangle, Receipt } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { paymentProvider } from '../services/payment';
import { asaasModeHeader } from '../lib/asaasConfig';
import { useLanguage } from '../contexts/LanguageContext';
import AsaasChargePanel, { AsaasChargeData } from '../components/AsaasChargePanel';

interface InvoiceInfo {
  invoice_id: string;
  payment_provider: 'asaas' | 'stripe';
  tenant_id: string;
  tenant_name: string;
  currency: string;
  athlete_name: string;
  description: string | null;
  amount: number;
  due_date: string;
  status: string;
}

const formatMoney = (amount: number, currency: string, language: string) => {
  try {
    return new Intl.NumberFormat(language, { style: 'currency', currency }).format(Number(amount));
  } catch {
    // Unknown currency code — never let formatting hide the amount.
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
};

const PublicInvoice: React.FC = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { t, language } = useLanguage();

  const [invoice, setInvoice] = useState<InvoiceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [charge, setCharge] = useState<AsaasChargeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState(false);
  const pollRef = useRef<number | null>(null);

  const loadInvoice = useCallback(async () => {
    const { data, error: fnError } = await supabase.functions.invoke('public-invoice-info', {
      body: { invoice_id: invoiceId },
    });
    if (fnError || !data || data.error) return null;
    return data as InvoiceInfo;
  }, [invoiceId]);

  // First load: fetch the invoice and, on the Asaas rail, prepare the charge
  // straight away so the QR code is on screen without an extra click.
  useEffect(() => {
    if (!invoiceId) { setNotFound(true); setLoading(false); return; }
    let cancelled = false;

    (async () => {
      const info = await loadInvoice();
      if (cancelled) return;
      if (!info) { setNotFound(true); setLoading(false); return; }

      setInvoice(info);
      setLoading(false);

      if (info.payment_provider === 'asaas' && info.status !== 'paid' && info.status !== 'cancelled') {
        setPayLoading(true);
        const { data, error: fnError } = await supabase.functions.invoke('public-invoice-pay', {
          body: { invoice_id: invoiceId },
          headers: asaasModeHeader(),
        });
        if (cancelled) return;
        if (fnError || !data || data.error) {
          setError(data?.error || t('publicInvoice.paymentError'));
        } else {
          setCharge(data as AsaasChargeData);
        }
        setPayLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [invoiceId, loadInvoice, t]);

  // While a PIX or boleto is open, watch for the webhook to settle it. The
  // invoices table is not readable anonymously, so this polls the same public
  // endpoint rather than subscribing to the row.
  useEffect(() => {
    if (!invoice || invoice.status === 'paid' || !charge) return;

    pollRef.current = window.setInterval(async () => {
      const fresh = await loadInvoice();
      if (fresh?.status === 'paid') {
        setInvoice(fresh);
        setJustPaid(true);
        if (pollRef.current) window.clearInterval(pollRef.current);
      }
    }, 5000);

    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [invoice, charge, loadInvoice]);

  // Stripe keeps its redirect to the hosted checkout.
  const handleStripePay = async () => {
    if (!invoice) return;
    setPayLoading(true);
    setError(null);
    try {
      const baseUrl = window.location.href.split('?')[0];
      const result = await paymentProvider.createCheckoutSession({
        mode: 'subscription',
        tenantId: invoice.tenant_id,
        invoiceId: invoice.invoice_id,
        successUrl: `${baseUrl}?paid=1`,
        cancelUrl: baseUrl,
      });
      window.location.href = result.url;
    } catch (err: any) {
      setError(err.message || t('publicInvoice.paymentError'));
      setPayLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (notFound || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center text-slate-400">
          <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t('publicInvoice.notFound')}</p>
        </div>
      </div>
    );
  }

  const isPaid = invoice.status === 'paid';
  const isAsaas = invoice.payment_provider === 'asaas';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-400 uppercase tracking-wide">{invoice.tenant_name}</p>
          <h1 className="text-xl font-bold text-slate-800 mt-1">{t('publicInvoice.title')}</h1>
        </div>

        <div className="bg-slate-50 rounded-xl border border-slate-100 p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">{t('common.athlete')}</span>
            <span className="font-semibold text-slate-800">{invoice.athlete_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">{t('publicInvoice.plan')}</span>
            <span className="font-semibold text-slate-800">{invoice.description || '—'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">{t('publicInvoice.dueDate')}</span>
            <span className="font-semibold text-slate-800">
              {new Date(invoice.due_date + 'T00:00:00').toLocaleDateString(language)}
            </span>
          </div>
          <div className="flex justify-between pt-3 border-t border-slate-200">
            <span className="text-sm font-bold text-slate-700">{t('publicInvoice.total')}</span>
            <span className="text-lg font-bold text-slate-800">
              {formatMoney(invoice.amount, invoice.currency, language)}
            </span>
          </div>
        </div>

        {isPaid ? (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-green-700">
              {justPaid ? t('publicInvoice.paidJustNow') : t('publicInvoice.alreadyPaid')}
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {isAsaas ? (
              payLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('publicInvoice.preparing')}
                </div>
              ) : charge ? (
                <AsaasChargePanel charge={charge} />
              ) : null
            ) : (
              <button
                onClick={handleStripePay}
                disabled={payLoading}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-60 transition"
              >
                {payLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                {t('publicInvoice.payNow')}
              </button>
            )}

            <p className="text-xs text-center text-slate-400">{t('publicInvoice.securePayment')}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default PublicInvoice;
