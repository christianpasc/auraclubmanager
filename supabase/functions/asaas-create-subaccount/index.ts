import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Asaas Fase 3 — creates the club's own Asaas subaccount (subconta padrão) on
// the ROOT account (POST /v3/accounts). The returned apiKey is shown by Asaas
// only once: we encrypt it (AES-256-GCM) and store the ciphertext, never the
// plaintext (not in logs, not returned to the client). walletId is kept for
// future split/transfers. Owner/admin only.
//
// Secrets: ASAAS_ENV, ASAAS_API_KEY (root), ASAAS_ENCRYPTION_KEY (base64 32 bytes).

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

async function importAesKey(keyB64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("ASAAS_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt"]);
}

// Output format: base64(iv[12] || ciphertext+tag). Self-describing for decrypt.
async function encryptSecret(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plaintext);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc));
  const combined = new Uint8Array(iv.length + ct.length);
  combined.set(iv, 0);
  combined.set(ct, iv.length);
  let bin = "";
  for (const b of combined) bin += String.fromCharCode(b);
  return btoa(bin);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const env = (Deno.env.get("ASAAS_ENV") || "sandbox").toLowerCase();
    const apiKey = Deno.env.get("ASAAS_API_KEY");
    const encKeyB64 = Deno.env.get("ASAAS_ENCRYPTION_KEY");
    const baseUrl = ASAAS_BASE_URLS[env] || ASAAS_BASE_URLS.sandbox;
    if (!apiKey) return json({ error: "Integração Asaas não configurada." }, 500);
    if (!encKeyB64) return json({ error: "Chave de criptografia não configurada." }, 500);

    // Auth + owner/admin of the tenant
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { tenant_id } = body;
    if (!tenant_id) return json({ error: "Campo obrigatório: tenant_id" }, 400);

    const { data: membership } = await admin
      .from("tenant_users")
      .select("is_owner, role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    const isManager = membership && (membership.is_owner || ["owner", "admin"].includes(membership.role || ""));
    if (!isManager) return json({ error: "Apenas o proprietário ou administrador pode criar a conta de recebimento." }, 403);

    const { data: tenant } = await admin
      .from("tenants")
      .select("id, name, asaas_subaccount_id")
      .eq("id", tenant_id)
      .single();
    if (!tenant) return json({ error: "Clube não encontrado." }, 404);
    if (tenant.asaas_subaccount_id) {
      return json({ error: "Este clube já possui uma conta de recebimento." }, 400);
    }

    // Required fields for POST /v3/accounts
    const cpfCnpj = String(body.cpf_cnpj || "").replace(/\D/g, "");
    const required: Record<string, string> = {
      name: body.name || tenant.name,
      email: body.email,
      cpfCnpj,
      mobilePhone: String(body.mobile_phone || "").replace(/\D/g, ""),
      incomeValue: body.income_value,
      address: body.address,
      addressNumber: body.address_number,
      province: body.province,
      postalCode: String(body.postal_code || "").replace(/\D/g, ""),
    };
    for (const [k, v] of Object.entries(required)) {
      if (v === undefined || v === null || v === "") {
        return json({ error: `Campo obrigatório ausente: ${k}` }, 400);
      }
    }

    const accountPayload: Record<string, unknown> = {
      name: required.name,
      email: required.email,
      loginEmail: body.login_email || required.email,
      cpfCnpj,
      mobilePhone: required.mobilePhone,
      incomeValue: Number(required.incomeValue),
      address: required.address,
      addressNumber: required.addressNumber,
      complement: body.complement || undefined,
      province: required.province,
      postalCode: required.postalCode,
    };
    if (cpfCnpj.length === 14) {
      // CNPJ requires companyType
      accountPayload.companyType = body.company_type || "LIMITED";
    } else if (body.birth_date) {
      accountPayload.birthDate = body.birth_date;
    }

    const res = await fetch(`${baseUrl}/accounts`, {
      method: "POST",
      headers: { access_token: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(accountPayload),
    });
    const asaas = await res.json();

    if (!res.ok) {
      const desc = asaas?.errors?.[0]?.description || "Não foi possível criar a conta de recebimento no Asaas.";
      return json({ error: desc }, 400);
    }
    if (!asaas?.apiKey || !asaas?.id) {
      return json({ error: "Resposta inesperada do Asaas ao criar a conta." }, 502);
    }

    // Encrypt the one-time apiKey before persisting; never log/return it.
    const key = await importAesKey(encKeyB64);
    const encrypted = await encryptSecret(asaas.apiKey, key);

    const { error: updErr } = await admin
      .from("tenants")
      .update({
        asaas_subaccount_id: asaas.id,
        asaas_wallet_id: asaas.walletId || null,
        asaas_subaccount_api_key_encrypted: encrypted,
        asaas_charges_enabled: true,
      })
      .eq("id", tenant_id);
    if (updErr) return json({ error: `Conta criada, mas falhou ao salvar: ${updErr.message}` }, 500);

    return json({
      success: true,
      subaccount_id: asaas.id,
      // Regulatory note surfaced to the UI (BACEN 60-day evaluation window).
      evaluation_notice: "Durante o período de avaliação (até 60 dias), o Asaas pode aplicar limites de cobrança por conta. Você receberá um e-mail do Asaas para acessar seu painel.",
    });
  } catch (err: any) {
    console.error("asaas-create-subaccount error:", err?.message || err);
    return json({ error: err.message || "Internal server error" }, 500);
  }
});
