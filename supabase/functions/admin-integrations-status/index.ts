import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Returns presence-only status for third-party integrations — never the secret
// values themselves. Superadmin-only (checked via the caller's JWT).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userData, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", userData.user.id)
      .single();

    if (!profile?.is_super_admin) {
      return new Response(JSON.stringify({ error: "Unauthorized: not a super admin" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const has = (key: string) => !!Deno.env.get(key);

    const status = {
      stripe: {
        test: has("STRIPE_SECRET_KEY_TEST"),
        live: has("STRIPE_SECRET_KEY_LIVE"),
        webhook_test: has("STRIPE_WEBHOOK_SECRET_TEST"),
        webhook_live: has("STRIPE_WEBHOOK_SECRET_LIVE"),
      },
      stripe_connect: {
        test: has("STRIPE_CONNECT_SECRET_KEY_TEST"),
        live: has("STRIPE_CONNECT_SECRET_KEY_LIVE"),
      },
      // Asaas is the Brazilian rail — without these four the whole BR market
      // cannot be billed, so they get first-class visibility here.
      asaas: {
        env: Deno.env.get("ASAAS_ENV") ?? null,
        api_key: has("ASAAS_API_KEY"),
        encryption_key: has("ASAAS_ENCRYPTION_KEY"),
        webhook_token: has("ASAAS_WEBHOOK_TOKEN"),
      },
      resend: {
        configured: has("RESEND_API_KEY"),
      },
      trial_emails: {
        cron_token: has("TRIAL_CRON_TOKEN"),
      },
    };

    return new Response(JSON.stringify(status),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("admin-integrations-status error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
