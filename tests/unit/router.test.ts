/**
 * Unit tests for request router.
 *
 * Uses a minimal mock Env to verify routing logic without CF runtime.
 */

import { describe, it, expect } from "vitest";
import { handleRequest } from "../../service/src/router.js";

// Minimal mock env — handlers will fail at DO stub level, but we test routing dispatch
function mockEnv() {
  return {
    WIDGET_DO: {
      idFromName: () => ({ toString: () => "mock-id" }),
      get: () => ({
        fetch: async () => new Response(JSON.stringify({ error: "mock" }), { status: 500 }),
      }),
    },
    WIDGET_R2: {
      get: async () => null,
      put: async () => ({}),
    },
    TOKEN_SECRET: "test-secret",
  } as unknown;
}

function req(method: string, path: string, body?: unknown): Request {
  const url = `https://test.aidgets.dev${path}`;
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new Request(url, init);
}

describe("handleRequest routing", () => {
  it("GET /healthz returns 200 ok", async () => {
    const res = await handleRequest(req("GET", "/healthz"), mockEnv());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });

  it("returns 404 for unknown paths", async () => {
    const res = await handleRequest(req("GET", "/unknown"), mockEnv());
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({ error: "not_found" });
  });

  it("handles CORS preflight", async () => {
    const res = await handleRequest(req("OPTIONS", "/api/open"), mockEnv());
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it("parses viewer URL /w/<wid> (route matches, handler runs)", async () => {
    // Mock DO returns 500 → handleView returns 404 "Widget not found"
    // This is different from the router's own 404 {"error":"not_found"}
    const res = await handleRequest(req("GET", "/w/wid_abc123"), mockEnv());
    const text = await res.text();
    // Router's 404 returns JSON {"error":"not_found"}, handler's 404 returns plain text
    expect(text).not.toContain('"error":"not_found"');
  });

  it("parses viewer stream URL /w/<wid>/stream", async () => {
    const res = await handleRequest(req("GET", "/w/wid_abc123/stream"), mockEnv());
    // Stream handler proxies DO response (500), not router 404
    expect(res.status).toBe(500);
  });

  it("parses viewer revision URL /w/<wid>/rev_0001", async () => {
    // R2 returns null → handler returns 404 "Revision not found" (plain text)
    const res = await handleRequest(req("GET", "/w/wid_abc123/rev_0001"), mockEnv());
    const text = await res.text();
    expect(text).toBe("Revision not found");
  });

  it("rejects wrong HTTP method", async () => {
    // POST to /healthz should 404
    const res = await handleRequest(req("POST", "/healthz"), mockEnv());
    expect(res.status).toBe(404);
  });
});
