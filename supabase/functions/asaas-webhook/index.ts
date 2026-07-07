import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Asaas Fase 2 — ROOT-account webhook (Aura's own plan billing).
// Confirms/keeps the club's SaaS subscription active. Verified by the
// asaas-access-token header matching the ASAAS_WEBHOOK_TOKEN secret.
// (Subaccount/member-payment events are handled separately in Fase 5.)
// verify_jwt is disabled for this function — Asaas is an external caller;
// the shared token is the authentication.

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

    // Resolve the tenant + plan this payment belongs to.
    // Priority: externalReference "tenant_id:plan_id" (set at checkout);
    // fallback to subscription id, then customer id.
    let tenantId: string | null = null;
    let planId: string | null = null;

    if (typeof payment.externalReference === "string" && payment.externalReference.includes(":")) {
      const [t, p] = payment.externalReference.split(":");
      tenantId = t || null;
      planId = p || null;
    }
    if (!tenantId && payment.subscription) {
      const { data } = await admin.from("tenants").select("id").eq("asaas_subscription_id", payment.subscription).maybeSingle();
      tenantId = data?.id ?? null;
    }
    if (!tenantId && payment.customer) {
      const { data } = await admin.from("tenants").select("id").eq("asaas_customer_id", payment.customer).maybeSingle();
      tenantId = data?.id ?? null;
    }
    if (!tenantId) return json({ received: true, note: "tenant not resolved" });

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

    return json({ received: true });
  } catch (err: any) {
    console.error("asaas-webhook error:", err);
    return json({ error: err.message || "Internal server error" }, 500);
  }
});
