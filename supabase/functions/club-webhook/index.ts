import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// club-webhook: handles Connect events (club → member payments).
// Separate from stripe-webhook which handles Aura SaaS billing events.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // Separate from STRIPE_WEBHOOK_SECRET_TEST/LIVE used by stripe-webhook (Aura SaaS billing) —
  // each Stripe webhook endpoint has its own unique signing secret.
  const webhookSecret = Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET_LIVE");
  const webhookSecretTest = Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET_TEST");

  if (!webhookSecret && !webhookSecretTest) {
    console.error("club-webhook: STRIPE_CONNECT_WEBHOOK_SECRET not configured");
    return new Response(JSON.stringify({ error: "Webhook secret not configured" }), { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), { status: 400 });
  }

  const body = await req.text();
  const stripeKeyLive = Deno.env.get("STRIPE_SECRET_KEY_LIVE");
  const stripeKeyTest = Deno.env.get("STRIPE_SECRET_KEY_TEST");
  const stripeKey = stripeKeyLive || stripeKeyTest!;

  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let event: Stripe.Event;
  const secrets = [webhookSecret, webhookSecretTest].filter(Boolean) as string[];
  let verified = false;
  for (const secret of secrets) {
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, secret);
      verified = true;
      break;
    } catch { /* try next */ }
  }

  if (!verified) {
    console.error("club-webhook: Invalid webhook signature");
    return new Response(JSON.stringify({ error: "Invalid webhook signature" }), { status: 400 });
  }

  console.log(`club-webhook: received ${event!.type}`);

  const now = new Date().toISOString();

  try {
    switch (event!.type) {

      // ── Onboarding / account status ─────────────────────────────────────────
      case "account.updated": {
        const account = event!.data.object as Stripe.Account;
        const tenantId = account.metadata?.tenant_id; // may be absent for Standard accounts
        // Always update by account.id — Standard accounts don't set tenant_id in metadata
        await supabase
          .from("tenants")
          .update({
            stripe_connect_charges_enabled: account.charges_enabled ?? false,
            stripe_connect_payouts_enabled: account.payouts_enabled ?? false,
          })
          .eq("stripe_connect_account_id", account.id);
        if (tenantId) {
          console.log(`club-webhook: tenant ${tenantId} charges=${account.charges_enabled} payouts=${account.payouts_enabled}`);
        }
        break;
      }

      // ── Checkout completed ───────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event!.data.object as Stripe.Checkout.Session;
        const { invoice_id, order_id, tenant_id } = session.metadata || {};

        if (invoice_id) {
          const { data: existing } = await supabase.from("invoices").select("status, stripe_payment_intent_id").eq("id", invoice_id).single();
          if (existing?.status !== "paid") {
            const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
            await supabase.from("invoices").update({
              status: "paid",
              paid_at: now,
              stripe_payment_intent_id: paymentIntentId || null,
              stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
              updated_at: now,
            }).eq("id", invoice_id);

            if (paymentIntentId && !existing?.stripe_payment_intent_id) {
              try {
                await supabase.from("payments").insert({
                  tenant_id,
                  stripe_payment_intent_id: paymentIntentId,
                  amount: (session.amount_total || 0) / 100,
                  status: "completed",
                  created_at: now,
                  updated_at: now,
                });
              } catch { /* ignore */ }
            }
          }
        }

        if (order_id) {
          const { data: existing } = await supabase.from("orders").select("status").eq("id", order_id).single();
          if (existing?.status !== "confirmed" && existing?.status !== "delivered") {
            const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
            await supabase.from("orders").update({
              status: "confirmed",
              stripe_payment_intent_id: paymentIntentId,
              updated_at: now,
            }).eq("id", order_id);

            const { data: items } = await supabase.from("order_items").select("variant_id, quantity").eq("order_id", order_id);
            for (const item of (items || [])) {
              if (item.variant_id) {
                try {
                  await supabase.rpc("decrement_variant_stock", { variant_id: item.variant_id, qty: item.quantity });
                } catch { /* ignore */ }
              }
            }
          }
        }
        break;
      }

      // ── Subscription invoice paid (first payment or renewal) ──────────────
      case "invoice.paid": {
        const stripeInvoice = event!.data.object as Stripe.Invoice;
        const subId = typeof stripeInvoice.subscription === "string" ? stripeInvoice.subscription : null;
        if (!subId) break;

        const piId = typeof stripeInvoice.payment_intent === "string" ? stripeInvoice.payment_intent : null;
        const stripeInvoiceId = stripeInvoice.id;

        // Idempotency: this exact Stripe invoice was already recorded (webhook retry)
        try {
          const dupe = await supabase.from("invoices").select("id").eq("stripe_invoice_id", stripeInvoiceId).limit(1);
          if ((dupe.data?.length ?? 0) > 0) break;
        } catch { /* ignore, proceed */ }

        type AuraInvoice = {
          id: string; tenant_id: string; athlete_id: string | null; school_plan_id: string | null;
          enrollment_id: string | null; description: string | null; amount: number; status: string;
          stripe_payment_intent_id: string | null; stripe_invoice_id: string | null;
        };
        let latest: AuraInvoice | null = null;
        try {
          const res = await supabase
            .from("invoices")
            .select("id, tenant_id, athlete_id, school_plan_id, enrollment_id, description, amount, status, stripe_payment_intent_id, stripe_invoice_id")
            .eq("stripe_subscription_id", subId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
          latest = res.data ?? null;
        } catch { /* no matching invoice */ }

        if (!latest) break;

        const paidAmount = (stripeInvoice.amount_paid || 0) / 100;

        if (latest.status !== "paid") {
          // First payment confirmation for this invoice row.
          await supabase.from("invoices").update({
            status: "paid", paid_at: now, stripe_payment_intent_id: piId, stripe_invoice_id: stripeInvoiceId, updated_at: now,
          }).eq("id", latest.id);

          if (piId) {
            try {
              await supabase.from("payments").insert({
                tenant_id: latest.tenant_id, stripe_payment_intent_id: piId, amount: paidAmount,
                status: "completed", created_at: now, updated_at: now,
              });
            } catch { /* ignore */ }
          }
        } else if (!latest.stripe_invoice_id) {
          // checkout.session.completed already marked it paid (subscription mode sessions
          // don't carry payment_intent) — same cycle, just backfill the Stripe invoice id.
          await supabase.from("invoices").update({
            stripe_invoice_id: stripeInvoiceId,
            stripe_payment_intent_id: piId || latest.stripe_payment_intent_id,
            updated_at: now,
          }).eq("id", latest.id);

          if (piId && !latest.stripe_payment_intent_id) {
            try {
              await supabase.from("payments").insert({
                tenant_id: latest.tenant_id, stripe_payment_intent_id: piId, amount: paidAmount,
                status: "completed", created_at: now, updated_at: now,
              });
            } catch { /* ignore */ }
          }
        } else if (latest.stripe_invoice_id !== stripeInvoiceId) {
          // New billing cycle: the latest invoice for this subscription is already
          // settled with a different Stripe invoice id — create a new monthly row.
          const dueDate = stripeInvoice.period_end
            ? new Date(stripeInvoice.period_end * 1000).toISOString().split("T")[0]
            : now.split("T")[0];

          try {
            await supabase.from("invoices").insert({
              tenant_id: latest.tenant_id,
              athlete_id: latest.athlete_id,
              school_plan_id: latest.school_plan_id,
              enrollment_id: latest.enrollment_id,
              description: latest.description,
              amount: paidAmount || latest.amount,
              due_date: dueDate,
              status: "paid",
              paid_at: now,
              stripe_subscription_id: subId,
              stripe_payment_intent_id: piId,
              stripe_invoice_id: stripeInvoiceId,
            });
          } catch (err) {
            console.error("club-webhook: failed to create renewal invoice", err);
          }

          if (piId) {
            try {
              await supabase.from("payments").insert({
                tenant_id: latest.tenant_id, stripe_payment_intent_id: piId, amount: paidAmount,
                status: "completed", created_at: now, updated_at: now,
              });
            } catch { /* ignore */ }
          }
        }
        break;
      }

      // ── Payment failed ─────────────────────────────────────────────────────
      case "invoice.payment_failed": {
        const stripeInvoice = event!.data.object as Stripe.Invoice;
        const subId = typeof stripeInvoice.subscription === "string" ? stripeInvoice.subscription : null;
        if (!subId) break;

        let auraInvoice: { id: string; athlete_id: string | null; tenant_id: string } | null = null;
        try {
          const res = await supabase
            .from("invoices")
            .select("id, athlete_id, tenant_id")
            .eq("stripe_subscription_id", subId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
          auraInvoice = res.data ?? null;
        } catch { /* no matching invoice */ }

        if (auraInvoice) {
          await supabase.from("invoices").update({ status: "overdue", updated_at: now }).eq("id", auraInvoice.id);

          if (auraInvoice.athlete_id) {
            let athlete: { user_id: string | null; full_name: string; birth_date: string | null } | null = null;
            try {
              const res = await supabase
                .from("athletes")
                .select("user_id, full_name, birth_date")
                .eq("id", auraInvoice.athlete_id)
                .single();
              athlete = res.data ?? null;
            } catch { /* athlete not found */ }

            if (athlete) {
              const targetUserIds: string[] = [];
              if (athlete.user_id) targetUserIds.push(athlete.user_id);

              const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 18);
              const isMinor = athlete.birth_date ? new Date(athlete.birth_date) > cutoff : false;
              if (isMinor) {
                let guardianLinks: any[] = [];
                try {
                  const res = await supabase
                    .from("athlete_guardians")
                    .select("guardian:guardians(user_id)")
                    .eq("athlete_id", auraInvoice.athlete_id);
                  guardianLinks = res.data ?? [];
                } catch { /* ignore */ }
                for (const link of guardianLinks) {
                  const guardianUserId = (link.guardian as any)?.user_id;
                  if (guardianUserId) targetUserIds.push(guardianUserId);
                }
              }

              if (targetUserIds.length > 0) {
                const notifications = targetUserIds.map(userId => ({
                  tenant_id: auraInvoice!.tenant_id,
                  user_id: userId,
                  type: "payment_failed",
                  title: "Pagamento não processado",
                  body: `O pagamento de ${athlete.full_name} não foi processado. Verifique seu método de pagamento.`,
                  channels: { email: true, push: false },
                  reference_type: "invoice",
                  reference_id: auraInvoice!.id,
                }));
                try {
                  await supabase.from("notifications").insert(notifications);
                } catch { /* ignore */ }
              }
            }
          }
        }
        break;
      }

      // ── Subscription updated ─────────────────────────────────────────────────
      case "customer.subscription.updated": {
        const sub = event!.data.object as Stripe.Subscription;
        await supabase
          .from("invoices")
          .update({ stripe_subscription_id: sub.id, updated_at: now })
          .eq("stripe_subscription_id", sub.id);
        console.log(`subscription.updated: ${sub.id} status=${sub.status}`);
        break;
      }

      // ── Subscription deleted ──────────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event!.data.object as Stripe.Subscription;
        await supabase
          .from("invoices")
          .update({ status: "cancelled", updated_at: now })
          .eq("stripe_subscription_id", sub.id)
          .neq("status", "paid");
        break;
      }

      default:
        console.log(`club-webhook: unhandled event type ${event!.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("club-webhook: handler error:", err);
    return new Response(JSON.stringify({ error: err.message || "Handler error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
