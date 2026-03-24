/**
 * Widget API request/response types.
 */

import type { InteractionConfig, WidgetManifest } from "./manifest.js";
import type { InteractionEvent } from "./interaction.js";
import type { WidgetRevision } from "./revision.js";

// --- Open ---

export interface OpenRequest {
  title?: string;
  widget_id?: string; // reopen existing widget
  fork_widget_id?: string; // fork from existing widget
  draft_ttl_seconds?: number; // default 300
  interaction?: {
    mode: "submit";
    prompt: string;
    schema?: Record<string, unknown> | null;
  } | null;
}

export interface OpenResponse {
  widget_id: string;
  control_token: string;
  control_token_expires_at: string;
  viewer_url: string;
  control_url: string;
  manifest: WidgetManifest;
}

// --- Update ---

/**
 * A single DOM patch operation.
 * - "append": insert `html` as the last child of the element matching `selector`
 * - "prepend": insert `html` as the first child of the element matching `selector`
 * - "replace": replace the element matching `selector` with `html`
 * - "innerHTML": set the innerHTML of the element matching `selector` to `html`
 * - "text": set the textContent of the element matching `selector` to `text`
 * - "remove": remove the element matching `selector`
 */
export interface PatchOp {
  op: "append" | "prepend" | "replace" | "innerHTML" | "text" | "remove";
  selector: string;
  html?: string;
  text?: string;
}

export interface UpdateRequest {
  widget_id: string;
  html?: string;
  patches?: PatchOp[];
  text_fallback?: string;
  mode?: "partial" | "full"; // default "full"
}

export interface UpdateResponse {
  ok: boolean;
  state: string;
  update_seq?: number;
  html_bytes?: number;
  patch_count?: number;
  sse_viewers?: number;
  draft_ttl_remaining?: number;
}

// --- Finalize ---

export interface FinalizeRequest {
  widget_id: string;
  html?: string; // optional final HTML (uses last draft if omitted)
  text_fallback?: string;
  interaction?: InteractionConfig | null;
}

export interface FinalizeResponse {
  ok: boolean;
  revision: WidgetRevision;
  state: string;
  viewer_url: string;
}

// --- Submit ---

export interface SubmitRequest {
  widget_id: string;
  event_id: string; // client-generated for idempotency
  action: string;
  payload: Record<string, unknown>;
}

export interface SubmitResponse {
  ok: boolean;
  event_id: string;
  state: string;
}

// --- Wait ---

export interface WaitResponse {
  submitted: boolean;
  event: InteractionEvent | null;
  timed_out: boolean;
  state: string;
}

// --- Get ---

export interface GetResponse {
  state: string;
  submitted: boolean;
  event: InteractionEvent | null;
}

// --- Inspect ---

export interface InspectResponse {
  manifest: WidgetManifest;
  events: InteractionEvent[];
  sse_connections: number;
}
