import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-stripe-mode",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const isLive = req.headers.get("x-stripe-mode") === "live";
    const stripeKey = isLive
      ? Deno.env.get("STRIPE_SECRET_KEY_LIVE")
      : Deno.env.get("STRIPE_SECRET_KEY_TEST");

    if (!stripeKey) {
      return new Response(JSON.stringify({ error: `STRIPE_SECRET_KEY_${isLive ? "LIVE" : "TEST"} not configured` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { mode, tenant_id, invoice_id, order_id, success_url, cancel_url } = body;

    if (!mode || !tenant_id || !success_url || !cancel_url) {
      return new Response(JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const { data: tenant } = await supabase.from("tenants").select("stripe_connect_account_id, stripe_connect_currency").eq("id", tenant_id).single();
    if (!tenant?.stripe_connect_account_id) {
      return new Response(JSON.stringify({ error: "Tenant has no connected Stripe account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const connectedAccountId = tenant.stripe_connect_account_id;
    const currency = (tenant.stripe_connect_currency || "EUR").toLowerCase();

    // ── Subscription checkout (invoice) ──────────────────────────────────────
    if (mode === "subscription" && invoice_id) {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("*, athlete:athletes(full_name), school_plan:school_plans(*)")
        .eq("id", invoice_id)
        .single();

      if (!invoice) {
        return new Response(JSON.stringify({ error: "Invoice not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const priceIdField = isLive ? "stripe_live_price_id" : "stripe_price_id";
      const priceId = invoice.school_plan?.[priceIdField];

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        success_url: `${success_url}?invoice_id=${invoice_id}`,
        cancel_url,
        metadata: { invoice_id, tenant_id },
        // Also tag the underlying Subscription itself: invoice.paid can arrive
        // before checkout.session.completed (Stripe doesn't guarantee order), so
        // the webhook needs a way to recover invoice_id independent of timing.
        subscription_data: { metadata: { invoice_id, tenant_id } },
        ...(priceId
          ? { line_items: [{ price: priceId, quantity: 1 }] }
          : {
              line_items: [{
                price_data: {
                  currency,
                  product_data: { name: invoice.description || `Mensalidade` },
                  unit_amount: Math.round(Number(invoice.amount) * 100),
                  recurring: { interval: "month" as const },
                },
                quantity: 1,
              }],
            }
        ),
      };

      const session = await stripe.checkout.sessions.create(sessionParams, { stripeAccount: connectedAccountId });

      await supabase.from("invoices").update({ stripe_checkout_session_id: session.id }).eq("id", invoice_id);

      return new Response(JSON.stringify({ url: session.url, session_id: session.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── One-time payment checkout (order) ─────────────────────────────────────
    if (mode === "payment" && order_id) {
      const { data: order } = await supabase
        .from("orders")
        .select("*, order_items(*, product:products(name, base_price), variant:product_variants(name))")
        .eq("id", order_id)
        .single();

      if (!order) {
        return new Response(JSON.stringify({ error: "Order not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = (order.order_items || []).map((item: any) => ({
        price_data: {
          currency,
          product_data: {
            name: `${item.product?.name || "Item"}${item.variant?.name ? ` (${item.variant.name})` : ""}`,
          },
          unit_amount: Math.round(Number(item.unit_price || item.product?.base_price || 0) * 100),
        },
        quantity: item.quantity || 1,
      }));

      if (lineItems.length === 0) {
        lineItems.push({
          price_data: {
            currency,
            product_data: { name: `Pedido #${order_id.slice(0, 8)}` },
            unit_amount: Math.round(Number(order.total_amount || 0) * 100),
          },
          quantity: 1,
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: lineItems,
        success_url: `${success_url}?order_id=${order_id}`,
        cancel_url,
        customer_email: order.buyer_email || undefined,
        metadata: { order_id, tenant_id },
      }, { stripeAccount: connectedAccountId });

      await supabase.from("orders").update({ stripe_checkout_session_id: session.id }).eq("id", order_id);

      return new Response(JSON.stringify({ url: session.url, session_id: session.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid mode or missing ID" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("club-checkout error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
