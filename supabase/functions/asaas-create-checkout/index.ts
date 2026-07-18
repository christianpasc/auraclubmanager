import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Asaas Fase 2 — Aura charges a Brazilian club its plan via the ROOT account.
// Creates/reuses the club's Asaas customer, opens a subscription (or a one-off
// payment for lifetime plans) with billingType UNDEFINED (customer chooses
// PIX / boleto / card on the Asaas-hosted invoice), and returns that invoice
// URL to redirect to. subscription_status flips to 'active' only on the
// asaas-webhook payment confirmation.
//
// Secrets: ASAAS_ENV ('sandbox'|'production'), ASAAS_API_KEY (root account).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
      .select("id, name, asaas_customer_id")
      .eq("id", tenant_id)
      .single();
    if (!tenant) return json({ error: "Clube não encontrado." }, 404);

    const asaasFetch = (path: string, init: RequestInit) =>
      fetch(`${baseUrl}${path}`, {
        ...init,
        headers: { access_token: apiKey, "Content-Type": "application/json", ...(init.headers || {}) },
      });

    // 1. Customer (reuse or create)
    let customerId: string | null = tenant.asaas_customer_id;
    if (!customerId) {
      const res = await asaasFetch("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: name || tenant.name,
          cpfCnpj: String(cpf_cnpj).replace(/\D/g, ""),
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
      return json({ url: body.invoiceUrl });
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

    return json({ url: firstPayment.invoiceUrl });
  } catch (err: any) {
    console.error("asaas-create-checkout error:", err);
    return json({ error: err.message || "Internal server error" }, 500);
  }
});
