import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Asaas Fase 4 — the club charges a member's fee on its OWN subaccount.
// Money settles in the club's subaccount (never the root). Reuses the invoices
// rail: stores asaas_payment_id / asaas_subscription_id / asaas_invoice_url on
// the invoice and asaas_customer_id on the athlete. billingType UNDEFINED lets
// the payer choose PIX / boleto / card on the Asaas-hosted invoice.
//
// Secrets: ASAAS_ENV, ASAAS_ENCRYPTION_KEY (to decrypt the subaccount apiKey).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-asaas-mode",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ASAAS_BASE_URLS: Record<string, string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
};

// school_plans.interval → Asaas subscription cycle
const CYCLE_MAP: Record<string, string> = {
  monthly: "MONTHLY",
  quarterly: "QUARTERLY",
  semiannual: "SEMIANNUALLY",
  annual: "YEARLY",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function importAesKey(keyB64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("ASAAS_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
}

// Reverses asaas-create-subaccount's encryptSecret: base64(iv[12] || ct+tag).
async function decryptSecret(payload: string, key: CryptoKey): Promise<string> {
  const combined = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ct = combined.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

function digits(v: unknown): string {
  return String(v || "").replace(/[^0-9]/g, "");
}

// Asaas refuses a subscription whose nextDueDate is in the past, which is
// exactly the case when a club charges an already-overdue fee. Bring the first
// cycle forward to today; the invoice keeps its own original due_date.
function notBeforeToday(date: string | null | undefined): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!date) return today;
  return date < today ? today : date;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Base URL follows the request environment; the subaccount key comes from
    // the DB and is inherently scoped to the env where the subaccount was made.
    const mode = (req.headers.get("x-asaas-mode") || Deno.env.get("ASAAS_ENV") || "sandbox").toLowerCase();
    const baseUrl = ["production", "prod", "live"].includes(mode) ? ASAAS_BASE_URLS.production : ASAAS_BASE_URLS.sandbox;
    const encKeyB64 = Deno.env.get("ASAAS_ENCRYPTION_KEY");
    if (!encKeyB64) return json({ error: "Chave de criptografia não configurada." }, 500);

    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { tenant_id, invoice_id } = await req.json();
    if (!tenant_id || !invoice_id) return json({ error: "Campos obrigatórios: tenant_id, invoice_id" }, 400);

    const { data: membership } = await admin
      .from("tenant_users").select("user_id")
      .eq("tenant_id", tenant_id).eq("user_id", userData.user.id).maybeSingle();
    if (!membership) return json({ error: "Unauthorized: not a member of this club" }, 403);

    const { data: tenant } = await admin
      .from("tenants")
      .select("id, asaas_subaccount_id, asaas_charges_enabled, asaas_subaccount_api_key_encrypted")
      .eq("id", tenant_id).single();
    if (!tenant?.asaas_subaccount_id || !tenant.asaas_charges_enabled || !tenant.asaas_subaccount_api_key_encrypted) {
      return json({ error: "A conta de recebimento do clube ainda não está pronta." }, 400);
    }

    const { data: invoice } = await admin
      .from("invoices")
      .select("id, tenant_id, amount, due_date, description, athlete_id, school_plan_id, status, asaas_payment_id, asaas_subscription_id, asaas_invoice_url")
      .eq("id", invoice_id).eq("tenant_id", tenant_id).single();
    if (!invoice) return json({ error: "Fatura não encontrada." }, 404);

    // Already charged? Hand back the existing invoice instead of creating a
    // second one. Without this, a double click bills the family twice and the
    // first charge is orphaned in Asaas while still collecting.
    if (invoice.asaas_invoice_url && (invoice.asaas_payment_id || invoice.asaas_subscription_id)) {
      return json({
        url: invoice.asaas_invoice_url,
        session_id: invoice.asaas_subscription_id || invoice.asaas_payment_id,
        reused: true,
      });
    }

    const { data: athlete } = await admin
      .from("athletes")
      .select("id, full_name, cpf, email, phone, guardian_name, guardian_cpf, guardian_email, guardian_phone, asaas_customer_id")
      .eq("id", invoice.athlete_id).maybeSingle();
    if (!athlete) return json({ error: "Atleta da fatura não encontrado." }, 404);

    // Guardian data moved to the guardians table (athlete.guardian_* are legacy
    // columns the athlete form no longer writes), so the payer is resolved from
    // the linked primary guardian first, then the legacy columns, then the
    // athlete's own CPF for an adult paying for themselves.
    let guardian: { full_name?: string; cpf?: string; email?: string; phone?: string } | null = null;
    const { data: guardianLink } = await admin
      .from("athlete_guardians")
      .select("is_primary, guardian:guardians(full_name, cpf, email, phone)")
      .eq("athlete_id", athlete.id)
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (guardianLink) guardian = (guardianLink as any).guardian ?? null;

    const payerName = guardian?.full_name || athlete.guardian_name || athlete.full_name;
    const payerEmail = guardian?.email || athlete.guardian_email || athlete.email || undefined;
    const payerPhone = digits(guardian?.phone || athlete.guardian_phone || athlete.phone) || undefined;
    const payerCpf = digits(guardian?.cpf || athlete.guardian_cpf || athlete.cpf);
    if (!payerCpf) {
      return json({
        error: guardian
          ? `O responsável ${guardian.full_name || ""} está sem CPF. Informe o CPF dele em Responsáveis para poder cobrar.`.trim()
          : "Para cobrar é preciso um CPF: cadastre o CPF do atleta, ou vincule um responsável com CPF em Responsáveis.",
      }, 400);
    }

    // Decrypt the subaccount key and scope all calls to it
    const key = await importAesKey(encKeyB64);
    const subKey = await decryptSecret(tenant.asaas_subaccount_api_key_encrypted, key);
    const asaasFetch = (path: string, init: RequestInit) =>
      fetch(`${baseUrl}${path}`, {
        ...init,
        headers: { access_token: subKey, "Content-Type": "application/json", ...(init.headers || {}) },
      });

    // 1. Customer (reuse or create) in the subaccount
    let customerId = athlete.asaas_customer_id as string | null;
    if (!customerId) {
      const res = await asaasFetch("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: payerName,
          cpfCnpj: payerCpf,
          email: payerEmail,
          mobilePhone: payerPhone,
        }),
      });
      const body = await res.json();
      if (!res.ok) return json({ error: body?.errors?.[0]?.description || "Erro ao criar cliente no Asaas." }, 400);
      customerId = body.id;
      await admin.from("athletes").update({ asaas_customer_id: customerId }).eq("id", athlete.id);
    }

    const value = Number(invoice.amount);
    const description = invoice.description || "Mensalidade";
    const externalReference = invoice.id;

    // Recurring when the invoice is tied to a school plan with a cyclic interval
    let plan: { interval?: string } | null = null;
    if (invoice.school_plan_id) {
      const { data } = await admin.from("school_plans").select("interval").eq("id", invoice.school_plan_id).maybeSingle();
      plan = data;
    }
    const cycle = plan?.interval ? CYCLE_MAP[plan.interval] : undefined;

    if (cycle) {
      const subRes = await asaasFetch("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          billingType: "UNDEFINED",
          value,
          cycle,
          nextDueDate: notBeforeToday(invoice.due_date),
          description,
          externalReference,
        }),
      });
      const subBody = await subRes.json();
      if (!subRes.ok) return json({ error: subBody?.errors?.[0]?.description || "Erro ao criar assinatura no Asaas." }, 400);

      const payRes = await asaasFetch(`/subscriptions/${subBody.id}/payments`, { method: "GET" });
      const payBody = await payRes.json();
      const firstPayment = payBody?.data?.[0];

      await admin.from("invoices").update({
        asaas_subscription_id: subBody.id,
        asaas_payment_id: firstPayment?.id || null,
        asaas_invoice_url: firstPayment?.invoiceUrl || null,
      }).eq("id", invoice.id);

      if (!firstPayment?.invoiceUrl) return json({ error: "Assinatura criada, mas a fatura ainda não está disponível." }, 502);
      return json({ url: firstPayment.invoiceUrl, session_id: subBody.id });
    }

    // One-off charge
    const res = await asaasFetch("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "UNDEFINED",
        value,
        dueDate: invoice.due_date,
        description,
        externalReference,
      }),
    });
    const body = await res.json();
    if (!res.ok) return json({ error: body?.errors?.[0]?.description || "Erro ao criar cobrança no Asaas." }, 400);

    await admin.from("invoices").update({
      asaas_payment_id: body.id,
      asaas_invoice_url: body.invoiceUrl || null,
    }).eq("id", invoice.id);

    return json({ url: body.invoiceUrl, session_id: body.id });
  } catch (err: any) {
    console.error("asaas-club-checkout error:", err?.message || err);
    return json({ error: err.message || "Internal server error" }, 500);
  }
});
