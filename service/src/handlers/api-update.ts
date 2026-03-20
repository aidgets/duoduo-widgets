/**
 * POST /api/update?token=<tok> — Push draft HTML update to the widget.
 */

import type { Env } from "../index.js";
import type { UpdateRequest } from "@widget-types/api";
import { validateToken } from "../auth/token.js";

export async function handleApiUpdate(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return jsonError("missing_token", 401);
  }

  let body: UpdateRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  if (!body.widget_id || !body.html) {
    return jsonError("missing_widget_id_or_html", 400);
  }

  // Validate token
  const valid = await validateToken(body.widget_id, token, env.TOKEN_SECRET);
  if (!valid) {
    return jsonError("invalid_token", 403);
  }

  // Size check: max 512KB
  if (body.html.length > 512 * 1024) {
    return jsonError("html_too_large", 413);
  }

  // Forward to DO
  const doId = env.WIDGET_DO.idFromName(body.widget_id);
  const stub = env.WIDGET_DO.get(doId);

  const doReq = new Request("https://do/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html: body.html,
      text_fallback: body.text_fallback,
      mode: body.mode ?? "full",
    }),
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
