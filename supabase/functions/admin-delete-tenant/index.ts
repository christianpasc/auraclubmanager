import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Executes a pending deletion_request (LGPD/GDPR erasure). Super-admin only.
// - request_type 'tenant': wipes storage (videos + logo), deletes the tenant row
//   (FK cascades cover almost everything; the few NO ACTION tables are deleted
//   explicitly first), then removes member auth accounts that belong to no
//   other tenant. The deletion_request row survives (FK is ON DELETE SET NULL)
//   as the audit trail of the erasure.
// - request_type 'account': deletes a single user's memberships, profile and
//   auth account — refused while the user still owns a tenant (the tenant
//   request must be processed first).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function deleteBucketPrefix(admin: ReturnType<typeof createClient>, bucket: string, prefix: string) {
  // Storage list() is per-folder; videos live flat under `${tenantId}/` plus a
  // `${tenantId}/thumbnails/` subfolder — walk one level deep.
  const folders = [prefix, `${prefix}/thumbnails`];
  for (const folder of folders) {
    const { data: files } = await admin.storage.from(bucket).list(folder, { limit: 1000 });
    if (files && files.length > 0) {
      const paths = files.filter(f => f.id).map(f => `${folder}/${f.name}`);
      if (paths.length > 0) await admin.storage.from(bucket).remove(paths);
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Authenticate caller and require super admin ─────────────────────
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await admin
      .from("profiles")
      .select("is_super_admin")
      .eq("id", userData.user.id)
      .single();
    if (!profile?.is_super_admin) return json({ error: "Unauthorized: not a super admin" }, 403);

    const { request_id } = await req.json();
    if (!request_id) return json({ error: "Missing request_id" }, 400);

    const { data: request, error: reqError } = await admin
      .from("deletion_requests")
      .select("*")
      .eq("id", request_id)
      .single();
    if (reqError || !request) return json({ error: "Deletion request not found" }, 404);
    if (request.status !== "pending") return json({ error: "Request is not pending" }, 400);

    if (request.request_type === "tenant") {
      const tenantId = request.tenant_id;
      if (!tenantId) return json({ error: "Request has no tenant" }, 400);

      // Members to evaluate for auth-account removal after the tenant is gone
      const { data: members } = await admin
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", tenantId);
      const memberIds: string[] = (members || []).map((m: any) => m.user_id);

      // Storage: private videos + public logo files (logos/{tenantId}-logo-*)
      await deleteBucketPrefix(admin, "videos", tenantId);
      const { data: logoFiles } = await admin.storage.from("tenants").list("logos", { limit: 1000 });
      const logoPaths = (logoFiles || [])
        .filter((f: any) => f.name.startsWith(`${tenantId}-`))
        .map((f: any) => `logos/${f.name}`);
      if (logoPaths.length > 0) await admin.storage.from("tenants").remove(logoPaths);

      // Tables whose tenant FK is NO ACTION (would block the cascade) or absent
      await admin.from("training_participants").delete().eq("tenant_id", tenantId);
      await admin.from("trainings").delete().eq("tenant_id", tenantId);
      await admin.from("webhook_events").delete().eq("tenant_id", tenantId);
      await admin.from("prospects").delete().eq("tenant_id", tenantId);
      await admin.from("profiles").update({ current_tenant_id: null }).eq("current_tenant_id", tenantId);

      const { error: delError } = await admin.from("tenants").delete().eq("id", tenantId);
      if (delError) return json({ error: `Failed to delete tenant: ${delError.message}` }, 500);

      // Remove auth accounts that no longer belong to any tenant (never super admins)
      for (const userId of memberIds) {
        const { count } = await admin
          .from("tenant_users")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);
        if ((count ?? 0) > 0) continue;
        const { data: memberProfile } = await admin
          .from("profiles").select("is_super_admin").eq("id", userId).single();
        if (memberProfile?.is_super_admin) continue;
        await admin.from("profiles").delete().eq("id", userId);
        await admin.auth.admin.deleteUser(userId);
      }
    } else if (request.request_type === "account") {
      const userId = request.requested_by;
      if (!userId) return json({ error: "Request has no user" }, 400);

      const { data: owned } = await admin
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", userId)
        .eq("is_owner", true);
      if ((owned || []).length > 0) {
        return json({ error: "User still owns a tenant — process the tenant deletion first" }, 400);
      }

      await admin.from("tenant_users").delete().eq("user_id", userId);
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
    } else {
      return json({ error: "Unknown request type" }, 400);
    }

    await admin
      .from("deletion_requests")
      .update({ status: "completed", processed_at: new Date().toISOString(), processed_by: userData.user.id })
      .eq("id", request_id);

    return json({ success: true });
  } catch (err: any) {
    console.error("admin-delete-tenant error:", err);
    return json({ error: err.message || "Internal server error" }, 500);
  }
});
