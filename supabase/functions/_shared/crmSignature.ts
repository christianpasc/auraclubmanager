// HMAC-SHA256, hex encoded, over the exact bytes that go on the wire.
//
// The caller serializes the body once and passes that same string here and to
// fetch. Re-serializing it anywhere in between -- passing an object to fetch
// and letting it stringify again, say -- can change key order or whitespace,
// and then the CRM computes a different digest and rejects a body that was
// perfectly valid.

const encoder = new TextEncoder();

export async function signBody(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(body));

  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
