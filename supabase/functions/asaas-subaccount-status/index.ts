import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Reads the club subaccount's registration status and whatever documents Asaas
// is still waiting for.
//
// Creating the subaccount is only the start: Asaas holds it at PENDING until
// the owner sends documents, and each pending document carries an
// onboardingUrl — the link where the upload and the selfie actually happen.
// Without surfacing that link the club is stuck with no way forward inside
// Aura, dependent on a welcome email that may never arrive.
//
// Owner/admin only; the subaccount key is decrypted here and never returned.
// Secrets: ASAAS_ENCRYPTION_KEY.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-asaas-mode",
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

async function importAesKey(keyB64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("ASAAS_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
}

async function decryptSecret(payload: string, key: CryptoKey): Promise<string> {
  const combined = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: combined.slice(0, 12) },
    key,
    combined.slice(12),
  );
  return new TextDecoder().decode(pt);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const mode = (req.headers.get("x-asaas-mode") || Deno.env.get("ASAAS_ENV") || "sandbox").toLowerCase();
    const requestEnv = ["production", "prod", "live"].includes(mode) ? "production" : "sandbox";
    const baseUrl = ASAAS_BASE_URLS[requestEnv];

    const encKeyB64 = Deno.env.get("ASAAS_ENCRYPTION_KEY");
    if (!encKeyB64) return json({ error: "Chave de criptografia não configurada." }, 500);

    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { tenant_id } = await req.json();
    if (!tenant_id) return json({ error: "Campo obrigatório: tenant_id" }, 400);

    const { data: membership } = await admin
      .from("tenant_users")
      .select("is_owner, role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    const isManager = membership && (membership.is_owner || ["owner", "admin"].includes(membership.role || ""));
    if (!isManager) return json({ error: "Apenas o proprietário ou administrador pode ver o status da conta." }, 403);

    const { data: tenant } = await admin
      .from("tenants")
      .select("asaas_subaccount_id, asaas_subaccount_api_key_encrypted, asaas_subaccount_env")
      .eq("id", tenant_id)
      .single();
    if (!tenant?.asaas_subaccount_id || !tenant.asaas_subaccount_api_key_encrypted) {
      return json({ has_account: false });
    }

    const accountEnv = tenant.asaas_subaccount_env ?? "production";
    if (accountEnv !== requestEnv) {
      return json({
        has_account: true,
        env_mismatch: true,
        account_env: accountEnv,
        request_env: requestEnv,
      });
    }

    const key = await importAesKey(encKeyB64);
    const subKey = await decryptSecret(tenant.asaas_subaccount_api_key_encrypted, key);
    const asaasFetch = (path: string) =>
      fetch(`${baseUrl}${path}`, {
        headers: { access_token: subKey, "Content-Type": "application/json" },
      });

    // Registration status: four independent tracks, plus the overall verdict.
    let status: Record<string, unknown> | null = null;
    const statusRes = await asaasFetch("/myAccount/status");
    if (statusRes.ok) {
      const body = await statusRes.json();
      status = {
        general: body?.general ?? null,
        commercial_info: body?.commercialInfo ?? null,
        bank_account_info: body?.bankAccountInfo ?? null,
        documentation: body?.documentation ?? null,
      };
    } else {
      console.error("myAccount/status failed:", statusRes.status, await statusRes.text());
    }

    // Pending documents carry the link the owner must actually use; uploading
    // through the API is explicitly not the route when onboardingUrl is set.
    let onboardingUrl: string | null = null;
    const pending: Array<Record<string, unknown>> = [];
    const docsRes = await asaasFetch("/myAccount/documents");
    if (docsRes.ok) {
      const body = await docsRes.json();
      onboardingUrl = body?.onboardingUrl ?? null;
      for (const group of body?.data ?? []) {
        if (!onboardingUrl && group?.onboardingUrl) onboardingUrl = group.onboardingUrl;
        pending.push({
          type: group?.type ?? null,
          status: group?.status ?? null,
          title: group?.title ?? null,
        });
      }
    } else {
      console.error("myAccount/documents failed:", docsRes.status, await docsRes.text());
    }

    return json({
      has_account: true,
      env: accountEnv,
      subaccount_id: tenant.asaas_subaccount_id,
      status,
      onboarding_url: onboardingUrl,
      pending_documents: pending,
    });
  } catch (err: any) {
    console.error("asaas-subaccount-status error:", err?.message || err);
    return json({ error: err.message || "Internal server error" }, 500);
  }
});
