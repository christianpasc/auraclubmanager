import React, { useState } from 'react';
import { Copy, Check, QrCode, Barcode, CreditCard, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

// What an Asaas charge exposes to the payer. Both checkouts — the club paying
// its Aura plan and a parent paying a fee — render the same thing, so the
// panel lives here instead of being written twice.
export interface AsaasChargeData {
  url: string;
  pix?: { qr_base64: string; payload: string; expires_at?: string | null };
  boleto?: { line: string; barcode?: string | null };
}

// PIX payloads and boleto lines are long strings nobody retypes, so the copy
// button is the real control; the text below it is just confirmation.
const CopyField: React.FC<{ value: string; label: string; copiedLabel: string; mono?: boolean }> = ({
  value, label, copiedLabel, mono,
}) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Older browsers and insecure contexts have no clipboard API.
      const el = document.createElement('textarea');
      el.value = value;
      document.body.appendChild(el);
      el.select();
      try { document.execCommand('copy'); } catch { /* nothing else to try */ }
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      <p className={`text-xs text-slate-500 break-all ${mono ? 'font-mono' : ''}`}>{value}</p>
      <button
        type="button"
        onClick={copy}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
      >
        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
        {copied ? copiedLabel : label}
      </button>
    </div>
  );
};

interface Props {
  charge: AsaasChargeData;
  /** Shows the "waiting for payment" line while something is polling for it. */
  watching?: boolean;
}

const AsaasChargePanel: React.FC<Props> = ({ charge, watching = true }) => {
  const { t } = useLanguage();

  return (
    <div className="space-y-5">
      {charge.pix && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-700">{t('publicInvoice.pixTitle')}</h2>
          </div>
          <p className="text-xs text-slate-500">{t('publicInvoice.pixInstructions')}</p>
          <div className="flex justify-center p-4 bg-white border border-slate-200 rounded-xl">
            <img
              src={`data:image/png;base64,${charge.pix.qr_base64}`}
              alt={t('publicInvoice.pixTitle')}
              className="w-48 h-48 max-w-full"
            />
          </div>
          <CopyField
            value={charge.pix.payload}
            label={t('publicInvoice.pixCopy')}
            copiedLabel={t('publicInvoice.copied')}
          />
        </div>
      )}

      {charge.boleto && (
        <div className="space-y-3 pt-5 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Barcode className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-700">{t('publicInvoice.boletoTitle')}</h2>
          </div>
          <CopyField
            value={charge.boleto.line}
            label={t('publicInvoice.boletoCopy')}
            copiedLabel={t('publicInvoice.copied')}
            mono
          />
        </div>
      )}

      {/* Card deliberately stays on the Asaas-hosted invoice: no card data ever
          touches our pages, which keeps us out of PCI scope. */}
      <a
        href={charge.url}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition"
      >
        <CreditCard className="w-5 h-5" />
        {t('publicInvoice.otherMethods')}
      </a>

      {watching && (charge.pix || charge.boleto) && (
        <p className="flex items-center justify-center gap-2 text-xs text-slate-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          {t('publicInvoice.waitingPayment')}
        </p>
      )}
    </div>
  );
};

export default AsaasChargePanel;
