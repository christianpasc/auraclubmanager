import { supabase } from '../../lib/supabase';
import type {
  PaymentProvider,
  OnboardingLinkResult,
  SyncPlanResult,
  CheckoutResult,
  CheckoutParams,
  RefundResult,
} from './paymentProvider.types';

// Asaas provider (Brazil) — sibling of stripeConnectProvider behind the same
// PaymentProvider interface. Server-side work happens in asaas-* edge
// functions (root-account key and per-club subaccount keys never reach the
// client). Fase 1 ships the skeleton + routing only: operations that depend
// on later fases (subconta creation = Fase 3, member charges = Fase 4) throw
// a clear pt-BR message instead of half-working.

const invoke = async <T>(fn: string, body: object): Promise<T> => {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let msg = error.message || `Error calling ${fn}`;
    try {
      const errBody = await (error as any).context?.json?.();
      if (errBody?.error) msg = errBody.error;
    } catch {}
    throw new Error(msg);
  }
  return data as T;
};

const NOT_READY =
  'Esta operação não está disponível para contas Asaas.';

export const asaasProvider: PaymentProvider = {
  // Not used by the Asaas UI: the subaccount is created via the dedicated form
  // in Settings (asaas-create-subaccount), not this Stripe-style onboarding link.
  async createOnboardingLink(_tenantId, _returnUrl, _refreshUrl): Promise<OnboardingLinkResult> {
    throw new Error(NOT_READY);
  },

  // Not used: Asaas charges carry the value inline; no pre-synced price object.
  async syncPlan(_planId, _tenantId): Promise<SyncPlanResult> {
    throw new Error(NOT_READY);
  },

  // Fase 4: member charge (PIX/boleto/cartão) on the club's subaccount.
  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
    if (!params.invoiceId) throw new Error('Fatura não informada.');
    const data = await invoke<{ url: string; session_id: string }>('asaas-club-checkout', {
      tenant_id: params.tenantId,
      invoice_id: params.invoiceId,
    });
    if (!data?.url) throw new Error('URL de pagamento não retornada.');
    return data;
  },

  // Fase 4: paymentIntentId carries the Asaas payment id (interface is generic).
  async refundPayment(params): Promise<RefundResult> {
    return invoke<RefundResult>('asaas-club-refund', {
      tenant_id: params.tenantId,
      payment_id: params.paymentIntentId,
    });
  },

  // Fase 4: subscriptionId carries the Asaas subscription id.
  async cancelSubscription(params): Promise<void> {
    await invoke<void>('asaas-club-cancel-subscription', {
      tenant_id: params.tenantId,
      subscription_id: params.subscriptionId,
    });
  },
};

// Connectivity/config check against the Asaas root account (sandbox or
// production, per edge secrets). Used by the admin panel to confirm the
// integration is ready before enabling clubs.
export interface AsaasStatus {
  configured: boolean;
  env: 'sandbox' | 'production' | null;
  connected: boolean;
  error?: string;
}

export async function getAsaasStatus(): Promise<AsaasStatus> {
  return invoke<AsaasStatus>('asaas-status', {});
}
