/**
 * Unit tests for HMAC-SHA256 token generation and validation.
 *
 * These tests run in Node.js (vitest) which provides Web Crypto API globally.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { generateToken, validateToken } from "../../service/src/auth/token.js";

const SECRET = "test-secret-key-for-unit-tests";
const WIDGET_ID = "wid_abc123def456ghij";

describe("generateToken", () => {
  it("produces tok_ prefixed token with epoch suffix", async () => {
    const { token, expiresAt } = await generateToken(WIDGET_ID, 300, SECRET);

    expect(token).toMatch(/^tok_.+_\d+$/);
    expect(expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO string
  });

  it("expiry is approximately ttlSeconds in the future", async () => {
    const before = Math.floor(Date.now() / 1000);
    const { expiresAt } = await generateToken(WIDGET_ID, 600, SECRET);
    const after = Math.floor(Date.now() / 1000);

    const expiresEpoch = Math.floor(new Date(expiresAt).getTime() / 1000);
    expect(expiresEpoch).toBeGreaterThanOrEqual(before + 600);
    expect(expiresEpoch).toBeLessThanOrEqual(after + 600);
  });
});

describe("validateToken", () => {
  it("accepts a freshly generated token", async () => {
    const { token } = await generateToken(WIDGET_ID, 300, SECRET);
    const valid = await validateToken(WIDGET_ID, token, SECRET);
    expect(valid).toBe(true);
  });

  it("rejects an expired token", async () => {
    const { token } = await generateToken(WIDGET_ID, 1, SECRET);

    // Advance time past expiry
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 2000);

    const valid = await validateToken(WIDGET_ID, token, SECRET);
    expect(valid).toBe(false);

    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects a token signed with a different secret", async () => {
    const { token } = await generateToken(WIDGET_ID, 300, SECRET);
    const valid = await validateToken(WIDGET_ID, token, "wrong-secret");
    expect(valid).toBe(false);
  });

  it("rejects a token for a different widget_id", async () => {
    const { token } = await generateToken(WIDGET_ID, 300, SECRET);
    const valid = await validateToken("wid_different", token, SECRET);
    expect(valid).toBe(false);
  });

  it("rejects malformed tokens", async () => {
    expect(await validateToken(WIDGET_ID, "", SECRET)).toBe(false);
    expect(await validateToken(WIDGET_ID, "not-a-token", SECRET)).toBe(false);
    expect(await validateToken(WIDGET_ID, "tok_", SECRET)).toBe(false);
    expect(await validateToken(WIDGET_ID, "tok_abc", SECRET)).toBe(false);
    expect(await validateToken(WIDGET_ID, "tok_abc_notanumber", SECRET)).toBe(false);
  });

  it("rejects a token with tampered HMAC", async () => {
    const { token } = await generateToken(WIDGET_ID, 300, SECRET);
    // Flip a character in the HMAC portion
    const parts = token.split("_");
    const hmac = parts.slice(1, -1).join("_");
    const tampered = hmac[0] === "a" ? "b" + hmac.slice(1) : "a" + hmac.slice(1);
    const tamperedToken = `tok_${tampered}_${parts[parts.length - 1]}`;

    const valid = await validateToken(WIDGET_ID, tamperedToken, SECRET);
    expect(valid).toBe(false);
  });
});
