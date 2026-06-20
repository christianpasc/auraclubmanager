import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-stripe-mode",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Maps the country names used in Settings.tsx (settings.country) to ISO 3166-1 alpha-2,
// which is what Stripe's accounts.create({ country }) expects.
const COUNTRY_TO_ISO: Record<string, string> = {
  Afghanistan: "AF", Albania: "AL", Algeria: "DZ", Angola: "AO", Argentina: "AR",
  Australia: "AU", Austria: "AT", Belgium: "BE", Bolivia: "BO", Brazil: "BR",
  Canada: "CA", Chile: "CL", China: "CN", Colombia: "CO", Croatia: "HR",
  "Czech Republic": "CZ", Denmark: "DK", Ecuador: "EC", Egypt: "EG", England: "GB",
  France: "FR", Germany: "DE", Ghana: "GH", Greece: "GR", Hungary: "HU",
  India: "IN", Indonesia: "ID", Iran: "IR", Ireland: "IE", Israel: "IL",
  Italy: "IT", Japan: "JP", Kenya: "KE", Mexico: "MX", Morocco: "MA",
  Netherlands: "NL", "New Zealand": "NZ", Nigeria: "NG", Norway: "NO", Paraguay: "PY",
  Peru: "PE", Poland: "PL", Portugal: "PT", Romania: "RO", Russia: "RU",
  "Saudi Arabia": "SA", Scotland: "GB", Senegal: "SN", Serbia: "RS", "South Africa": "ZA",
  "South Korea": "KR", Spain: "ES", Sweden: "SE", Switzerland: "CH", Turkey: "TR",
  Ukraine: "UA", "United Arab Emirates": "AE", "United States": "US", Uruguay: "UY", Venezuela: "VE",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const isLive = req.headers.get("x-stripe-mode") === "live";
    const stripeKey = isLive
      ? Deno.env.get("STRIPE_SECRET_KEY_LIVE")
      : Deno.env.get("STRIPE_SECRET_KEY_TEST");

    if (!stripeKey) {
      const mode = isLive ? "LIVE" : "TEST";
      return new Response(
        JSON.stringify({ error: `STRIPE_SECRET_KEY_${mode} not configured` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { tenant_id, return_url, refresh_url } = await req.json();

    if (!tenant_id || !return_url || !refresh_url) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: tenant_id, return_url, refresh_url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up existing connected account for this tenant
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("stripe_connect_account_id, settings")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let accountId: string = tenant.stripe_connect_account_id;

    if (!accountId) {
      // Create connected account with Standard behavior via controller properties.
      // Club is merchant of record: full dashboard, own disputes, own balance.
      const clubCountryName = (tenant.settings as any)?.country as string | undefined;
      const country = (clubCountryName && COUNTRY_TO_ISO[clubCountryName]) || "BR";

      const account = await stripe.accounts.create({
        country,
        controller: {
          losses: { payments: "stripe" },
          fees: { payer: "account" },
          stripe_dashboard: { type: "full" },
          requirement_collection: "stripe",
        },
        metadata: { tenant_id },
      } as any);
      accountId = account.id;

      await supabase
        .from("tenants")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", tenant_id);
    }

    // Create Account Link for onboarding (or re-onboarding if pending)
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      return_url,
      refresh_url,
      type: "account_onboarding",
    });

    return new Response(
      JSON.stringify({ url: accountLink.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    const stripeMsg = err?.raw?.message || err?.message || "Internal server error";
    console.error("club-connect-onboard error:", stripeMsg, JSON.stringify(err?.raw ?? {}));
    return new Response(
      JSON.stringify({ error: stripeMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
