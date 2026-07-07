import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Asaas root-account connectivity check (Fase 1). Super-admin only.
// Secrets expected (Supabase edge function secrets — never in code):
//   ASAAS_ENV      = 'sandbox' | 'production' (defaults to sandbox)
//   ASAAS_API_KEY  = root-account API key for that environment
// Verifies the key by calling GET /v3/finance/balance on the chosen base URL.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ASAAS_BASE_URLS: Record<string, string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await admin
      .from("profiles")
      .select("is_super_admin")
      .eq("id", userData.user.id)
      .single();
    if (!profile?.is_super_admin) return json({ error: "Unauthorized: not a super admin" }, 403);

    const env = (Deno.env.get("ASAAS_ENV") || "sandbox").toLowerCase();
    const apiKey = Deno.env.get("ASAAS_API_KEY");
    const baseUrl = ASAAS_BASE_URLS[env] || ASAAS_BASE_URLS.sandbox;

    if (!apiKey) {
      return json({ configured: false, env, connected: false, error: "ASAAS_API_KEY não configurada" });
    }

    const res = await fetch(`${baseUrl}/finance/balance`, {
      headers: { access_token: apiKey, "Content-Type": "application/json" },
    });

    if (!res.ok) {
      return json({
        configured: true,
        env,
        connected: false,
        error: `Asaas respondeu ${res.status} — verifique a API key e o ambiente`,
      });
    }

    return json({ configured: true, env, connected: true });
  } catch (err: any) {
    console.error("asaas-status error:", err);
    return json({ error: err.message || "Internal server error" }, 500);
  }
});
