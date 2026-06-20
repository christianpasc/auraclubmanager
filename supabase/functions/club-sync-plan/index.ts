import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-stripe-mode",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const INTERVAL_MAP: Record<string, { interval: Stripe.PriceCreateParams.Recurring.Interval; interval_count: number }> = {
  monthly:    { interval: "month", interval_count: 1 },
  quarterly:  { interval: "month", interval_count: 3 },
  semiannual: { interval: "month", interval_count: 6 },
  annual:     { interval: "year",  interval_count: 1 },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const isLive = req.headers.get("x-stripe-mode") === "live";
    const stripeKey = isLive
      ? Deno.env.get("STRIPE_SECRET_KEY_LIVE")
      : Deno.env.get("STRIPE_SECRET_KEY_TEST");

    if (!stripeKey) {
      return new Response(JSON.stringify({ error: `STRIPE_CONNECT_SECRET_KEY_${isLive ? "LIVE" : "TEST"} not configured` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { plan_id, tenant_id } = await req.json();
    if (!plan_id || !tenant_id) {
      return new Response(JSON.stringify({ error: "Missing plan_id or tenant_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: tenant } = await supabase.from("tenants").select("stripe_connect_account_id, stripe_connect_charges_enabled").eq("id", tenant_id).single();
    if (!tenant?.stripe_connect_account_id) {
      return new Response(JSON.stringify({ error: "Tenant has no Stripe connected account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: plan } = await supabase.from("school_plans").select("*").eq("id", plan_id).single();
    if (!plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const connectedAccountId = tenant.stripe_connect_account_id;

    const productIdField = isLive ? "stripe_live_product_id" : "stripe_product_id";
    const priceIdField = isLive ? "stripe_live_price_id" : "stripe_price_id";
    const existingProductId = plan[productIdField];

    let productId: string;
    if (existingProductId) {
      await stripe.products.update(existingProductId, { name: plan.name, description: plan.description || undefined },
        { stripeAccount: connectedAccountId });
      productId = existingProductId;
    } else {
      const product = await stripe.products.create(
        { name: plan.name, description: plan.description || undefined, metadata: { plan_id, tenant_id } },
        { stripeAccount: connectedAccountId }
      );
      productId = product.id;
    }

    const amountInCents = Math.round(Number(plan.amount) * 100);
    const currency = (plan.currency || "EUR").toLowerCase();
    const recurringDef = INTERVAL_MAP[plan.interval];

    const priceParams: Stripe.PriceCreateParams = {
      product: productId,
      unit_amount: amountInCents,
      currency,
      ...(recurringDef && plan.interval !== "one_time" ? { recurring: recurringDef } : {}),
      metadata: { plan_id, tenant_id },
    };

    const price = await stripe.prices.create(priceParams, { stripeAccount: connectedAccountId });

    const update: Record<string, string> = {
      [productIdField]: productId,
      [priceIdField]: price.id,
      updated_at: new Date().toISOString(),
    };
    await supabase.from("school_plans").update(update).eq("id", plan_id);

    return new Response(JSON.stringify({ stripe_product_id: productId, stripe_price_id: price.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("club-sync-plan error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
