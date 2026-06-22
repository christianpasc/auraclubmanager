import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CreditCard, Loader2, CheckCircle2, AlertTriangle, Receipt } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { paymentProvider } from '../services/payment';

interface InvoiceInfo {
  invoice_id: string;
  tenant_id: string;
  tenant_name: string;
  currency: string;
  athlete_name: string;
  description: string | null;
  amount: number;
  due_date: string;
  status: string;
}

const FMT = (n: number, currency: string) => `${currency} ${Number(n).toFixed(2)}`;

const PublicInvoice: React.FC = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();

  const [invoice, setInvoice] = useState<InvoiceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId) { setNotFound(true); setLoading(false); return; }
    (async () => {
      const { data, error: fnError } = await supabase.functions.invoke('public-invoice-info', {
        body: { invoice_id: invoiceId },
      });
      if (fnError || !data || data.error) { setNotFound(true); setLoading(false); return; }
      setInvoice(data as InvoiceInfo);
      setLoading(false);
    })();
  }, [invoiceId]);

  const handlePay = async () => {
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
      setError(err.message || 'Erro ao iniciar pagamento.');
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
          <p className="font-medium">Cobrança não encontrada</p>
        </div>
      </div>
    );
  }

  const isPaid = invoice.status === 'paid';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-400 uppercase tracking-wide">{invoice.tenant_name}</p>
          <h1 className="text-xl font-bold text-slate-800 mt-1">Cobrança de Mensalidade</h1>
        </div>

        <div className="bg-slate-50 rounded-xl border border-slate-100 p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Atleta</span>
            <span className="font-semibold text-slate-800">{invoice.athlete_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Plano</span>
            <span className="font-semibold text-slate-800">{invoice.description || '—'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Vencimento</span>
            <span className="font-semibold text-slate-800">{new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
          </div>
          <div className="flex justify-between pt-3 border-t border-slate-200">
            <span className="text-sm font-bold text-slate-700">Total</span>
            <span className="text-lg font-bold text-slate-800">{FMT(invoice.amount, invoice.currency)}</span>
          </div>
        </div>

        {isPaid ? (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-green-700">Esta cobrança já foi paga. Obrigado!</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <button
              onClick={handlePay}
              disabled={payLoading}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-60 transition"
            >
              {payLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
              Pagar agora
            </button>
            <p className="text-xs text-center text-slate-400">Pagamento seguro processado pela Stripe.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default PublicInvoice;
