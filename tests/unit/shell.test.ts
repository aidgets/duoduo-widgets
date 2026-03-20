/**
 * Unit tests for the viewer shell HTML generator.
 */

import { describe, it, expect } from "vitest";
import { renderShell } from "../../service/src/viewer/shell.js";

const WIDGET_ID = "wid_test123";

describe("renderShell", () => {
  describe("draft mode (live SSE)", () => {
    const html = renderShell({ widgetId: WIDGET_ID, state: "draft" });

    it("includes morphdom CDN script", () => {
      expect(html).toContain("morphdom");
    });

    it("includes the duoduo bridge with submit and openLink", () => {
      expect(html).toContain("window.duoduo");
      expect(html).toContain("submit:");
      expect(html).toContain("openLink:");
    });

    it("includes SSE EventSource connection", () => {
      expect(html).toContain("EventSource");
      // Shell uses string concatenation: '/w/' + widgetId + '/stream'
      expect(html).toContain("'/w/' + widgetId + '/stream'");
    });

    it("includes the widget ID in data attribute", () => {
      expect(html).toContain(WIDGET_ID);
    });

    it("is valid HTML with doctype", () => {
      expect(html).toMatch(/^<!DOCTYPE html>/i);
      expect(html).toContain("<html");
      expect(html).toContain("</html>");
    });

    it("includes loading animation for draft", () => {
      expect(html).toContain("loading");
    });
  });

  describe("static mode (finalized HTML)", () => {
    const staticContent = "<div>Hello World</div>";
    const html = renderShell({ widgetId: WIDGET_ID, staticHtml: staticContent });

    it("embeds the static HTML content", () => {
      expect(html).toContain(staticContent);
    });

    it("does not include SSE connection script", () => {
      expect(html).not.toContain("EventSource");
    });
  });

  describe("script execution on finalize (PR #1)", () => {
    const html = renderShell({ widgetId: WIDGET_ID, state: "draft" });

    it("does NOT call execScripts during update events", () => {
      const updateMatch = html.match(/addEventListener\('update'[\s\S]*?}\s*\)\s*;/);
      expect(updateMatch).not.toBeNull();
      expect(updateMatch![0]).not.toContain("execScripts");
    });

    it("should call execScripts during finalize events (pending PR #1)", () => {
      // Documents the current bug: finalize handler does NOT call execScripts,
      // so agent-generated <script> tags are silently ignored after morphdom
      // patches the DOM.
      //
      // PR #1 fixes this by adding execScripts(data.html) in the finalize handler.
      // After merging PR #1, this assertion should flip to toContain("execScripts").
      const finalizeMatch = html.match(/addEventListener\('finalize'[\s\S]*?}\s*\)\s*;/);
      expect(finalizeMatch).not.toBeNull();
      // BUG: execScripts is missing from finalize handler (fixed by PR #1)
      expect(finalizeMatch![0]).not.toContain("execScripts");
    });
  });
});
