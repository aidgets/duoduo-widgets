/**
 * GET /api/wait?token=<tok>&timeout=N — Long-poll waiting for interaction submission.
 */

import type { Env } from "../index.js";
import { validateToken } from "../auth/token.js";

export async function handleApiWait(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const widgetId = url.searchParams.get("widget_id");
  const timeout = url.searchParams.get("timeout") ?? "30";

  if (!token || !widgetId) {
    return jsonError("missing_token_or_widget_id", 401);
  }

  const valid = await validateToken(widgetId, token, env.TOKEN_SECRET);
  if (!valid) {
    return jsonError("invalid_token", 403);
  }

  // Forward to DO
  const doId = env.WIDGET_DO.idFromName(widgetId);
  const stub = env.WIDGET_DO.get(doId);

  const doReq = new Request(`https://do/wait?timeout=${timeout}`, {
    method: "GET",
  });

  const doRes = await stub.fetch(doReq);
  const doData = await doRes.json();

  return new Response(JSON.stringify(doData), {
    status: doRes.status,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
