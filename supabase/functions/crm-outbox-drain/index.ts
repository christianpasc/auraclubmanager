import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { signBody } from "../_shared/crmSignature.ts";
import { buildPayload, type Lead, type Stage } from "./payload.ts";

// Drains public.crm_outbox into DeskcommCRM.
//
// Signing up never waits for this. A trigger drops one row in the queue inside
// the signup transaction and that is the end of the club's involvement; if the
// CRM is down all day, accounts keep being created and the queue just grows.
//
// Called by pg_cron every minute, so there is no user JWT: authenticated by
// the x-cron-token header against TRIAL_CRON_TOKEN, same as send-trial-emails.
// POST {"dry_run": true} to see what is due without claiming or sending.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Wait before attempt N+1, in minutes. */
const BACKOFF_MINUTES = [1, 5, 15, 60, 240, 720, 1440];
const MAX_ATTEMPTS = 8;

/** The CRM allows 60 requests per minute per source; the cron runs every minute. */
const BATCH_SIZE = 40;

/** A hung request must not eat the whole run. */
const REQUEST_TIMEOUT_MS = 10_000;

interface ClaimedRow {
  id: number;
  user_id: string;
  tenant_id: string | null;
  stage: Stage;
  attempts: number;
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

    const webhookUrl = Deno.env.get("DESKCOMM_WEBHOOK_URL");
    const webhookSecret = Deno.env.get("DESKCOMM_WEBHOOK_SECRET");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = body?.dry_run === true;
    } catch {
      // No body: a normal cron invocation.
    }

    if (dryRun) {
      // Reads without claiming, so a dry run never costs an attempt or
      // defers a row that was about to go out.
      const { data, error } = await admin
        .from("crm_outbox")
        .select("id, user_id, tenant_id, stage, attempts, status, next_attempt_at")
        .eq("status", "pending")
        .lte("next_attempt_at", new Date().toISOString())
        .order("next_attempt_at")
        .limit(BATCH_SIZE);

      if (error) return json({ error: error.message }, 500);
      return json({
        dry_run: true,
        configured: Boolean(webhookUrl && webhookSecret),
        due: data?.length ?? 0,
        rows: (data ?? []).map((r) => ({ id: r.id, stage: r.stage, attempts: r.attempts })),
      });
    }

    // Nothing is claimed while the integration is unconfigured, so the queue
    // waits intact instead of burning attempts against a URL that is not there.
    if (!webhookUrl || !webhookSecret) {
      return json({ error: "DESKCOMM_WEBHOOK_URL or DESKCOMM_WEBHOOK_SECRET not configured" }, 503);
    }

    const { data: claimed, error: claimError } = await admin.rpc("claim_crm_outbox", {
      p_limit: BATCH_SIZE,
    });

    if (claimError) {
      console.error("claim_crm_outbox failed:", claimError.message);
      return json({ error: claimError.message }, 500);
    }

    const rows = (claimed ?? []) as ClaimedRow[];
    if (rows.length === 0) return json({ processed: 0 });

    let sent = 0, retrying = 0, failed = 0, skipped = 0;

    for (const row of rows) {
      const { data: leadData, error: leadError } = await admin.rpc("get_crm_lead", {
        p_user_id: row.user_id,
      });

      if (leadError) {
        await scheduleRetry(admin, row, `get_crm_lead: ${leadError.message}`);
        retrying++;
        continue;
      }

      const payload = buildPayload(leadData as Lead, row.stage);

      // No consent, no phone, no address: there is nothing to work with, and
      // no number of retries will change that.
      if (!payload) {
        await finish(admin, row, "skipped", { last_error: "no_consent_or_contact" });
        log({ outbox_id: row.id, stage: row.stage, attempt: row.attempts, result: "skipped" });
        skipped++;
        continue;
      }

      // Serialized once. This exact string is signed and this exact string is
      // sent -- see _shared/crmSignature.ts.
      const body = JSON.stringify(payload);
      const signature = await signBody(webhookSecret, body);

      let status = 0;
      let errorDetail: string | null = null;

      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Deskcomm-Signature": signature,
          },
          body,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        status = res.status;
        if (!res.ok) {
          // Read a little of it for the log; the body itself is never stored.
          errorDetail = (await res.text()).slice(0, 300);
        }
      } catch (err) {
        errorDetail = err instanceof Error ? err.message : String(err);
      }

      log({ outbox_id: row.id, stage: row.stage, attempt: row.attempts, response_status: status });

      if (status >= 200 && status < 300) {
        await finish(admin, row, "sent", { response_status: status, sent_at: new Date().toISOString() });
        sent++;
        continue;
      }

      // A rejected body does not improve by being sent again. Rate limiting
      // and server faults do, and so does a network failure (status 0).
      const worthRetrying = status === 0 || status === 408 || status === 429 || status >= 500;

      if (!worthRetrying) {
        await finish(admin, row, "failed", { response_status: status, last_error: errorDetail });
        failed++;
        continue;
      }

      if (row.attempts >= MAX_ATTEMPTS) {
        await finish(admin, row, "failed", {
          response_status: status,
          last_error: `gave up after ${row.attempts} attempts: ${errorDetail ?? "no response"}`,
        });
        failed++;
        continue;
      }

      await scheduleRetry(admin, row, errorDetail, status);
      retrying++;
    }

    return json({ processed: rows.length, sent, retrying, failed, skipped });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("crm-outbox-drain error:", message);
    return json({ error: message }, 500);
  }
});

/** Never the secret, never the payload -- just enough to follow a row. */
function log(entry: Record<string, unknown>) {
  console.log(JSON.stringify({ fn: "crm-outbox-drain", ...entry }));
}

type Admin = ReturnType<typeof createClient>;

async function finish(
  admin: Admin,
  row: ClaimedRow,
  status: "sent" | "failed" | "skipped",
  fields: Record<string, unknown>,
) {
  const { error } = await admin
    .from("crm_outbox")
    .update({ status, updated_at: new Date().toISOString(), ...fields })
    .eq("id", row.id);

  if (error) console.error(`Could not close outbox row ${row.id}:`, error.message);
}

async function scheduleRetry(
  admin: Admin,
  row: ClaimedRow,
  detail: string | null,
  status?: number,
) {
  const index = Math.min(row.attempts - 1, BACKOFF_MINUTES.length - 1);
  const waitMinutes = BACKOFF_MINUTES[Math.max(0, index)];
  const nextAttempt = new Date(Date.now() + waitMinutes * 60_000).toISOString();

  const { error } = await admin
    .from("crm_outbox")
    .update({
      next_attempt_at: nextAttempt,
      last_error: detail,
      response_status: status ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (error) console.error(`Could not defer outbox row ${row.id}:`, error.message);
}
