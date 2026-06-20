import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Exchanges the OAuth authorization code for a Stripe Standard connected account.
// Called by the frontend after the club owner completes Stripe's OAuth flow.

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
      ? Deno.env.get("STRIPE_CONNECT_SECRET_KEY_LIVE")
      : Deno.env.get("STRIPE_CONNECT_SECRET_KEY_TEST");

    if (!stripeKey) {
      const mode = isLive ? "LIVE" : "TEST";
      return new Response(
        JSON.stringify({ error: `STRIPE_CONNECT_SECRET_KEY_${mode} not configured` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { code, tenant_id } = await req.json();

    if (!code || !tenant_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: code, tenant_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify the tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Exchange authorization code for connected account credentials
    const oauthResponse = await stripe.oauth.token({
      grant_type: "authorization_code",
      code,
    });

    const connectedAccountId = oauthResponse.stripe_user_id;
    if (!connectedAccountId) {
      return new Response(
        JSON.stringify({ error: "Stripe did not return a connected account ID" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch account details to get current charges/payouts status
    const account = await stripe.accounts.retrieve(connectedAccountId);

    // Save connected account to tenant
    await supabase
      .from("tenants")
      .update({
        stripe_connect_account_id: connectedAccountId,
        stripe_connect_charges_enabled: account.charges_enabled ?? false,
        stripe_connect_payouts_enabled: account.payouts_enabled ?? false,
      })
      .eq("id", tenant_id);

    return new Response(
      JSON.stringify({
        account_id: connectedAccountId,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("club-connect-oauth-callback error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
