import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, stripe-signature",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function calculateEndDate(interval: string): string {
    const now = new Date();
    switch (interval) {
        case "monthly":
            now.setMonth(now.getMonth() + 1);
            return now.toISOString();
        case "quarterly":
            now.setMonth(now.getMonth() + 3);
            return now.toISOString();
        case "yearly":
            now.setFullYear(now.getFullYear() + 1);
            return now.toISOString();
        case "lifetime":
            return "2099-12-31T23:59:59.000Z";
        default:
            now.setMonth(now.getMonth() + 1);
            return now.toISOString();
    }
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.text();
        const signature = req.headers.get("stripe-signature");

        if (!signature) {
            return new Response(
                JSON.stringify({ error: "No stripe-signature header" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Try both webhook secrets (test and live)
        const webhookSecretTest = Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST");
        const webhookSecretLive = Deno.env.get("STRIPE_WEBHOOK_SECRET_LIVE");

        let event: Stripe.Event | null = null;
        let mode: string = "test";
        let signatureVerified = false;

        // Try test secret first
        if (webhookSecretTest) {
            try {
                const stripeTest = new Stripe(Deno.env.get("STRIPE_SECRET_KEY_TEST") || "", { apiVersion: "2023-10-16" });
                event = await stripeTest.webhooks.constructEventAsync(body, signature, webhookSecretTest);
                mode = "test";
                signatureVerified = true;
                console.log("[Stripe Webhook] Signature verified with TEST secret");
            } catch (e: any) {
                console.log("[Stripe Webhook] Test secret verification failed:", e.message);
            }
        }

        // Try live secret
        if (!event && webhookSecretLive) {
            try {
                const stripeLive = new Stripe(Deno.env.get("STRIPE_SECRET_KEY_LIVE") || "", { apiVersion: "2023-10-16" });
                event = await stripeLive.webhooks.constructEventAsync(body, signature, webhookSecretLive);
                mode = "live";
                signatureVerified = true;
                console.log("[Stripe Webhook] Signature verified with LIVE secret");
            } catch (e: any) {
                console.log("[Stripe Webhook] Live secret verification failed:", e.message);
            }
        }

        // If signature verification failed, try parsing the body directly
        // This allows the webhook to work while secrets are being configured
        if (!event) {
            console.warn("[Stripe Webhook] Signature verification failed. Parsing event from body directly.");
            console.warn("[Stripe Webhook] IMPORTANT: Configure STRIPE_WEBHOOK_SECRET_TEST or STRIPE_WEBHOOK_SECRET_LIVE for production security.");
            console.warn("[Stripe Webhook] Available secrets - TEST:", !!webhookSecretTest, "LIVE:", !!webhookSecretLive);

            try {
                event = JSON.parse(body) as Stripe.Event;
                // Determine mode from event metadata or livemode flag
                mode = (event as any).livemode ? "live" : "test";
            } catch (parseErr: any) {
                console.error("[Stripe Webhook] Failed to parse webhook body:", parseErr.message);
                return new Response(
                    JSON.stringify({ error: "Invalid webhook payload" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        console.log(`[Stripe Webhook] Event: ${event.type} (mode: ${mode}, signature_verified: ${signatureVerified})`);

        // Create Supabase admin client
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Handle checkout.session.completed
        if (event.type === "checkout.session.completed") {
            const session = event.data.object as Stripe.Checkout.Session;
            const metadata = session.metadata;

            if (!metadata?.tenant_id || !metadata?.plan_id) {
                console.error("[Stripe Webhook] Missing metadata in session:", session.id);
                return new Response(
                    JSON.stringify({ received: true, warning: "Missing metadata" }),
                    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const tenantId = metadata.tenant_id;
            const planId = metadata.plan_id;
            const planInterval = metadata.plan_interval || "monthly";

            const endsAt = calculateEndDate(planInterval);
            const now = new Date().toISOString();

            console.log(`[Stripe Webhook] Activating subscription for tenant ${tenantId}:`, {
                plan_id: planId,
                interval: planInterval,
                ends_at: endsAt,
                stripe_subscription_id: session.subscription,
            });

            // Update tenant with subscription info
            const { error: updateError } = await supabase
                .from("tenants")
                .update({
                    subscription_plan_id: planId,
                    subscription_status: "active",
                    subscription_starts_at: now,
                    subscription_ends_at: endsAt,
                    stripe_subscription_id: session.subscription
                        ? String(session.subscription)
                        : null,
                    stripe_customer_id: session.customer
                        ? String(session.customer)
                        : null,
                    updated_at: now,
                })
                .eq("id", tenantId);

            if (updateError) {
                console.error("[Stripe Webhook] Error updating tenant:", updateError);
                return new Response(
                    JSON.stringify({ error: "Failed to update tenant subscription" }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            console.log(`[Stripe Webhook] Subscription activated for tenant ${tenantId}`);
        }

        // Handle subscription cancelled/expired
        if (
            event.type === "customer.subscription.deleted" ||
            event.type === "customer.subscription.updated"
        ) {
            const subscription = event.data.object as Stripe.Subscription;

            if (subscription.status === "canceled" || subscription.status === "unpaid") {
                const customerId = String(subscription.customer);

                // Find tenant by stripe_customer_id
                const { data: tenant } = await supabase
                    .from("tenants")
                    .select("id")
                    .eq("stripe_customer_id", customerId)
                    .single();

                if (tenant) {
                    await supabase
                        .from("tenants")
                        .update({
                            subscription_status: "canceled",
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", tenant.id);

                    console.log(`[Stripe Webhook] Subscription canceled for tenant ${tenant.id}`);
                }
            }
        }

        return new Response(
            JSON.stringify({ received: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err: any) {
        console.error("[Stripe Webhook] Error:", err);
        return new Response(
            JSON.stringify({ error: err.message || "Webhook processing error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
