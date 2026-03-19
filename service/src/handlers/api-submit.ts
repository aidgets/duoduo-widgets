/**
 * POST /api/submit — Viewer submits an interaction event (no control token required).
 */

import type { Env } from "../index.js";
import type { SubmitRequest } from "@widget-types/api";

export async function handleApiSubmit(request: Request, env: Env): Promise<Response> {
  let body: SubmitRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  if (!body.widget_id || !body.event_id || !body.action) {
    return jsonError("missing_required_fields", 400);
  }

  // Forward to DO
  const doId = env.WIDGET_DO.idFromName(body.widget_id);
  const stub = env.WIDGET_DO.get(doId);

  const doReq = new Request("https://do/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_id: body.event_id,
      action: body.action,
      payload: body.payload ?? {},
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
