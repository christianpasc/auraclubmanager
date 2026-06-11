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

        const webhookSecretTest = Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST");
        const webhookSecretLive = Deno.env.get("STRIPE_WEBHOOK_SECRET_LIVE");

        if (!webhookSecretTest && !webhookSecretLive) {
            console.error("[Stripe Webhook] FATAL: No webhook secrets configured. Set STRIPE_WEBHOOK_SECRET_TEST and/or STRIPE_WEBHOOK_SECRET_LIVE.");
            return new Response(
                JSON.stringify({ error: "Webhook secrets not configured on the server" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        let event: Stripe.Event | null = null;
        let mode: string = "test";

        if (webhookSecretTest) {
            try {
                const stripeTest = new Stripe(Deno.env.get("STRIPE_SECRET_KEY_TEST") || "", { apiVersion: "2023-10-16" });
                event = await stripeTest.webhooks.constructEventAsync(body, signature, webhookSecretTest);
                mode = "test";
                console.log("[Stripe Webhook] Signature verified with TEST secret");
            } catch (e: any) {
                console.log("[Stripe Webhook] Test secret verification failed:", e.message);
            }
        }

        if (!event && webhookSecretLive) {
            try {
                const stripeLive = new Stripe(Deno.env.get("STRIPE_SECRET_KEY_LIVE") || "", { apiVersion: "2023-10-16" });
                event = await stripeLive.webhooks.constructEventAsync(body, signature, webhookSecretLive);
                mode = "live";
                console.log("[Stripe Webhook] Signature verified with LIVE secret");
            } catch (e: any) {
                console.log("[Stripe Webhook] Live secret verification failed:", e.message);
            }
        }

        if (!event) {
            console.error("[Stripe Webhook] Signature verification failed for all configured secrets. Rejecting event.");
            return new Response(
                JSON.stringify({ error: "Invalid webhook signature" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`[Stripe Webhook] Event: ${event.type} (mode: ${mode})`);

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Helper: find tenant by Stripe customer ID (respects test vs live)
        const isLive = (event as any).livemode === true;
        const customerField = isLive ? "stripe_customer_id" : "stripe_customer_id_test";

        const findTenantByCustomer = async (customerId: string) => {
            const { data } = await supabase
                .from("tenants")
                .select("id, subscription_plan_id")
                .eq(customerField, customerId)
                .maybeSingle();
            return data;
        };

        // ── checkout.session.completed → activate subscription ─────────────────
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

            console.log(`[Stripe Webhook] Activating subscription for tenant ${tenantId}`);

            const updatePayload: Record<string, any> = {
                subscription_plan_id: planId,
                subscription_status: "active",
                subscription_starts_at: now,
                subscription_ends_at: endsAt,
                stripe_subscription_id: session.subscription ? String(session.subscription) : null,
                updated_at: now,
            };
            if (isLive && session.customer) updatePayload.stripe_customer_id = String(session.customer);
            if (!isLive && session.customer) updatePayload.stripe_customer_id_test = String(session.customer);

            const { error: updateError } = await supabase
                .from("tenants")
                .update(updatePayload)
                .eq("id", tenantId);

            if (updateError) {
                console.error("[Stripe Webhook] Error activating subscription:", updateError);
                return new Response(
                    JSON.stringify({ error: "Failed to activate subscription" }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            console.log(`[Stripe Webhook] Subscription activated for tenant ${tenantId} until ${endsAt}`);
        }

        // ── invoice.paid → renew subscription end date ─────────────────────────
        if (event.type === "invoice.paid") {
            const invoice = event.data.object as Stripe.Invoice;

            if (invoice.subscription && invoice.status === "paid") {
                const customerId = String(invoice.customer);
                const periodEnd = (invoice as any).period_end as number | undefined;

                if (!periodEnd) {
                    console.log("[Stripe Webhook] invoice.paid: no period_end, skipping");
                } else {
                    const tenant = await findTenantByCustomer(customerId);

                    if (tenant) {
                        const newEndsAt = new Date(periodEnd * 1000).toISOString();
                        const { error } = await supabase
                            .from("tenants")
                            .update({
                                subscription_status: "active",
                                subscription_ends_at: newEndsAt,
                                updated_at: new Date().toISOString(),
                            })
                            .eq("id", tenant.id);

                        if (error) {
                            console.error("[Stripe Webhook] Error renewing subscription:", error);
                        } else {
                            console.log(`[Stripe Webhook] Subscription renewed for tenant ${tenant.id} until ${newEndsAt}`);
                        }
                    } else {
                        console.warn(`[Stripe Webhook] invoice.paid: tenant not found for customer ${customerId}`);
                    }
                }
            }
        }

        // ── invoice.payment_failed → mark as past_due after 3 attempts ─────────
        if (event.type === "invoice.payment_failed") {
            const invoice = event.data.object as Stripe.Invoice;
            const attempt = (invoice as any).attempt_count as number || 1;

            if (invoice.subscription && attempt >= 3) {
                const customerId = String(invoice.customer);
                const tenant = await findTenantByCustomer(customerId);

                if (tenant) {
                    await supabase
                        .from("tenants")
                        .update({
                            subscription_status: "past_due",
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", tenant.id);
                    console.log(`[Stripe Webhook] Marked tenant ${tenant.id} as past_due after ${attempt} failed attempts`);
                }
            }
        }

        // ── customer.subscription.updated / deleted → handle status changes ────
        if (
            event.type === "customer.subscription.deleted" ||
            event.type === "customer.subscription.updated"
        ) {
            const subscription = event.data.object as Stripe.Subscription;
            const customerId = String(subscription.customer);
            const tenant = await findTenantByCustomer(customerId);

            if (!tenant) {
                console.warn(`[Stripe Webhook] ${event.type}: tenant not found for customer ${customerId}`);
            } else {
                const revokeStatuses = ["canceled", "unpaid", "incomplete_expired"];
                const restoreStatuses = ["active", "trialing"];

                if (revokeStatuses.includes(subscription.status)) {
                    await supabase
                        .from("tenants")
                        .update({
                            subscription_status: "canceled",
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", tenant.id);
                    console.log(`[Stripe Webhook] Subscription revoked for tenant ${tenant.id} (status: ${subscription.status})`);
                } else if (subscription.status === "past_due") {
                    await supabase
                        .from("tenants")
                        .update({
                            subscription_status: "past_due",
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", tenant.id);
                    console.log(`[Stripe Webhook] Subscription past_due for tenant ${tenant.id}`);
                } else if (restoreStatuses.includes(subscription.status)) {
                    const periodEnd = subscription.current_period_end;
                    const newEndsAt = new Date(periodEnd * 1000).toISOString();
                    await supabase
                        .from("tenants")
                        .update({
                            subscription_status: "active",
                            subscription_ends_at: newEndsAt,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", tenant.id);
                    console.log(`[Stripe Webhook] Subscription restored to active for tenant ${tenant.id}`);
                }
            }
        }

        return new Response(
            JSON.stringify({ received: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err: any) {
        console.error("[Stripe Webhook] Unhandled error:", err);
        return new Response(
            JSON.stringify({ error: err.message || "Webhook processing error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
