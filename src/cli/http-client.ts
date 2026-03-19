import type {
  OpenRequest,
  OpenResponse,
  UpdateRequest,
  UpdateResponse,
  FinalizeRequest,
  FinalizeResponse,
  WaitResponse,
  GetResponse,
  InspectResponse,
} from "../types/index.js";

/**
 * HTTP client for the duoduo widget service.
 *
 * URL patterns (from service router.ts):
 *   POST /api/open                          -> create widget
 *   POST /api/update?token=<tok>            -> push draft update
 *   POST /api/finalize?token=<tok>          -> freeze and create revision
 *   GET  /api/wait?token=<tok>&widget_id=<wid>&timeout=N -> long-poll
 *   GET  /api/get?token=<tok>&widget_id=<wid>            -> status check
 *   GET  /api/inspect?token=<tok>&widget_id=<wid>        -> debug
 *
 * control_url from OpenResponse is the base API URL (e.g. https://widget.openduo.ai/api).
 * control_token is the bearer token passed as ?token= query parameter.
 */
export class WidgetClient {
  constructor(private baseUrl: string) {}

  /** Create a new widget draft. */
  async open(req: OpenRequest): Promise<OpenResponse> {
    return this.post<OpenResponse>(`${this.baseUrl}/api/open`, req);
  }

  /** Push HTML update to the current draft. */
  async update(
    controlUrl: string,
    token: string,
    req: UpdateRequest,
  ): Promise<UpdateResponse> {
    const url = `${controlUrl}/update?token=${encodeURIComponent(token)}`;
    return this.post<UpdateResponse>(url, req);
  }

  /** Freeze the draft into an immutable revision. */
  async finalize(
    controlUrl: string,
    token: string,
    req: FinalizeRequest,
  ): Promise<FinalizeResponse> {
    const url = `${controlUrl}/finalize?token=${encodeURIComponent(token)}`;
    return this.post<FinalizeResponse>(url, req);
  }

  /** Long-poll until user submits or timeout. */
  async wait(
    controlUrl: string,
    token: string,
    widgetId: string,
    timeoutSeconds?: number,
  ): Promise<WaitResponse> {
    const url = new URL(`${controlUrl}/wait`);
    url.searchParams.set("token", token);
    url.searchParams.set("widget_id", widgetId);
    if (timeoutSeconds !== undefined) {
      url.searchParams.set("timeout", String(timeoutSeconds));
    }
    return this.getReq<WaitResponse>(url.toString(), timeoutSeconds);
  }

  /** Non-blocking check for user submission. */
  async get(controlUrl: string, token: string, widgetId: string): Promise<GetResponse> {
    const url = new URL(`${controlUrl}/get`);
    url.searchParams.set("token", token);
    url.searchParams.set("widget_id", widgetId);
    return this.getReq<GetResponse>(url.toString());
  }

  /** Debug: return widget manifest + events. */
  async inspect(controlUrl: string, token: string, widgetId: string): Promise<InspectResponse> {
    const url = new URL(`${controlUrl}/inspect`);
    url.searchParams.set("token", token);
    url.searchParams.set("widget_id", widgetId);
    return this.getReq<InspectResponse>(url.toString());
  }

  // -- internal helpers --

  private async post<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(res);
  }

  /**
   * GET with optional extended timeout for long-poll.
   * Node 20 fetch supports AbortSignal.timeout.
   */
  private async getReq<T>(url: string, timeoutSeconds?: number): Promise<T> {
    const signal = timeoutSeconds
      ? AbortSignal.timeout((timeoutSeconds + 5) * 1000) // extra grace
      : AbortSignal.timeout(30_000);
    const res = await fetch(url, { method: "GET", signal });
    return this.handleResponse<T>(res);
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
    }
    if (!res.ok) {
      const err = json as { error?: string; code?: string };
      throw new Error(
        `HTTP ${res.status}: ${err.error ?? "unknown error"}${err.code ? ` (${err.code})` : ""}`,
      );
    }
    return json as T;
  }
}
