import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Asaas Fase 4 — cancels a member's recurring subscription on the club's
// subaccount, and marks its still-unpaid invoices as cancelled.
// Secrets: ASAAS_ENV, ASAAS_ENCRYPTION_KEY.

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
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function importAesKey(keyB64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("ASAAS_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
}
async function decryptSecret(payload: string, key: CryptoKey): Promise<string> {
  const combined = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: combined.slice(0, 12) }, key, combined.slice(12));
  return new TextDecoder().decode(pt);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const env = (Deno.env.get("ASAAS_ENV") || "sandbox").toLowerCase();
    const encKeyB64 = Deno.env.get("ASAAS_ENCRYPTION_KEY");
    const baseUrl = ASAAS_BASE_URLS[env] || ASAAS_BASE_URLS.sandbox;
    if (!encKeyB64) return json({ error: "Chave de criptografia não configurada." }, 500);

    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { tenant_id, subscription_id } = await req.json();
    if (!tenant_id || !subscription_id) return json({ error: "Campos obrigatórios: tenant_id, subscription_id" }, 400);

    const { data: membership } = await admin
      .from("tenant_users").select("is_owner, role")
      .eq("tenant_id", tenant_id).eq("user_id", userData.user.id).maybeSingle();
    const isManager = membership && (membership.is_owner || ["owner", "admin"].includes(membership.role || ""));
    if (!isManager) return json({ error: "Apenas o proprietário ou administrador pode cancelar." }, 403);

    const { data: tenant } = await admin
      .from("tenants").select("asaas_subaccount_api_key_encrypted").eq("id", tenant_id).single();
    if (!tenant?.asaas_subaccount_api_key_encrypted) return json({ error: "Conta de recebimento não encontrada." }, 400);

    const key = await importAesKey(encKeyB64);
    const subKey = await decryptSecret(tenant.asaas_subaccount_api_key_encrypted, key);

    const res = await fetch(`${baseUrl}/subscriptions/${subscription_id}`, {
      method: "DELETE",
      headers: { access_token: subKey, "Content-Type": "application/json" },
    });
    const body = await res.json();
    if (!res.ok) return json({ error: body?.errors?.[0]?.description || "Erro ao cancelar assinatura no Asaas." }, 400);

    await admin.from("invoices")
      .update({ status: "cancelled" })
      .eq("tenant_id", tenant_id)
      .eq("asaas_subscription_id", subscription_id)
      .neq("status", "paid");

    return json({ success: true });
  } catch (err: any) {
    console.error("asaas-club-cancel-subscription error:", err?.message || err);
    return json({ error: err.message || "Internal server error" }, 500);
  }
});
