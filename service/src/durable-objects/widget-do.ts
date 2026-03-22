/**
 * Widget Durable Object — core state machine for a single widget instance.
 *
 * Manages manifest lifecycle, draft content, SSE streaming, and interaction events.
 * R2 writes are delegated to the Worker handler (DOs don't have direct R2 bindings).
 */

import type { WidgetManifest, InteractionConfig } from "@widget-types/manifest";
import type { InteractionEvent } from "@widget-types/interaction";
import { generateToken } from "../auth/token.js";

// Internal message types between Worker handler and DO
export interface DOOpenRequest {
  title: string;
  draft_ttl_seconds: number;
  interaction: InteractionConfig | null;
  token_secret: string;
}

export interface DOOpenResponse {
  manifest: WidgetManifest;
  control_token: string;
  control_token_expires_at: string;
}

export interface DOUpdateRequest {
  html: string;
  text_fallback?: string;
  mode?: "partial" | "full";
}

export interface DOFinalizeRequest {
  html?: string;
  text_fallback?: string;
  interaction?: InteractionConfig | null;
}

export interface DOFinalizeResponse {
  revision_id: string;
  html: string;
  state: string;
}

export interface DOSubmitRequest {
  event_id: string;
  action: string;
  payload: Record<string, unknown>;
}

interface SSEConnection {
  writer: WritableStreamDefaultWriter<Uint8Array>;
  encoder: TextEncoder;
  keepAliveTimer: ReturnType<typeof setInterval> | null;
}

type WaitResolver = (event: InteractionEvent | null) => void;

export class WidgetDurableObject implements DurableObject {
  private state: DurableObjectState;
  private sseConnections: SSEConnection[] = [];
  private waitResolvers: WaitResolver[] = [];
  private initialized = false;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case "/open":
          return this.handleOpen(request);
        case "/update":
          return this.handleUpdate(request);
        case "/finalize":
          return this.handleFinalize(request);
        case "/submit":
          return this.handleSubmit(request);
        case "/wait":
          return this.handleWait(request);
        case "/get":
          return this.handleGet();
        case "/inspect":
          return this.handleInspect();
        case "/stream":
          return this.handleStream(request);
        default:
          return jsonResponse({ error: "not_found" }, 404);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "internal_error";
      return jsonResponse({ error: message }, 500);
    }
  }

  // --- State helpers ---

  private async getManifest(): Promise<WidgetManifest | null> {
    return (await this.state.storage.get<WidgetManifest>("manifest")) ?? null;
  }

  private async setManifest(manifest: WidgetManifest): Promise<void> {
    manifest.updated_at = new Date().toISOString();
    await this.state.storage.put("manifest", manifest);
  }

  private async checkAndTransitionExpiry(manifest: WidgetManifest): Promise<WidgetManifest> {
    const now = Date.now();

    if (manifest.state === "draft") {
      const createdAt = new Date(manifest.created_at).getTime();
      if (now > createdAt + manifest.draft_ttl_seconds * 1000) {
        manifest.state = "draft_expired";
        await this.setManifest(manifest);
      }
    }

    return manifest;
  }

  // --- Handlers ---

  private async handleOpen(request: Request): Promise<Response> {
    const existing = await this.getManifest();
    if (existing) {
      return jsonResponse({ error: "already_exists" }, 409);
    }

    const body = (await request.json()) as DOOpenRequest;
    const widgetId = new URL(request.url).searchParams.get("widget_id");
    if (!widgetId) {
      return jsonResponse({ error: "missing_widget_id" }, 400);
    }

    const now = new Date().toISOString();
    const manifest: WidgetManifest = {
      widget_id: widgetId,
      title: body.title || "",
      state: "draft",
      created_at: now,
      updated_at: now,
      draft_ttl_seconds: body.draft_ttl_seconds,
      revision_count: 0,
      current_revision_id: null,
      interaction: body.interaction,
    };

    await this.setManifest(manifest);

    // Generate control token valid for draft TTL + generous buffer
    const tokenTtl = body.draft_ttl_seconds + 3600; // +1 hour buffer for finalize/wait
    const { token, expiresAt } = await generateToken(widgetId, tokenTtl, body.token_secret);

    const response: DOOpenResponse = {
      manifest,
      control_token: token,
      control_token_expires_at: expiresAt,
    };

    return jsonResponse(response, 200);
  }

  private async handleUpdate(request: Request): Promise<Response> {
    const manifest = await this.getManifest();
    if (!manifest) {
      return jsonResponse({ error: "not_found" }, 404);
    }

    const checked = await this.checkAndTransitionExpiry(manifest);
    if (checked.state !== "draft") {
      return jsonResponse({ error: "invalid_state", state: checked.state }, 409);
    }

    const body = (await request.json()) as DOUpdateRequest;

    // Broadcast to SSE immediately (don't wait for storage)
    // Storage and broadcast run in parallel — viewer sees update ASAP
    const storageOps: Promise<void>[] = [this.state.storage.put("draft_html", body.html)];
    if (body.text_fallback !== undefined) {
      storageOps.push(this.state.storage.put("text_fallback", body.text_fallback));
    }

    await Promise.all([Promise.all(storageOps), this.broadcastSSE("update", body.html)]);

    // Include metrics for agent feedback
    checked.update_count = (checked.update_count ?? 0) + 1;
    await this.state.storage.put("manifest", checked);

    const draftTtlRemaining = Math.max(
      0,
      Math.round(
        (new Date(checked.created_at).getTime() + checked.draft_ttl_seconds * 1000 - Date.now()) /
          1000,
      ),
    );

    return jsonResponse({
      ok: true,
      state: checked.state,
      update_seq: checked.update_count,
      html_bytes: body.html.length,
      sse_viewers: this.sseConnections.length,
      draft_ttl_remaining: draftTtlRemaining,
    });
  }

  private async handleFinalize(request: Request): Promise<Response> {
    const manifest = await this.getManifest();
    if (!manifest) {
      return jsonResponse({ error: "not_found" }, 404);
    }

    const checked = await this.checkAndTransitionExpiry(manifest);
    if (checked.state !== "draft") {
      return jsonResponse({ error: "invalid_state", state: checked.state }, 409);
    }

    const body = (await request.json()) as DOFinalizeRequest;

    // Use provided HTML or fall back to stored draft
    const html = body.html ?? ((await this.state.storage.get<string>("draft_html")) || "");
    if (body.text_fallback !== undefined) {
      await this.state.storage.put("text_fallback", body.text_fallback);
    }

    // Update interaction config if provided
    if (body.interaction !== undefined) {
      checked.interaction = body.interaction;
    }

    // Generate revision ID
    const seq = checked.revision_count + 1;
    const revisionId = `rev_${String(seq).padStart(4, "0")}`;

    // Update manifest
    checked.revision_count = seq;
    checked.current_revision_id = revisionId;
    await this.state.storage.put("revision_seq", seq);

    // Transition state
    if (checked.interaction?.mode === "submit") {
      checked.state = "awaiting_input";
    } else {
      checked.state = "finalized";
    }

    await this.setManifest(checked);

    // Store final HTML for potential retrieval
    await this.state.storage.put("draft_html", html);

    // Broadcast final update and close SSE connections
    await this.broadcastSSE("finalize", html);
    await this.closeAllSSE();

    const response: DOFinalizeResponse = {
      revision_id: revisionId,
      html,
      state: checked.state,
    };

    return jsonResponse(response, 200);
  }

  private async handleSubmit(request: Request): Promise<Response> {
    const manifest = await this.getManifest();
    if (!manifest) {
      return jsonResponse({ error: "not_found" }, 404);
    }

    const checked = await this.checkAndTransitionExpiry(manifest);
    if (checked.state !== "awaiting_input") {
      return jsonResponse({ error: "invalid_state", state: checked.state }, 409);
    }

    const body = (await request.json()) as DOSubmitRequest;

    // Idempotency check
    const events = (await this.state.storage.get<InteractionEvent[]>("events")) ?? [];
    const existing = events.find((e) => e.event_id === body.event_id);
    if (existing) {
      return jsonResponse({ ok: true, event_id: body.event_id, state: checked.state });
    }

    const event: InteractionEvent = {
      event_id: body.event_id,
      widget_id: checked.widget_id,
      action: body.action,
      payload: body.payload,
      submitted_at: new Date().toISOString(),
    };

    events.push(event);
    await this.state.storage.put("events", events);

    // Transition to submitted
    checked.state = "submitted";
    await this.setManifest(checked);

    // Wake all wait() callers
    for (const resolve of this.waitResolvers) {
      resolve(event);
    }
    this.waitResolvers = [];

    return jsonResponse({ ok: true, event_id: body.event_id, state: checked.state });
  }

  private async handleWait(request: Request): Promise<Response> {
    const manifest = await this.getManifest();
    if (!manifest) {
      return jsonResponse({ error: "not_found" }, 404);
    }

    const checked = await this.checkAndTransitionExpiry(manifest);

    // If already submitted, return immediately
    if (checked.state === "submitted") {
      const events = (await this.state.storage.get<InteractionEvent[]>("events")) ?? [];
      const lastEvent = events.length > 0 ? events[events.length - 1] : null;
      return jsonResponse({
        submitted: true,
        event: lastEvent,
        timed_out: false,
        state: checked.state,
      });
    }

    // If in a terminal/invalid state for waiting, return immediately
    if (checked.state !== "awaiting_input") {
      return jsonResponse({
        submitted: false,
        event: null,
        timed_out: false,
        state: checked.state,
      });
    }

    // Long-poll: wait for submit or timeout
    const url = new URL(request.url);
    const timeoutMs = Math.min(
      parseInt(url.searchParams.get("timeout") || "30", 10) * 1000,
      120_000, // max 2 minutes
    );

    const result = await new Promise<InteractionEvent | null>((resolve) => {
      const timer = setTimeout(() => {
        // Remove this resolver
        const idx = this.waitResolvers.indexOf(resolve);
        if (idx >= 0) this.waitResolvers.splice(idx, 1);
        resolve(null);
      }, timeoutMs);

      // Wrap resolver to clear timer
      const wrappedResolve = (event: InteractionEvent | null) => {
        clearTimeout(timer);
        resolve(event);
      };

      this.waitResolvers.push(wrappedResolve);
    });

    if (result) {
      return jsonResponse({
        submitted: true,
        event: result,
        timed_out: false,
        state: "submitted",
      });
    }

    // Timed out — re-check state
    const refreshed = await this.getManifest();
    const finalState = refreshed
      ? (await this.checkAndTransitionExpiry(refreshed)).state
      : "unknown";

    return jsonResponse({
      submitted: false,
      event: null,
      timed_out: true,
      state: finalState,
    });
  }

  private async handleGet(): Promise<Response> {
    const manifest = await this.getManifest();
    if (!manifest) {
      return jsonResponse({ error: "not_found" }, 404);
    }

    const checked = await this.checkAndTransitionExpiry(manifest);
    const events = (await this.state.storage.get<InteractionEvent[]>("events")) ?? [];
    const lastEvent = events.length > 0 ? events[events.length - 1] : null;

    return jsonResponse({
      state: checked.state,
      submitted: checked.state === "submitted",
      event: lastEvent,
      title: checked.title,
    });
  }

  private async handleInspect(): Promise<Response> {
    const manifest = await this.getManifest();
    if (!manifest) {
      return jsonResponse({ error: "not_found" }, 404);
    }

    const checked = await this.checkAndTransitionExpiry(manifest);
    const events = (await this.state.storage.get<InteractionEvent[]>("events")) ?? [];

    return jsonResponse({
      manifest: checked,
      events,
      sse_connections: this.sseConnections.length,
    });
  }

  private async handleStream(_request: Request): Promise<Response> {
    const manifest = await this.getManifest();
    if (!manifest) {
      return jsonResponse({ error: "not_found" }, 404);
    }

    const checked = await this.checkAndTransitionExpiry(manifest);

    // If already finalized/submitted, send current content and close
    if (checked.state !== "draft") {
      const html = (await this.state.storage.get<string>("draft_html")) || "";
      const encoder = new TextEncoder();
      const body = encoder.encode(
        `event: finalize\ndata: ${JSON.stringify({ html, state: checked.state })}\n\n`,
      );
      return new Response(body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Create SSE stream
    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const conn: SSEConnection = { writer, encoder, keepAliveTimer: null };
    this.sseConnections.push(conn);

    // Keep-alive: send SSE comment frame every 15s to prevent idle timeout
    // by the Workers runtime and network intermediaries. Comment frames (":")
    // are ignored by the browser's EventSource spec.
    conn.keepAliveTimer = setInterval(() => {
      writer.write(encoder.encode(": ping\n\n")).catch(() => {
        this.removeSSEConnection(conn);
      });
    }, 15_000);

    // Send initial comment to establish connection
    writer.write(encoder.encode(": connected\n\n")).catch(() => {
      this.removeSSEConnection(conn);
    });

    // Send current draft if exists
    const currentHtml = await this.state.storage.get<string>("draft_html");
    if (currentHtml) {
      const data = JSON.stringify({ html: currentHtml });
      writer.write(encoder.encode(`event: update\ndata: ${data}\n\n`)).catch(() => {
        this.removeSSEConnection(conn);
      });
    }

    // Disconnect detection: when write fails, removeSSEConnection handles cleanup.
    // No pipeTo — the readable is returned as the Response body.

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // --- SSE helpers ---

  private async broadcastSSE(eventType: string, html: string): Promise<void> {
    const data = JSON.stringify({ html, timestamp: new Date().toISOString() });
    const message = `event: ${eventType}\ndata: ${data}\n\n`;

    const results = await Promise.allSettled(
      this.sseConnections.map((conn) =>
        conn.writer.write(conn.encoder.encode(message)).then(
          () => null,
          () => conn,
        ),
      ),
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value !== null) {
        this.removeSSEConnection(r.value);
      }
    }
  }

  private async closeAllSSE(): Promise<void> {
    await Promise.allSettled(
      this.sseConnections.map((conn) => {
        if (conn.keepAliveTimer) clearInterval(conn.keepAliveTimer);
        return conn.writer.close().catch(() => {});
      }),
    );
    this.sseConnections = [];
  }

  private removeSSEConnection(conn: SSEConnection): void {
    const idx = this.sseConnections.indexOf(conn);
    if (idx >= 0) {
      this.sseConnections.splice(idx, 1);
    }
    if (conn.keepAliveTimer) clearInterval(conn.keepAliveTimer);
    conn.writer.close().catch(() => {});
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
