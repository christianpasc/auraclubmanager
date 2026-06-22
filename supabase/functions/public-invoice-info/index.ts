import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Public, read-only invoice summary for the hosted payment page (/pay/:invoiceId).
// No auth required — the invoice id itself is the access token (UUID, unguessable).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { invoice_id } = await req.json();
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "Missing invoice_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("id, tenant_id, athlete_id, description, amount, due_date, status, tenant:tenants(name, stripe_connect_currency), athlete:athletes(full_name)")
      .eq("id", invoice_id)
      .single();

    if (error || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      invoice_id: invoice.id,
      tenant_id: invoice.tenant_id,
      tenant_name: (invoice.tenant as any)?.name || "",
      currency: (invoice.tenant as any)?.stripe_connect_currency || "EUR",
      athlete_name: (invoice.athlete as any)?.full_name || "",
      description: invoice.description,
      amount: invoice.amount,
      due_date: invoice.due_date,
      status: invoice.status,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("public-invoice-info error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
