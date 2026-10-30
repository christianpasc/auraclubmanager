import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Public payment endpoint for the hosted invoice page (/pay/:invoiceId), for
// clubs on the Asaas rail. No auth — the invoice id is the access token (an
// unguessable UUID), the same model public-invoice-info and the Stripe
// club-checkout already use, because the payer is a parent who has no account.
//
// asaas-club-checkout cannot serve this page: it requires a JWT and club
// membership, since it exists for staff pressing "Cobrar via Asaas".
//
// Returns the charge plus what the page needs to render PIX and boleto inline:
//   { url, pix: { qr_base64, payload, expires_at }, boleto: { line, barcode, url } }
// Charges are created once and reused, so reloading the page never bills twice.
//
// Secrets: ASAAS_ENCRYPTION_KEY (to decrypt the club subaccount key).

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

async function decryptSecret(payload: string, key: CryptoKey): Promise<string> {
  const combined = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: combined.slice(0, 12) },
    key,
    combined.slice(12),
  );
  return new TextDecoder().decode(pt);
}

function digits(v: unknown): string {
  return String(v || "").replace(/[^0-9]/g, "");
}

// Asaas refuses a subscription whose nextDueDate is in the past, which is the
// normal case when a parent opens an already-overdue fee.
function notBeforeToday(date: string | null | undefined): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!date) return today;
  return date < today ? today : date;
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
// charge created as UNDEFINED. Failures here are not fatal: the payer can
// still use the hosted invoice, so we return what we could fetch.
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
        result.pix = {
          qr_base64: body.encodedImage,
          payload: body.payload,
          expires_at: body.expirationDate ?? null,
        };
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
        result.boleto = {
          line: body.identificationField,
          barcode: body.barCode ?? null,
        };
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

    const mode = (req.headers.get("x-asaas-mode") || Deno.env.get("ASAAS_ENV") || "sandbox").toLowerCase();
    const baseUrl = ["production", "prod", "live"].includes(mode)
      ? ASAAS_BASE_URLS.production
      : ASAAS_BASE_URLS.sandbox;

    const encKeyB64 = Deno.env.get("ASAAS_ENCRYPTION_KEY");
    if (!encKeyB64) return json({ error: "Pagamento indisponível no momento." }, 503);

    const { invoice_id } = await req.json();
    if (!invoice_id) return json({ error: "Missing invoice_id" }, 400);

    const { data: invoice } = await admin
      .from("invoices")
      .select("id, tenant_id, amount, due_date, description, athlete_id, school_plan_id, status, asaas_payment_id, asaas_subscription_id, asaas_invoice_url")
      .eq("id", invoice_id)
      .maybeSingle();
    if (!invoice) return json({ error: "Fatura não encontrada." }, 404);

    // Nothing to collect on a settled invoice, and this also stops a stale
    // link from re-opening a charge after the fee was paid or cancelled.
    if (invoice.status === "paid") return json({ error: "Esta fatura já foi paga.", status: "paid" }, 409);
    if (invoice.status === "cancelled") return json({ error: "Esta cobrança foi cancelada.", status: "cancelled" }, 409);

    const { data: tenant } = await admin
      .from("tenants")
      .select("id, payment_provider, country, settings, asaas_subaccount_id, asaas_charges_enabled, asaas_subaccount_api_key_encrypted, asaas_subaccount_env")
      .eq("id", invoice.tenant_id)
      .single();
    if (!tenant) return json({ error: "Clube não encontrado." }, 404);

    if (!tenant.asaas_subaccount_id || !tenant.asaas_charges_enabled || !tenant.asaas_subaccount_api_key_encrypted) {
      return json({ error: "O clube ainda não finalizou a conta de recebimento." }, 400);
    }

    // A subaccount key only works in the environment that issued it, and both
    // environments share this database. The payer cannot act on this, so the
    // message points them at the club rather than explaining the mismatch.
    const requestEnv = ["production", "prod", "live"].includes(mode) ? "production" : "sandbox";
    if ((tenant.asaas_subaccount_env ?? "production") !== requestEnv) {
      console.error(`invoice ${invoice.id}: subaccount env ${tenant.asaas_subaccount_env} != request env ${requestEnv}`);
      return json({ error: "Pagamento indisponível no momento. Avise o clube." }, 400);
    }

    const key = await importAesKey(encKeyB64);
    const subKey = await decryptSecret(tenant.asaas_subaccount_api_key_encrypted, key);
    const asaasFetch = (path: string, init: RequestInit = {}) =>
      fetch(`${baseUrl}${path}`, {
        ...init,
        headers: { access_token: subKey, "Content-Type": "application/json", ...(init.headers || {}) },
      });

    // Already charged — reuse it. Creating a second charge would issue another
    // boleto for the same fee and bill the family twice.
    if (invoice.asaas_payment_id && invoice.asaas_invoice_url) {
      const methods = await fetchPaymentMethods(asaasFetch, invoice.asaas_payment_id);
      return json({ provider: "asaas", url: invoice.asaas_invoice_url, reused: true, ...methods });
    }

    const { data: athlete } = await admin
      .from("athletes")
      .select("id, full_name, cpf, email, phone, guardian_name, guardian_cpf, guardian_email, guardian_phone, asaas_customer_id")
      .eq("id", invoice.athlete_id)
      .maybeSingle();
    if (!athlete) return json({ error: "Atleta da fatura não encontrado." }, 404);

    // Guardian data lives in the guardians table; athlete.guardian_* are legacy
    // columns the athlete form no longer writes.
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

    // The payer cannot fix this themselves, so the message is aimed at the club.
    if (!payerCpf) {
      return json({
        error: "Esta cobrança ainda não pode ser gerada: falta o CPF do responsável. Avise o clube.",
      }, 400);
    }

    let customerId = athlete.asaas_customer_id as string | null;
    if (customerId && !(await isCustomerUsable(asaasFetch, customerId))) {
      console.log(`athlete ${athlete.id}: asaas customer ${customerId} is gone, creating a new one`);
      customerId = null;
    }
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
      if (!res.ok) {
        console.error("asaas customer create failed:", JSON.stringify(body));
        return json({ error: "Não foi possível preparar a cobrança. Avise o clube." }, 400);
      }
      customerId = body.id;
      await admin.from("athletes").update({ asaas_customer_id: customerId }).eq("id", athlete.id);
    }

    const value = Number(invoice.amount);
    const description = invoice.description || "Mensalidade";

    let plan: { interval?: string } | null = null;
    if (invoice.school_plan_id) {
      const { data } = await admin
        .from("school_plans").select("interval").eq("id", invoice.school_plan_id).maybeSingle();
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
          externalReference: invoice.id,
        }),
      });
      const subBody = await subRes.json();
      if (!subRes.ok) {
        console.error("asaas subscription create failed:", JSON.stringify(subBody));
        return json({ error: "Não foi possível gerar a cobrança. Avise o clube." }, 400);
      }

      const payRes = await asaasFetch(`/subscriptions/${subBody.id}/payments`, { method: "GET" });
      const payBody = await payRes.json();
      const firstPayment = payBody?.data?.[0];

      await admin.from("invoices").update({
        asaas_subscription_id: subBody.id,
        asaas_payment_id: firstPayment?.id || null,
        asaas_invoice_url: firstPayment?.invoiceUrl || null,
      }).eq("id", invoice.id);

      if (!firstPayment?.invoiceUrl) {
        return json({ error: "A cobrança está sendo gerada. Recarregue em alguns instantes." }, 502);
      }

      const methods = await fetchPaymentMethods(asaasFetch, firstPayment.id);
      return json({ provider: "asaas", url: firstPayment.invoiceUrl, ...methods });
    }

    const res = await asaasFetch("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "UNDEFINED",
        value,
        dueDate: invoice.due_date,
        description,
        externalReference: invoice.id,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      console.error("asaas payment create failed:", JSON.stringify(body));
      return json({ error: "Não foi possível gerar a cobrança. Avise o clube." }, 400);
    }

    await admin.from("invoices").update({
      asaas_payment_id: body.id,
      asaas_invoice_url: body.invoiceUrl || null,
    }).eq("id", invoice.id);

    const methods = await fetchPaymentMethods(asaasFetch, body.id);
    return json({ provider: "asaas", url: body.invoiceUrl, ...methods });

  } catch (err: any) {
    console.error("public-invoice-pay error:", err?.message || err);
    return json({ error: "Erro ao preparar o pagamento." }, 500);
  }
});
