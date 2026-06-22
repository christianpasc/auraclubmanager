import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Sends the hosted payment page link (/pay/:invoiceId) to the athlete (or their
// guardian, if a minor) by email via Resend. Mirrors send-invitations' pattern.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { invoice_id, base_url } = await req.json() as { invoice_id: string; base_url: string };
    if (!invoice_id || !base_url) {
      return new Response(JSON.stringify({ error: "Missing invoice_id or base_url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, athlete_id, description, amount, due_date, tenant:tenants(name)")
      .eq("id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let recipientEmail: string | null = null;
    let recipientName = "";

    if (invoice.athlete_id) {
      const { data: athlete } = await supabase
        .from("athletes")
        .select("full_name, email, birth_date")
        .eq("id", invoice.athlete_id)
        .single();

      if (athlete) {
        recipientName = athlete.full_name;
        const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 18);
        const isMinor = athlete.birth_date ? new Date(athlete.birth_date) > cutoff : false;

        if (isMinor) {
          const { data: guardianLink } = await supabase
            .from("athlete_guardians")
            .select("guardian:guardians(full_name, email)")
            .eq("athlete_id", invoice.athlete_id)
            .eq("is_primary", true)
            .maybeSingle();

          const guardian = (guardianLink as any)?.guardian;
          if (guardian?.email) {
            recipientEmail = guardian.email;
            recipientName = guardian.full_name || recipientName;
          }
        } else if (athlete.email) {
          recipientEmail = athlete.email;
        }
      }
    }

    if (!recipientEmail) {
      return new Response(JSON.stringify({ sent: false, reason: "no_email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payUrl = `${base_url}/#/pay/${invoice.id}`;
    const clubName = (invoice.tenant as any)?.name || "Aura Club Manager";
    const dueDateLabel = new Date(invoice.due_date + "T00:00:00").toLocaleDateString("pt-BR");

    if (resendApiKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${clubName} <noreply@auraclubmanager.io>`,
          to: [recipientEmail],
          subject: `Cobrança de mensalidade — ${clubName}`,
          html: `
            <p>Olá, <strong>${recipientName}</strong>!</p>
            <p>Você tem uma cobrança de mensalidade do <strong>${clubName}</strong>:</p>
            <p><strong>Plano:</strong> ${invoice.description || "Mensalidade"}<br/>
               <strong>Valor:</strong> R$ ${Number(invoice.amount).toFixed(2)}<br/>
               <strong>Vencimento:</strong> ${dueDateLabel}</p>
            <p>
              <a href="${payUrl}"
                 style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px">
                Pagar agora
              </a>
            </p>
            <hr/>
            <p style="color:#888;font-size:12px;">Link direto: <a href="${payUrl}">${payUrl}</a></p>
          `,
        }),
      });
      if (!res.ok) {
        console.error("Resend error:", await res.text());
        return new Response(JSON.stringify({ sent: false, reason: "resend_error" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      console.log(`[dev] Would send invoice email to ${recipientEmail}: ${payUrl}`);
    }

    return new Response(JSON.stringify({ sent: true, email: recipientEmail, url: payUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("send-invoice-email error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
