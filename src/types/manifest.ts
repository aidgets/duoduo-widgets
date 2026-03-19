/**
 * Widget manifest — the core state record for a widget instance.
 */

export type WidgetState =
  | "draft"
  | "draft_expired"
  | "finalized"
  | "awaiting_input"
  | "submitted"
  | "interaction_expired";

export interface WidgetManifest {
  widget_id: string;
  title: string;
  state: WidgetState;
  created_at: string; // ISO 8601 UTC
  updated_at: string; // ISO 8601 UTC
  draft_ttl_seconds: number;
  revision_count: number;
  current_revision_id: string | null;
  interaction: InteractionConfig | null;
}

export interface InteractionConfig {
  mode: "submit";
  prompt: string;
  schema: Record<string, unknown> | null;
  ttl_seconds: number;
  expires_at: string | null; // set when state transitions to awaiting_input
}
