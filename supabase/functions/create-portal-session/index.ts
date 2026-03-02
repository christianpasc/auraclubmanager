import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { tenant_id, mode, return_url } = await req.json();

        if (!tenant_id || !mode) {
            return new Response(
                JSON.stringify({ error: "Missing required fields: tenant_id, mode" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Pick the correct Stripe secret key based on mode
        const stripeSecretKey =
            mode === "live"
                ? Deno.env.get("STRIPE_SECRET_KEY_LIVE")
                : Deno.env.get("STRIPE_SECRET_KEY_TEST");

        if (!stripeSecretKey) {
            return new Response(
                JSON.stringify({ error: `Stripe secret key not configured for mode: ${mode}` }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const stripe = new Stripe(stripeSecretKey, {
            apiVersion: "2023-10-16",
        });

        // Create Supabase admin client
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get tenant's Stripe customer ID
        const { data: tenant, error: tenantError } = await supabase
            .from("tenants")
            .select("id, name, stripe_customer_id")
            .eq("id", tenant_id)
            .single();

        if (tenantError || !tenant) {
            return new Response(
                JSON.stringify({ error: "Tenant not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!tenant.stripe_customer_id) {
            return new Response(
                JSON.stringify({ error: "No Stripe customer found for this tenant. Please subscribe to a plan first." }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Create a Stripe Customer Portal session
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: tenant.stripe_customer_id,
            return_url: return_url || `${req.headers.get("origin")}/#/subscription`,
        });

        return new Response(
            JSON.stringify({ url: portalSession.url }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (err: any) {
        console.error("Error creating portal session:", err);
        return new Response(
            JSON.stringify({ error: err.message || "Internal server error" }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
