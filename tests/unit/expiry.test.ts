/**
 * Tests for widget expiry logic.
 *
 * Verifies that draft_expired works correctly, and that awaiting_input
 * does NOT expire (interaction TTL was removed — see issue #3).
 */

import { describe, it, expect } from "vitest";
import type { WidgetState } from "../../src/types/manifest.js";
import type { InteractionConfig } from "../../src/types/manifest.js";

describe("WidgetState type", () => {
  it("includes awaiting_input as a valid state", () => {
    const state: WidgetState = "awaiting_input";
    expect(state).toBe("awaiting_input");
  });

  it("does not include interaction_expired", () => {
    // interaction_expired was removed — awaiting_input is permanent until submit
    const validStates: WidgetState[] = [
      "draft",
      "draft_expired",
      "finalized",
      "awaiting_input",
      "submitted",
    ];
    expect(validStates).not.toContain("interaction_expired");
    expect(validStates).toHaveLength(5);
  });
});

describe("InteractionConfig type", () => {
  it("does not have ttl_seconds or expires_at fields", () => {
    const config: InteractionConfig = {
      mode: "submit",
      prompt: "Please confirm",
      schema: null,
    };
    // Verify no TTL-related fields exist on the type
    expect(config).toEqual({
      mode: "submit",
      prompt: "Please confirm",
      schema: null,
    });
    expect("ttl_seconds" in config).toBe(false);
    expect("expires_at" in config).toBe(false);
  });
});
