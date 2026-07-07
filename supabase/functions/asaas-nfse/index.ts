import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Asaas Fase 6 — NFS-e (nota fiscal de serviço) issuance point, DISABLED by
// default behind the platform_settings 'asaas_nfse' flag. When the flag is
// off, the function short-circuits without ever calling Asaas. When on (and
// the club's municipal service config is set up in Asaas), it schedules an
// NFS-e for a paid member charge via POST /v3/invoices on the club subaccount.
//
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

    // ── Feature flag (off by default) ──
    const { data: flagRow } = await admin
      .from("platform_settings").select("value").eq("key", "asaas_nfse").maybeSingle();
    const enabled = !!(flagRow?.value as any)?.enabled;
    if (!enabled) {
      return json({ enabled: false, message: "A emissão de NFS-e está desativada." });
    }

    const env = (Deno.env.get("ASAAS_ENV") || "sandbox").toLowerCase();
    const encKeyB64 = Deno.env.get("ASAAS_ENCRYPTION_KEY");
    const baseUrl = ASAAS_BASE_URLS[env] || ASAAS_BASE_URLS.sandbox;
    if (!encKeyB64) return json({ error: "Chave de criptografia não configurada." }, 500);

    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { tenant_id, invoice_id, service_description } = await req.json();
    if (!tenant_id || !invoice_id) return json({ error: "Campos obrigatórios: tenant_id, invoice_id" }, 400);

    const { data: membership } = await admin
      .from("tenant_users").select("is_owner, role")
      .eq("tenant_id", tenant_id).eq("user_id", userData.user.id).maybeSingle();
    const isManager = membership && (membership.is_owner || ["owner", "admin"].includes(membership.role || ""));
    if (!isManager) return json({ error: "Apenas o proprietário ou administrador pode emitir NFS-e." }, 403);

    const { data: tenant } = await admin
      .from("tenants").select("asaas_subaccount_api_key_encrypted").eq("id", tenant_id).single();
    if (!tenant?.asaas_subaccount_api_key_encrypted) return json({ error: "Conta de recebimento não encontrada." }, 400);

    const { data: invoice } = await admin
      .from("invoices").select("id, amount, description, asaas_payment_id").eq("id", invoice_id).eq("tenant_id", tenant_id).single();
    if (!invoice) return json({ error: "Fatura não encontrada." }, 404);
    if (!invoice.asaas_payment_id) return json({ error: "Esta fatura ainda não tem um pagamento no Asaas." }, 400);

    const key = await importAesKey(encKeyB64);
    const subKey = await decryptSecret(tenant.asaas_subaccount_api_key_encrypted, key);

    // Schedule the service invoice, linked to the existing payment. Municipal
    // service config must exist on the subaccount, or Asaas returns an error
    // (surfaced below) — expected until the club sets it up.
    const res = await fetch(`${baseUrl}/invoices`, {
      method: "POST",
      headers: { access_token: subKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        payment: invoice.asaas_payment_id,
        serviceDescription: service_description || invoice.description || "Serviços esportivos",
        value: Number(invoice.amount),
        observations: "Emitida via Aura Club Manager",
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      const desc = body?.errors?.[0]?.description
        || "Não foi possível emitir a NFS-e. Verifique a configuração fiscal municipal da conta no Asaas.";
      return json({ error: desc }, 400);
    }

    return json({ enabled: true, success: true, nfse_id: body.id, status: body.status });
  } catch (err: any) {
    console.error("asaas-nfse error:", err?.message || err);
    return json({ error: err.message || "Internal server error" }, 500);
  }
});
