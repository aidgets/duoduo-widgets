/**
 * HMAC-SHA256 token generation and validation using Web Crypto API.
 *
 * Token format: tok_{base64url_hmac}_{expires_at_epoch}
 */

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function _fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function computeHmac(
  widgetId: string,
  expiresAtEpoch: number,
  secret: string,
): Promise<string> {
  const key = await getHmacKey(secret);
  const enc = new TextEncoder();
  const data = enc.encode(`${widgetId}:${expiresAtEpoch}`);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  return toBase64Url(signature);
}

/**
 * Generate an HMAC-SHA256 control token for a widget.
 */
export async function generateToken(
  widgetId: string,
  ttlSeconds: number,
  secret: string,
): Promise<{ token: string; expiresAt: string }> {
  const expiresAtEpoch = Math.floor(Date.now() / 1000) + ttlSeconds;
  const hmac = await computeHmac(widgetId, expiresAtEpoch, secret);
  const token = `tok_${hmac}_${expiresAtEpoch}`;
  const expiresAt = new Date(expiresAtEpoch * 1000).toISOString();
  return { token, expiresAt };
}

/**
 * Validate a control token. Returns true if HMAC matches and token is not expired.
 */
export async function validateToken(
  widgetId: string,
  token: string,
  secret: string,
): Promise<boolean> {
  // Parse: tok_{hmac}_{epoch}
  const parts = token.split("_");
  if (parts.length < 3 || parts[0] !== "tok") {
    return false;
  }

  // The hmac part may contain underscores from base64url, so epoch is always last
  const epochStr = parts[parts.length - 1];
  const expiresAtEpoch = parseInt(epochStr, 10);
  if (isNaN(expiresAtEpoch)) {
    return false;
  }

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (now > expiresAtEpoch) {
    return false;
  }

  // Extract hmac (everything between "tok_" and the last "_epoch")
  const hmacPart = parts.slice(1, parts.length - 1).join("_");

  // Recompute and compare
  const expectedHmac = await computeHmac(widgetId, expiresAtEpoch, secret);

  // Constant-time comparison
  if (hmacPart.length !== expectedHmac.length) {
    return false;
  }

  const a = new TextEncoder().encode(hmacPart);
  const b = new TextEncoder().encode(expectedHmac);
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
