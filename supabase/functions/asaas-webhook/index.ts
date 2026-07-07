import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Asaas Fase 5 — single webhook endpoint for BOTH rails, verified by the
// asaas-access-token header matching ASAAS_WEBHOOK_TOKEN:
//   • ROOT account (Aura's plan billing): externalReference "tenant_id:plan_id"
//     → flips tenants.subscription_status.
//   • SUBACCOUNTS (club → member fees): externalReference = invoice.id (plain
//     UUID) → marks the invoice paid/overdue/refunded and mirrors a payments
//     row. All updates are idempotent so Asaas retries are safe.
// verify_jwt is disabled (external caller); the shared token authenticates.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function endsAtFor(interval: string): string | null {
  const d = new Date();
  switch (interval) {
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "yearly": d.setFullYear(d.getFullYear() + 1); break;
    case "lifetime": return null;
    default: d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString();
}

type Admin = ReturnType<typeof createClient>;

// ── ROOT: Aura plan subscription (externalReference "tenant_id:plan_id") ──
async function handlePlanPayment(admin: Admin, event: string, tenantId: string, planId: string | null) {
  if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
    let interval = "monthly";
    if (planId) {
      const { data: plan } = await admin.from("stripe_plans").select("interval").eq("id", planId).maybeSingle();
      if (plan?.interval) interval = plan.interval;
    }
    const update: Record<string, unknown> = {
      subscription_status: "active",
      subscription_starts_at: new Date().toISOString(),
      subscription_ends_at: endsAtFor(interval),
    };
    if (planId) update.subscription_plan_id = planId;
    await admin.from("tenants").update(update).eq("id", tenantId);
  } else if (event === "PAYMENT_OVERDUE") {
    await admin.from("tenants").update({ subscription_status: "past_due" }).eq("id", tenantId);
  }
}

// ── SUBACCOUNT: member fee (invoice) — idempotent ──
async function handleMemberPayment(admin: Admin, event: string, payment: any, invoiceId: string) {
  const { data: invoice } = await admin
    .from("invoices")
    .select("id, tenant_id, amount, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return;

  if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
    if (invoice.status !== "paid") {
      await admin.from("invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", invoice.id);
    }
    // Mirror a payments row exactly once (partial unique index on asaas_payment_id)
    if (payment.id) {
      const { data: existing } = await admin.from("payments").select("id").eq("asaas_payment_id", payment.id).maybeSingle();
      if (!existing) {
        await admin.from("payments").insert({
          tenant_id: invoice.tenant_id,
          invoice_id: invoice.id,
          amount: Number(payment.value ?? invoice.amount),
          paid_at: new Date().toISOString(),
          method: (payment.billingType || "asaas").toString().toLowerCase(),
          asaas_payment_id: payment.id,
        });
      }
    }
  } else if (event === "PAYMENT_OVERDUE") {
    if (invoice.status === "pending") {
      await admin.from("invoices").update({ status: "overdue" }).eq("id", invoice.id);
    }
  } else if (event === "PAYMENT_REFUNDED") {
    if (invoice.status === "paid") {
      await admin.from("invoices").update({ status: "pending", paid_at: null }).eq("id", invoice.id);
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    const gotToken = req.headers.get("asaas-access-token");
    if (expectedToken && gotToken !== expectedToken) {
      return json({ error: "Invalid webhook token" }, 401);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload = await req.json();
    const event: string = payload?.event || "";
    const payment = payload?.payment;
    if (!payment) return json({ received: true });

    const ext = typeof payment.externalReference === "string" ? payment.externalReference : "";

    // Route by externalReference shape: "tenant:plan" → plan; UUID → invoice.
    if (ext.includes(":")) {
      const [tenantId, planId] = ext.split(":");
      if (tenantId) await handlePlanPayment(admin, event, tenantId, planId || null);
      return json({ received: true });
    }

    // Member invoice: resolve by externalReference, then by stored ids.
    let invoiceId = ext || null;
    if (!invoiceId && payment.id) {
      const { data } = await admin.from("invoices").select("id").eq("asaas_payment_id", payment.id).maybeSingle();
      invoiceId = data?.id ?? null;
    }
    if (!invoiceId && payment.subscription) {
      const { data } = await admin.from("invoices").select("id").eq("asaas_subscription_id", payment.subscription).maybeSingle();
      invoiceId = data?.id ?? null;
    }
    if (invoiceId) await handleMemberPayment(admin, event, payment, invoiceId);

    return json({ received: true });
  } catch (err: any) {
    console.error("asaas-webhook error:", err);
    return json({ error: err.message || "Internal server error" }, 500);
  }
});
