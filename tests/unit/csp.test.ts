/**
 * Unit tests for CSP header builder.
 */

import { describe, it, expect } from "vitest";
import { buildCSP } from "../../service/src/viewer/csp.js";

describe("buildCSP", () => {
  const csp = buildCSP("wid_test");

  it("sets default-src to none", () => {
    expect(csp).toContain("default-src 'none'");
  });

  it("allows unsafe-inline scripts and CDN domains", () => {
    expect(csp).toContain("script-src 'unsafe-inline'");
    expect(csp).toContain("https://cdnjs.cloudflare.com");
    expect(csp).toContain("https://esm.sh");
    expect(csp).toContain("https://cdn.jsdelivr.net");
    expect(csp).toContain("https://unpkg.com");
  });

  it("allows inline styles only", () => {
    expect(csp).toContain("style-src 'unsafe-inline'");
  });

  it("allows self for connect-src (SSE)", () => {
    expect(csp).toContain("connect-src 'self'");
  });

  it("blocks frames", () => {
    expect(csp).toContain("frame-src 'none'");
  });

  it("blocks base-uri", () => {
    expect(csp).toContain("base-uri 'none'");
  });

  it("does not allow eval", () => {
    expect(csp).not.toContain("unsafe-eval");
  });
});
