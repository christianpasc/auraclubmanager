import { supabase } from '../../lib/supabase';
import { stripeConfig } from '../../lib/stripe';
import type {
  PaymentProvider,
  OnboardingLinkResult,
  SyncPlanResult,
  CheckoutResult,
  CheckoutParams,
  RefundResult,
} from './paymentProvider.types';

const modeHeader = () => ({ 'x-stripe-mode': stripeConfig.mode });

const invoke = async <T>(fn: string, body: object): Promise<T> => {
  const { data, error } = await supabase.functions.invoke(fn, {
    body,
    headers: modeHeader(),
  });
  if (error) {
    let msg = error.message || `Error calling ${fn}`;
    try {
      const body = await (error as any).context?.json?.();
      if (body?.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }
  return data as T;
};

export const stripeConnectProvider: PaymentProvider = {
  async createOnboardingLink(tenantId, returnUrl, refreshUrl): Promise<OnboardingLinkResult> {
    const data = await invoke<{ url: string }>('club-connect-onboard', {
      tenant_id: tenantId,
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });
    if (!data?.url) throw new Error('URL de conexão não retornada pelo servidor.');
    return { url: data.url };
  },

  async syncPlan(planId, tenantId): Promise<SyncPlanResult> {
    const data = await invoke<SyncPlanResult>('club-sync-plan', {
      plan_id: planId,
      tenant_id: tenantId,
    });
    return data;
  },

  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
    const data = await invoke<CheckoutResult>('club-checkout', {
      mode: params.mode,
      tenant_id: params.tenantId,
      invoice_id: params.invoiceId,
      order_id: params.orderId,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });
    if (!data?.url) throw new Error('URL de checkout não retornada pelo servidor.');
    return data;
  },

  async refundPayment(params): Promise<RefundResult> {
    return invoke<RefundResult>('club-refund', {
      tenant_id: params.tenantId,
      payment_intent_id: params.paymentIntentId,
      amount: params.amount,
    });
  },

  async cancelSubscription(params): Promise<void> {
    await invoke<void>('club-cancel-subscription', {
      tenant_id: params.tenantId,
      subscription_id: params.subscriptionId,
    });
  },
};
