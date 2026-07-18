import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Asaas root-account connectivity check (Fase 1). Super-admin only.
// Environment is chosen per-request by the x-asaas-mode header (sent from the
// client based on hostname: localhost → sandbox, else production), so both
// keys can live side by side with no secret swapping. Secrets:
//   ASAAS_API_KEY_SANDBOX / ASAAS_API_KEY_PROD  (preferred, per environment)
//   ASAAS_API_KEY + ASAAS_ENV                   (legacy single-key fallback)
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

// Per-request environment: x-asaas-mode header wins (client picks by hostname),
// then legacy ASAAS_ENV. Root key comes from the mode-specific secret, falling
// back to the single ASAAS_API_KEY for backward compatibility.
function resolveAsaas(req: Request): { env: string; baseUrl: string; rootKey: string | undefined } {
  const mode = (req.headers.get("x-asaas-mode") || Deno.env.get("ASAAS_ENV") || "sandbox").toLowerCase();
  const production = mode === "production" || mode === "prod" || mode === "live";
  const env = production ? "production" : "sandbox";
  const baseUrl = production ? ASAAS_BASE_URLS.production : ASAAS_BASE_URLS.sandbox;
  const rootKey = production
    ? (Deno.env.get("ASAAS_API_KEY_PROD") || Deno.env.get("ASAAS_API_KEY"))
    : (Deno.env.get("ASAAS_API_KEY_SANDBOX") || Deno.env.get("ASAAS_API_KEY"));
  return { env, baseUrl, rootKey };
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

    const { env, baseUrl, rootKey: apiKey } = resolveAsaas(req);

    if (!apiKey) {
      return json({ configured: false, env, connected: false, error: `Chave da conta-raiz Asaas não configurada para ${env}` });
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
