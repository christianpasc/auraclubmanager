export type ConnectCurrency = 'GBP' | 'EUR' | 'USD' | 'BRL' | 'CAD' | 'AUD' | 'CHF' | 'MXN' | 'ARS' | 'COP';

export type PaymentProviderId = 'stripe' | 'asaas';

export interface ConnectAccountStatus {
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  currency: string;
}

export interface OnboardingLinkResult {
  url: string;
}

export interface SyncPlanResult {
  stripe_product_id: string;
  stripe_price_id: string;
}

export interface CheckoutResult {
  url: string;
  session_id: string;
}

export interface RefundResult {
  refund_id: string;
  status: string;
}

export interface CheckoutParams {
  mode: 'subscription' | 'payment';
  tenantId: string;
  invoiceId?: string;
  orderId?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface PaymentProvider {
  createOnboardingLink(tenantId: string, returnUrl: string, refreshUrl?: string): Promise<OnboardingLinkResult>;
  syncPlan(planId: string, tenantId: string): Promise<SyncPlanResult>;
  createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult>;
  refundPayment(params: { tenantId: string; paymentIntentId: string; amount?: number }): Promise<RefundResult>;
  cancelSubscription(params: { tenantId: string; subscriptionId: string }): Promise<void>;
}
