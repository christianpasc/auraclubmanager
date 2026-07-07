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
  'Pagamentos via Asaas ainda não estão habilitados nesta etapa. Em breve sua escolinha poderá cobrar por PIX, boleto e cartão.';

export const asaasProvider: PaymentProvider = {
  // Fase 3: creates the club's Asaas subaccount (POST /v3/accounts) and stores
  // id + encrypted apiKey + walletId. Until then, fail loudly and clearly.
  async createOnboardingLink(_tenantId, _returnUrl, _refreshUrl): Promise<OnboardingLinkResult> {
    throw new Error(NOT_READY);
  },

  // Fase 4: maps a school_plan onto an Asaas recurring charge template.
  async syncPlan(_planId, _tenantId): Promise<SyncPlanResult> {
    throw new Error(NOT_READY);
  },

  // Fase 4: member charges (PIX/boleto/cartão) on the club's subaccount.
  async createCheckoutSession(_params: CheckoutParams): Promise<CheckoutResult> {
    throw new Error(NOT_READY);
  },

  // Fase 4.
  async refundPayment(_params): Promise<RefundResult> {
    throw new Error(NOT_READY);
  },

  // Fase 4.
  async cancelSubscription(_params): Promise<void> {
    throw new Error(NOT_READY);
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
