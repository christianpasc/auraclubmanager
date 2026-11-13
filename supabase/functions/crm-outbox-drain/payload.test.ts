/// <reference lib="deno.ns" />
// See crmSignature.test.ts: the repo's tsconfig.json narrows "lib" for the
// Vite app, which hides the Deno globals from these files.

import { assertEquals } from "jsr:@std/assert@1";
import { buildPayload, type Lead } from "./payload.ts";

const lead: Lead = {
  user_id: "7c1f4b6e-1111-4222-8333-444455556666",
  name: "João Gonçalves",
  email: "joao@clubeexemplo.com.br",
  phone: "+5511987654321",
  consent_at: "2026-11-13T12:00:00Z",
  consent_version: "aura-trial-2026-11",
  utm: null,
};

Deno.test("signup produces the trial stage with the agreed fields", () => {
  const payload = buildPayload(lead, "Em teste");

  assertEquals(payload, {
    external_id: "7c1f4b6e-1111-4222-8333-444455556666",
    name: "João Gonçalves",
    phone: "+5511987654321",
    email: "joao@clubeexemplo.com.br",
    stage: "Em teste",
    ai_service_consent: true,
    ai_service_consent_version: "aura-trial-2026-11",
    submission_status: "completed",
  });
});

Deno.test("the three stages keep the same external_id and repeat the contact", () => {
  const stages = ["Em teste", "Assinou", "Teste encerrado"] as const;

  for (const stage of stages) {
    const payload = buildPayload(lead, stage)!;

    assertEquals(payload.stage, stage);
    // The CRM matches on external_id: same lead, moved along, never a new one.
    assertEquals(payload.external_id, lead.user_id);
    assertEquals(payload.name, "João Gonçalves");
    assertEquals(payload.phone, "+5511987654321");
    assertEquals(payload.email, "joao@clubeexemplo.com.br");
  }
});

Deno.test("a lead who did not consent is never sent", () => {
  assertEquals(buildPayload({ ...lead, consent_at: null }, "Em teste"), null);
});

Deno.test("a lead with no usable contact is never sent", () => {
  assertEquals(buildPayload({ ...lead, phone: null }, "Em teste"), null);
  assertEquals(buildPayload({ ...lead, phone: "   " }, "Em teste"), null);
  assertEquals(buildPayload({ ...lead, email: null }, "Assinou"), null);
});

Deno.test("attribution travels only when it exists", () => {
  const withUtm = buildPayload({
    ...lead,
    utm: { utm_source: "google", utm_medium: "cpc", utm_campaign: "escolinhas-sp" },
  }, "Em teste")!;

  assertEquals(withUtm.utm_source, "google");
  assertEquals(withUtm.utm_medium, "cpc");
  assertEquals(withUtm.utm_campaign, "escolinhas-sp");
});

Deno.test("missing attribution is an absent key, not a null", () => {
  const partial = buildPayload({
    ...lead,
    utm: { utm_source: "instagram", utm_medium: "", utm_campaign: null },
  }, "Em teste")!;

  assertEquals(partial.utm_source, "instagram");
  // The CRM should never have to decide what a null campaign means.
  assertEquals("utm_medium" in partial, false);
  assertEquals("utm_campaign" in partial, false);
});

Deno.test("the body is stable, so the signature over it is too", () => {
  const first = JSON.stringify(buildPayload(lead, "Assinou"));
  const second = JSON.stringify(buildPayload({ ...lead }, "Assinou"));

  assertEquals(first, second);
});
