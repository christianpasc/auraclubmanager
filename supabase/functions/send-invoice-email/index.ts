import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Sends the hosted payment page link (/pay/:invoiceId) to the athlete (or their
// guardian, if a minor) by email via Resend. Mirrors send-invitations' pattern.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Matches the app's selected-language pattern (LanguageContext) for outbound emails.
// Falls back to pt-BR — same default the app itself uses.
type Lang = "pt-BR" | "pt-PT" | "en-US" | "es-ES" | "fr-FR";

const I18N: Record<Lang, {
  subject: (club: string) => string;
  greeting: (name: string) => string;
  intro: (club: string) => string;
  plan: string;
  amount: string;
  dueDate: string;
  payNow: string;
  directLink: string;
  defaultPlanName: string;
}> = {
  "pt-BR": {
    subject: (club) => `Cobrança de mensalidade — ${club}`,
    greeting: (name) => `Olá, <strong>${name}</strong>!`,
    intro: (club) => `Você tem uma cobrança de mensalidade do <strong>${club}</strong>:`,
    plan: "Plano", amount: "Valor", dueDate: "Vencimento",
    payNow: "Pagar agora", directLink: "Link direto:", defaultPlanName: "Mensalidade",
  },
  "pt-PT": {
    subject: (club) => `Cobrança de mensalidade — ${club}`,
    greeting: (name) => `Olá, <strong>${name}</strong>!`,
    intro: (club) => `Tem uma cobrança de mensalidade do <strong>${club}</strong>:`,
    plan: "Plano", amount: "Valor", dueDate: "Vencimento",
    payNow: "Pagar agora", directLink: "Link direto:", defaultPlanName: "Mensalidade",
  },
  "en-US": {
    subject: (club) => `Monthly fee billing — ${club}`,
    greeting: (name) => `Hello, <strong>${name}</strong>!`,
    intro: (club) => `You have a monthly fee billing from <strong>${club}</strong>:`,
    plan: "Plan", amount: "Amount", dueDate: "Due date",
    payNow: "Pay now", directLink: "Direct link:", defaultPlanName: "Monthly fee",
  },
  "es-ES": {
    subject: (club) => `Cobro de cuota mensual — ${club}`,
    greeting: (name) => `Hola, <strong>${name}</strong>!`,
    intro: (club) => `Tienes un cobro de cuota mensual de <strong>${club}</strong>:`,
    plan: "Plan", amount: "Importe", dueDate: "Vencimiento",
    payNow: "Pagar ahora", directLink: "Enlace directo:", defaultPlanName: "Cuota mensual",
  },
  "fr-FR": {
    subject: (club) => `Facturation de la cotisation — ${club}`,
    greeting: (name) => `Bonjour, <strong>${name}</strong> !`,
    intro: (club) => `Vous avez une facturation de cotisation de <strong>${club}</strong> :`,
    plan: "Forfait", amount: "Montant", dueDate: "Échéance",
    payNow: "Payer maintenant", directLink: "Lien direct :", defaultPlanName: "Cotisation",
  },
};

function resolveLang(value: unknown): Lang {
  return (typeof value === "string" && value in I18N) ? (value as Lang) : "pt-BR";
}

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
      .select("id, athlete_id, description, amount, due_date, tenant:tenants(name, settings, stripe_connect_currency)")
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

    const tenant = invoice.tenant as any;
    const lang = resolveLang(tenant?.settings?.language);
    const L = I18N[lang];
    const currency = tenant?.stripe_connect_currency || "EUR";

    const payUrl = `${base_url}/#/pay/${invoice.id}`;
    const clubName = tenant?.name || "Aura Club Manager";
    const dueDateLabel = new Date(invoice.due_date + "T00:00:00").toLocaleDateString(lang);

    if (resendApiKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${clubName} <noreply@auraclubmanager.io>`,
          to: [recipientEmail],
          subject: L.subject(clubName),
          html: `
            <p>${L.greeting(recipientName)}</p>
            <p>${L.intro(clubName)}</p>
            <p><strong>${L.plan}:</strong> ${invoice.description || L.defaultPlanName}<br/>
               <strong>${L.amount}:</strong> ${currency} ${Number(invoice.amount).toFixed(2)}<br/>
               <strong>${L.dueDate}:</strong> ${dueDateLabel}</p>
            <p>
              <a href="${payUrl}"
                 style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px">
                ${L.payNow}
              </a>
            </p>
            <hr/>
            <p style="color:#888;font-size:12px;">${L.directLink} <a href="${payUrl}">${payUrl}</a></p>
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
