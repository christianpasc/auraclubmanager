import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Matches the app's selected-language pattern (LanguageContext) for outbound emails.
// Falls back to pt-BR — same default the app itself uses.
type Lang = "pt-BR" | "pt-PT" | "en-US" | "es-ES" | "fr-FR";

const I18N: Record<Lang, {
  subject: (event: string) => string;
  greeting: (name: string) => string;
  eventLabel: string;
  confirm: string;
  directLink: string;
  defaultEvent: string;
}> = {
  "pt-BR": { subject: (e) => `Você foi convidado: ${e}`, greeting: (n) => `Olá, <strong>${n}</strong>!`, eventLabel: "Evento", confirm: "Confirmar presença", directLink: "Link direto:", defaultEvent: "Evento" },
  "pt-PT": { subject: (e) => `Foi convidado: ${e}`, greeting: (n) => `Olá, <strong>${n}</strong>!`, eventLabel: "Evento", confirm: "Confirmar presença", directLink: "Link direto:", defaultEvent: "Evento" },
  "en-US": { subject: (e) => `You're invited: ${e}`, greeting: (n) => `Hello, <strong>${n}</strong>!`, eventLabel: "Event", confirm: "Confirm attendance", directLink: "Direct link:", defaultEvent: "Event" },
  "es-ES": { subject: (e) => `Has sido invitado: ${e}`, greeting: (n) => `Hola, <strong>${n}</strong>!`, eventLabel: "Evento", confirm: "Confirmar asistencia", directLink: "Enlace directo:", defaultEvent: "Evento" },
  "fr-FR": { subject: (e) => `Vous êtes invité : ${e}`, greeting: (n) => `Bonjour, <strong>${n}</strong> !`, eventLabel: "Événement", confirm: "Confirmer la présence", directLink: "Lien direct :", defaultEvent: "Événement" },
};

function resolveLang(value: unknown): Lang {
  return (typeof value === "string" && value in I18N) ? (value as Lang) : "pt-BR";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const { invitationIds, baseUrl } = await req.json() as {
      invitationIds: string[];
      baseUrl: string;
    };

    if (!invitationIds?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: invitations } = await supabase
      .from("invitations")
      .select("id, name, email, token, event_title, event_date, club_name, message, tenant:tenants(settings)")
      .in("id", invitationIds);

    if (!invitations?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;

    for (const inv of invitations) {
      if (!inv.email) continue;

      const lang = resolveLang((inv.tenant as any)?.settings?.language);
      const L = I18N[lang];

      const inviteUrl = `${baseUrl}/#/invite/${inv.token}`;
      const eventInfo = inv.event_title
        ? `<p><strong>${L.eventLabel}:</strong> ${inv.event_title}${inv.event_date ? ` — ${new Date(inv.event_date).toLocaleDateString(lang)}` : ""}</p>`
        : "";
      const clubLabel = inv.club_name || "Aura Club Manager";

      if (resendApiKey) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${clubLabel} <noreply@auraclubmanager.io>`,
            to: [inv.email],
            subject: L.subject(inv.event_title || L.defaultEvent),
            html: `
              <p>${L.greeting(inv.name)}</p>
              ${inv.message ? `<p>${inv.message}</p>` : ""}
              ${eventInfo}
              <p>
                <a href="${inviteUrl}"
                   style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px">
                  ${L.confirm}
                </a>
              </p>
              <hr/>
              <p style="color:#888;font-size:12px;">
                ${L.directLink} <a href="${inviteUrl}">${inviteUrl}</a>
              </p>
            `,
          }),
        });
        if (res.ok) sent++;
        else console.error("Resend error for", inv.email, await res.text());
      } else {
        console.log(`[dev] Would send invite to ${inv.email}: ${inviteUrl}`);
        sent++;
      }
    }

    return new Response(JSON.stringify({ sent, total: invitations.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-invitations error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
