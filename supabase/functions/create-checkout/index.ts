import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const {
            plan_id,
            tenant_id,
            mode,
            success_url,
            cancel_url,
        } = await req.json();

        if (!plan_id || !tenant_id || !mode) {
            return new Response(
                JSON.stringify({ error: "Missing required fields: plan_id, tenant_id, mode" }),
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
                JSON.stringify({ error: `Stripe secret key not configured for mode: ${mode}. Please add STRIPE_SECRET_KEY_${mode.toUpperCase()} to Edge Function secrets.` }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const stripe = new Stripe(stripeSecretKey, {
            apiVersion: "2023-10-16",
        });

        // Create Supabase admin client
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get the plan from database
        const { data: plan, error: planError } = await supabase
            .from("stripe_plans")
            .select("*")
            .eq("id", plan_id)
            .single();

        if (planError || !plan) {
            return new Response(
                JSON.stringify({ error: "Plan not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get the correct price ID based on mode
        const priceId =
            mode === "live" ? plan.stripe_price_id_live : plan.stripe_price_id_test;

        if (!priceId) {
            return new Response(
                JSON.stringify({ error: `No Stripe Price ID configured for ${mode} mode on this plan` }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get or create Stripe customer for this tenant
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

        let customerId = tenant.stripe_customer_id;

        if (!customerId) {
            // Create a new Stripe customer
            const customer = await stripe.customers.create({
                name: tenant.name,
                metadata: {
                    tenant_id: tenant.id,
                    supabase_project: "aura-club-manager",
                },
            });
            customerId = customer.id;

            // Save customer ID to tenant
            await supabase
                .from("tenants")
                .update({ stripe_customer_id: customerId })
                .eq("id", tenant_id);
        }

        // Determine checkout mode based on plan interval
        const isOneTime = plan.interval === "lifetime";
        const checkoutMode = isOneTime ? "payment" : "subscription";

        // Create Checkout Session
        const sessionParams: any = {
            customer: customerId,
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: checkoutMode,
            success_url: success_url || `${req.headers.get("origin")}/#/plans?success=true`,
            cancel_url: cancel_url || `${req.headers.get("origin")}/#/plans?canceled=true`,
            metadata: {
                tenant_id: tenant_id,
                plan_id: plan_id,
                plan_interval: plan.interval,
                mode: mode,
            },
        };

        // For subscriptions, add subscription metadata
        if (checkoutMode === "subscription") {
            sessionParams.subscription_data = {
                metadata: {
                    tenant_id: tenant_id,
                    plan_id: plan_id,
                    plan_interval: plan.interval,
                },
            };
        }

        // For one-time payments, add payment intent metadata
        if (checkoutMode === "payment") {
            sessionParams.payment_intent_data = {
                metadata: {
                    tenant_id: tenant_id,
                    plan_id: plan_id,
                    plan_interval: plan.interval,
                },
            };
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

        return new Response(
            JSON.stringify({
                url: session.url,
                session_id: session.id,
            }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (err: any) {
        console.error("Error creating checkout session:", err);
        return new Response(
            JSON.stringify({ error: err.message || "Internal server error" }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
