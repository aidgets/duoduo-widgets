/**
 * Request router for the widget service.
 *
 * URL patterns:
 *   POST /api/open                          -> create widget
 *   POST /api/update?token=<tok>            -> push draft update
 *   POST /api/finalize?token=<tok>          -> freeze and create revision
 *   POST /api/submit                        -> viewer submits interaction
 *   GET  /api/wait?token=<tok>&timeout=N    -> long-poll for submission
 *   GET  /api/get?token=<tok>               -> non-blocking status check
 *   GET  /api/inspect?token=<tok>           -> debug inspection
 *   GET  /w/<wid>                           -> viewer shell (live)
 *   GET  /w/<wid>/stream                    -> SSE stream
 *   GET  /w/<wid>/meta                      -> public JSON metadata
 *   GET  /w/<wid>/<rev_id>                  -> viewer shell (specific revision)
 *   GET  /healthz                           -> health check
 */

import type { Env } from "./index.js";
import { handleApiOpen } from "./handlers/api-open.js";
import { handleApiUpdate } from "./handlers/api-update.js";
import { handleApiFinalize } from "./handlers/api-finalize.js";
import { handleApiSubmit } from "./handlers/api-submit.js";
import { handleApiWait } from "./handlers/api-wait.js";
import { handleApiGet } from "./handlers/api-get.js";
import { handleApiInspect } from "./handlers/api-inspect.js";
import { handleStream } from "./handlers/stream.js";
import { handleView } from "./handlers/view.js";

/** GET /w/<wid>/meta — public JSON metadata (no token required). */
async function handleMeta(widgetId: string, env: Env): Promise<Response> {
  const doId = env.WIDGET_DO.idFromName(widgetId);
  const stub = env.WIDGET_DO.get(doId);
  const doRes = await stub.fetch(new Request("https://do/get"));
  if (!doRes.ok) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  const data = (await doRes.json()) as { state: string; title: string; created_at: string };
  return new Response(
    JSON.stringify({
      widget_id: widgetId,
      title: data.title,
      state: data.state,
      created_at: data.created_at,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // --- Health check ---
  if (path === "/healthz" && method === "GET") {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- API endpoints ---
  if (path === "/api/open" && method === "POST") {
    return handleApiOpen(request, env);
  }
  if (path === "/api/update" && method === "POST") {
    return handleApiUpdate(request, env);
  }
  if (path === "/api/finalize" && method === "POST") {
    return handleApiFinalize(request, env);
  }
  if (path === "/api/submit" && method === "POST") {
    return handleApiSubmit(request, env);
  }
  if (path === "/api/wait" && method === "GET") {
    return handleApiWait(request, env);
  }
  if (path === "/api/get" && method === "GET") {
    return handleApiGet(request, env);
  }
  if (path === "/api/inspect" && method === "GET") {
    return handleApiInspect(request, env);
  }

  // --- Viewer routes: /w/<wid>[/stream|/<rev_id>] ---
  const viewerMatch = path.match(/^\/w\/([a-zA-Z0-9_]+)(?:\/(.+))?$/);
  if (viewerMatch && method === "GET") {
    const widgetId = viewerMatch[1];
    const suffix = viewerMatch[2] ?? null;

    if (suffix === "stream") {
      return handleStream(widgetId, request, env);
    }

    if (suffix === "meta") {
      return handleMeta(widgetId, env);
    }

    // suffix is either null (live view) or a revision ID
    const revisionId = suffix?.startsWith("rev_") ? suffix : null;
    return handleView(widgetId, revisionId, request, env);
  }

  // --- CORS preflight ---
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  return new Response(JSON.stringify({ error: "not_found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}
