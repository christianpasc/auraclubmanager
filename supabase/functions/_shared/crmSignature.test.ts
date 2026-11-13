/// <reference lib="deno.ns" />
// The reference is needed because the repo's tsconfig.json narrows "lib" for
// the Vite app, which hides the Deno globals from these files.

import { assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { signBody } from "./crmSignature.ts";

// Vectors computed independently (node crypto.createHmac) so this pins the
// digest itself, not just "whatever our own code produces".

const SECRET = "aura-test-secret";

Deno.test("signBody matches a known HMAC-SHA256 vector", async () => {
  const body = '{"external_id":"7c1f4b6e","stage":"Em teste"}';

  assertEquals(
    await signBody(SECRET, body),
    "05fddbc38946ac057367f6a5ede1e4cb7384cfc90bf20735a2856017cc4036ea",
  );
});

Deno.test("signBody signs the exact bytes: one extra space changes everything", async () => {
  // Same data, one space after the comma. This is the whole reason the drain
  // serializes the body once and sends that same string: if anything
  // re-serialized it on the way out, the CRM would compute this digest
  // instead and reject a valid body.
  const spaced = '{"external_id":"7c1f4b6e", "stage":"Em teste"}';

  assertEquals(
    await signBody(SECRET, spaced),
    "b3bdd9e9047bab626691be022b2f8f223393a87d0dffe64ae94270876f766b5e",
  );

  assertNotEquals(
    await signBody(SECRET, spaced),
    await signBody(SECRET, '{"external_id":"7c1f4b6e","stage":"Em teste"}'),
  );
});

Deno.test("signBody is keyed: another secret gives another digest", async () => {
  const body = '{"external_id":"7c1f4b6e","stage":"Em teste"}';

  assertEquals(
    await signBody("outro-segredo", body),
    "0b171bd7392b433d3b33b448ba2a0654ce23d711a2e9ab6e1d11fec6da80652f",
  );
});

Deno.test("signBody encodes accents as UTF-8", async () => {
  // Brazilian names carry accents, and a wrong encoding here would fail only
  // for some leads -- the worst kind of bug to find in production.
  const body = JSON.stringify({ name: "João Gonçalves", stage: "Teste encerrado" });

  assertEquals(
    await signBody(SECRET, body),
    "42ebdc580aa92dd9014d54dbaee9819c70847edfdadf40284f784e5aeb27e20d",
  );
});

Deno.test("signBody returns 64 lowercase hex characters", async () => {
  const signature = await signBody(SECRET, "{}");

  assertEquals(signature.length, 64);
  assertEquals(/^[0-9a-f]{64}$/.test(signature), true);
});
