export type {
  PaymentProvider,
  PaymentProviderId,
  ConnectAccountStatus,
  ConnectCurrency,
  OnboardingLinkResult,
  SyncPlanResult,
  CheckoutResult,
  CheckoutParams,
  RefundResult,
} from './paymentProvider.types';
export { stripeConnectProvider as paymentProvider } from './stripeConnectProvider';
export { asaasProvider, getAsaasStatus } from './asaasProvider';
export type { AsaasStatus } from './asaasProvider';

import type { PaymentProvider, PaymentProviderId } from './paymentProvider.types';
import { stripeConnectProvider } from './stripeConnectProvider';
import { asaasProvider } from './asaasProvider';

// Minimal structural view of a tenant — avoids coupling this module to
// tenantService while accepting the real Tenant object at every call site.
export interface PaymentRoutingTenant {
  payment_provider?: string | null;
  country?: string | null;
  settings?: { country?: string } | null;
}

// Brazil arrives spelled two ways and from two places: the `tenants.country`
// column holds the ISO code ('BR') while `settings.country` holds the signup
// form's label ('Brazil'). Older rows have only one of the two, so we accept
// either spelling from either source.
const BRAZIL = new Set(['br', 'brazil', 'brasil']);

function isBrazil(tenant: PaymentRoutingTenant): boolean {
  return [tenant.country, tenant.settings?.country].some(
    (value) => !!value && BRAZIL.has(value.trim().toLowerCase())
  );
}

// Market routing: the explicit tenants.payment_provider column wins (set at
// backfill/onboarding, admin-overridable); when absent, Brazilian clubs route
// to Asaas and everyone else to Stripe. Mirrors the SQL backfill rule in
// scripts/migration_asaas_phase1.sql.
export function resolvePaymentProviderId(tenant: PaymentRoutingTenant | null | undefined): PaymentProviderId {
  if (tenant?.payment_provider === 'asaas') return 'asaas';
  if (tenant?.payment_provider === 'stripe') return 'stripe';
  return tenant && isBrazil(tenant) ? 'asaas' : 'stripe';
}

export function getPaymentProvider(tenant: PaymentRoutingTenant | null | undefined): PaymentProvider {
  return resolvePaymentProviderId(tenant) === 'asaas' ? asaasProvider : stripeConnectProvider;
}
