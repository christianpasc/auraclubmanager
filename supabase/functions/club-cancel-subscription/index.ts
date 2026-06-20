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
      return new Response(JSON.stringify({ error: "Stripe key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { tenant_id, subscription_id } = await req.json();
    if (!tenant_id || !subscription_id) {
      return new Response(JSON.stringify({ error: "Missing tenant_id or subscription_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const { data: tenant } = await supabase.from("tenants").select("stripe_connect_account_id").eq("id", tenant_id).single();
    if (!tenant?.stripe_connect_account_id) {
      return new Response(JSON.stringify({ error: "Tenant has no connected Stripe account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await stripe.subscriptions.cancel(subscription_id, { stripeAccount: tenant.stripe_connect_account_id });

    await supabase
      .from("invoices")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("stripe_subscription_id", subscription_id)
      .eq("tenant_id", tenant_id)
      .neq("status", "paid");

    return new Response(JSON.stringify({ cancelled: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("club-cancel-subscription error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
