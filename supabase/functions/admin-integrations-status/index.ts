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

    const status = {
      stripe: {
        test: !!Deno.env.get("STRIPE_SECRET_KEY_TEST"),
        live: !!Deno.env.get("STRIPE_SECRET_KEY_LIVE"),
        webhook_test: !!Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST"),
        webhook_live: !!Deno.env.get("STRIPE_WEBHOOK_SECRET_LIVE"),
      },
      stripe_connect: {
        test: !!Deno.env.get("STRIPE_CONNECT_SECRET_KEY_TEST"),
        live: !!Deno.env.get("STRIPE_CONNECT_SECRET_KEY_LIVE"),
      },
      resend: {
        configured: !!Deno.env.get("RESEND_API_KEY"),
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
