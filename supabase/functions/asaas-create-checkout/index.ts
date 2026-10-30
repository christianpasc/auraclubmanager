import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Asaas Fase 2 — Aura charges a Brazilian club its plan via the ROOT account.
// Creates/reuses the club's Asaas customer, opens a subscription (or a one-off
// payment for lifetime plans) with billingType UNDEFINED (customer chooses
// PIX / boleto / card on the Asaas-hosted invoice), and returns that invoice
// URL to redirect to. subscription_status flips to 'active' only on the
// asaas-webhook payment confirmation.
//
// Secrets: ASAAS_API_KEY_SANDBOX / ASAAS_API_KEY_PROD (root account), with
// ASAAS_ENV + ASAAS_API_KEY kept as a legacy single-key fallback.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-asaas-mode",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ASAAS_BASE_URLS: Record<string, string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
};

const CYCLE_MAP: Record<string, string> = {
  monthly: "MONTHLY",
  quarterly: "QUARTERLY",
  yearly: "YEARLY",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function today(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// Per-request environment via x-asaas-mode header (client picks by hostname),
// with legacy ASAAS_ENV/ASAAS_API_KEY fallback. No secret swapping.
function resolveAsaas(req: Request): { baseUrl: string; rootKey: string | undefined } {
  const mode = (req.headers.get("x-asaas-mode") || Deno.env.get("ASAAS_ENV") || "sandbox").toLowerCase();
  const production = mode === "production" || mode === "prod" || mode === "live";
  const baseUrl = production ? ASAAS_BASE_URLS.production : ASAAS_BASE_URLS.sandbox;
  const rootKey = production
    ? (Deno.env.get("ASAAS_API_KEY_PROD") || Deno.env.get("ASAAS_API_KEY"))
    : (Deno.env.get("ASAAS_API_KEY_SANDBOX") || Deno.env.get("ASAAS_API_KEY"));
  return { baseUrl, rootKey };
}

// A cached customer id can outlive the customer: deleting it in the Asaas
// panel leaves our copy pointing at nothing, and every later charge fails with
// "não é possível criar uma cobrança para um cliente removido" — permanently,
// since we would keep reusing the same dead id. Checking the id before use
// costs one call and lets the club recover on its own.
async function isCustomerUsable(
  asaasFetch: (path: string, init?: RequestInit) => Promise<Response>,
  customerId: string,
): Promise<boolean> {
  try {
    const res = await asaasFetch(`/customers/${customerId}`, { method: "GET" });
    if (!res.ok) return false;
    const body = await res.json();
    return body?.deleted !== true;
  } catch (e) {
    // A network blip should not throw away a perfectly good customer.
    console.error("customer check failed, assuming usable:", (e as any)?.message || e);
    return true;
  }
}

// PIX and boleto details hang off the payment, and both endpoints accept a
// charge created as UNDEFINED. Failures are not fatal — the hosted invoice
// still works — so we return whatever could be fetched.
async function fetchPaymentMethods(
  asaasFetch: (path: string, init?: RequestInit) => Promise<Response>,
  paymentId: string,
) {
  const result: Record<string, unknown> = {};
  try {
    const res = await asaasFetch(`/payments/${paymentId}/pixQrCode`, { method: "GET" });
    if (res.ok) {
      const body = await res.json();
      if (body?.encodedImage && body?.payload) {
        result.pix = { qr_base64: body.encodedImage, payload: body.payload, expires_at: body.expirationDate ?? null };
      }
    }
  } catch (e) {
    console.error("pixQrCode fetch failed:", (e as any)?.message || e);
  }
  try {
    const res = await asaasFetch(`/payments/${paymentId}/identificationField`, { method: "GET" });
    if (res.ok) {
      const body = await res.json();
      if (body?.identificationField) {
        result.boleto = { line: body.identificationField, barcode: body.barCode ?? null };
      }
    }
  } catch (e) {
    console.error("identificationField fetch failed:", (e as any)?.message || e);
  }
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { baseUrl, rootKey: apiKey } = resolveAsaas(req);
    if (!apiKey) return json({ error: "Integração Asaas não configurada." }, 500);

    // Authenticate + require membership of the target tenant
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { tenant_id, plan_id, cpf_cnpj, email, name } = await req.json();
    if (!tenant_id || !plan_id || !cpf_cnpj) {
      return json({ error: "Campos obrigatórios: tenant_id, plan_id, cpf_cnpj" }, 400);
    }

    const { data: membership } = await admin
      .from("tenant_users")
      .select("user_id")
      .eq("tenant_id", tenant_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!membership) return json({ error: "Unauthorized: not a member of this club" }, 403);

    const { data: plan } = await admin.from("stripe_plans").select("*").eq("id", plan_id).single();
    if (!plan) return json({ error: "Plano não encontrado." }, 404);
    if (plan.price_brl == null) {
      return json({ error: "Este plano ainda não tem preço em Real (BRL) configurado." }, 400);
    }

    const { data: tenant } = await admin
      .from("tenants")
      .select("id, name, asaas_customer_id, asaas_subscription_id, subscription_status")
      .eq("id", tenant_id)
      .single();
    if (!tenant) return json({ error: "Clube não encontrado." }, 404);

    const asaasFetch = (path: string, init: RequestInit) =>
      fetch(`${baseUrl}${path}`, {
        ...init,
        headers: { access_token: apiKey, "Content-Type": "application/json", ...(init.headers || {}) },
      });

    // A subscription already exists for this club — most likely the caller is
    // retrying after the "invoice not ready yet" response below. Return the
    // pending invoice from that subscription instead of opening a second one,
    // which would leave an orphan subscription billing the club forever.
    if (tenant.asaas_subscription_id) {
      const existingRes = await asaasFetch(`/subscriptions/${tenant.asaas_subscription_id}/payments`, { method: "GET" });
      if (existingRes.ok) {
        const existingBody = await existingRes.json();
        const open = (existingBody?.data || []).find(
          (p: any) => p?.invoiceUrl && ["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"].includes(p?.status),
        );
        if (open) {
          const methods = await fetchPaymentMethods(asaasFetch, open.id);
          return json({ url: open.invoiceUrl, reused: true, ...methods });
        }
      }
      // Subscription is gone or has no open invoice: fall through and create a
      // fresh one rather than leaving the club unable to pay.
    }

    // 1. Customer (reuse if it still exists, otherwise create a fresh one)
    let customerId: string | null = tenant.asaas_customer_id;
    if (customerId && !(await isCustomerUsable(asaasFetch, customerId))) {
      console.log(`tenant ${tenant_id}: asaas customer ${customerId} is gone, creating a new one`);
      customerId = null;
    }
    if (!customerId) {
      const res = await asaasFetch("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: name || tenant.name,
          cpfCnpj: String(cpf_cnpj).replace(/[^0-9]/g, ""),
          email: email || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        const msg = body?.errors?.[0]?.description || "Erro ao criar cliente no Asaas.";
        return json({ error: msg }, 400);
      }
      customerId = body.id;
      await admin.from("tenants").update({ asaas_customer_id: customerId }).eq("id", tenant_id);
    }

    const value = Number(plan.price_brl);
    const externalReference = `${tenant_id}:${plan_id}`;
    const description = `Aura Club Manager — ${plan.name}`;

    // 2a. Lifetime → one-time payment
    if (plan.interval === "lifetime") {
      const res = await asaasFetch("/payments", {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          billingType: "UNDEFINED",
          value,
          dueDate: today(3),
          description,
          externalReference,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        const msg = body?.errors?.[0]?.description || "Erro ao criar cobrança no Asaas.";
        return json({ error: msg }, 400);
      }
      const methods = await fetchPaymentMethods(asaasFetch, body.id);
      return json({ url: body.invoiceUrl, ...methods });
    }

    // 2b. Recurring → subscription
    const cycle = CYCLE_MAP[plan.interval];
    if (!cycle) return json({ error: `Intervalo não suportado no Asaas: ${plan.interval}` }, 400);

    const subRes = await asaasFetch("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "UNDEFINED",
        value,
        cycle,
        nextDueDate: today(0),
        description,
        externalReference,
      }),
    });
    const subBody = await subRes.json();
    if (!subRes.ok) {
      const msg = subBody?.errors?.[0]?.description || "Erro ao criar assinatura no Asaas.";
      return json({ error: msg }, 400);
    }

    await admin.from("tenants").update({ asaas_subscription_id: subBody.id }).eq("id", tenant_id);

    // First generated payment carries the hosted invoice URL
    const payRes = await asaasFetch(`/subscriptions/${subBody.id}/payments`, { method: "GET" });
    const payBody = await payRes.json();
    const firstPayment = payBody?.data?.[0];
    if (!firstPayment?.invoiceUrl) {
      return json({ error: "Assinatura criada, mas a fatura ainda não está disponível. Tente novamente em instantes." }, 502);
    }

    const methods = await fetchPaymentMethods(asaasFetch, firstPayment.id);
    return json({ url: firstPayment.invoiceUrl, ...methods });
  } catch (err: any) {
    console.error("asaas-create-checkout error:", err);
    return json({ error: err.message || "Internal server error" }, 500);
  }
});
