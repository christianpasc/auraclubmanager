import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { COPY, resolveLang, renderHtml, type Stage } from "./copy.ts";

// Daily trial lifecycle emails. Reads the clubs due a nudge from
// get_trial_email_targets() (which already excludes anyone paid, cancelled,
// internal, or previously sent that stage), sends via Resend, and records the
// send in trial_emails so a stage never fires twice.
//
// Called by pg_cron, so there is no user JWT: authenticated by the
// x-cron-token header against TRIAL_CRON_TOKEN — same pattern as asaas-webhook.
// POST {"dry_run": true} to preview the recipients without sending.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Target {
  tenant_id: string;
  tenant_name: string;
  owner_email: string;
  owner_name: string;
  lang: string;
  trial_ends_at: string;
  days_left: number;
  stage: Stage;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const cronToken = Deno.env.get("TRIAL_CRON_TOKEN");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const presented = req.headers.get("x-cron-token")
      ?? req.headers.get("Authorization")?.replace("Bearer ", "");

    // Fail closed: with no token configured nobody can trigger this.
    if (!cronToken) return json({ error: "TRIAL_CRON_TOKEN not configured" }, 503);
    if (presented !== cronToken && presented !== serviceKey) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const configuredBase = Deno.env.get("APP_BASE_URL") ?? "https://app.auraclubmanager.io";
    const baseUrl = configuredBase.endsWith("/") ? configuredBase.slice(0, -1) : configuredBase;

    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = body?.dry_run === true;
    } catch {
      // No body: a normal cron invocation.
    }

    const { data: targets, error } = await supabase.rpc("get_trial_email_targets");
    if (error) {
      console.error("get_trial_email_targets failed:", error);
      return json({ error: error.message }, 500);
    }

    const due = (targets ?? []) as Target[];
    if (dryRun) {
      return json({
        dry_run: true,
        count: due.length,
        targets: due.map((t) => ({
          club: t.tenant_name, email: t.owner_email,
          stage: t.stage, days_left: t.days_left, lang: resolveLang(t.lang),
        })),
      });
    }

    const results: Array<Record<string, unknown>> = [];

    for (const target of due) {
      const lang = resolveLang(target.lang);
      const L = COPY[lang];
      // The trial countdown reads as days remaining; never "0 days".
      const msg = L.stages[target.stage](target.tenant_name, Math.max(1, target.days_left));
      const ctaUrl = `${baseUrl}/?lang=${lang}#/plans`;

      if (!resendApiKey) {
        console.log(`[dev] ${target.stage} -> ${target.owner_email} (${target.tenant_name})`);
      } else {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Aura Club Manager <noreply@auraclubmanager.io>",
            to: [target.owner_email],
            subject: msg.subject,
            html: renderHtml(L, msg, target.owner_name, ctaUrl),
          }),
        });

        if (!res.ok) {
          const detail = await res.text();
          console.error(`Resend failed for ${target.tenant_id} (${target.stage}): ${detail}`);
          // Not logged as sent, so the next run retries this stage.
          results.push({ club: target.tenant_name, stage: target.stage, sent: false, reason: "resend_error" });
          continue;
        }
      }

      // Record only after a successful send, so a failure retries tomorrow.
      const { error: logError } = await supabase
        .from("trial_emails")
        .insert({ tenant_id: target.tenant_id, stage: target.stage, sent_to: target.owner_email });

      if (logError) console.error(`Could not log send for ${target.tenant_id}:`, logError);

      results.push({ club: target.tenant_name, stage: target.stage, sent: true });
    }

    return json({ processed: due.length, results });

  } catch (err: any) {
    console.error("send-trial-emails error:", err);
    return json({ error: err.message || "Internal server error" }, 500);
  }
});
