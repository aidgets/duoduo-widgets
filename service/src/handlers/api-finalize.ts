/**
 * POST /api/finalize?token=<tok> — Freeze the draft and create a revision.
 */

import type { Env } from "../index.js";
import type { FinalizeRequest, FinalizeResponse } from "@widget-types/api";
import type { DOFinalizeResponse } from "../durable-objects/widget-do.js";
import { validateToken } from "../auth/token.js";

export async function handleApiFinalize(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return jsonError("missing_token", 401);
  }

  let body: FinalizeRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  if (!body.widget_id) {
    return jsonError("missing_widget_id", 400);
  }

  const valid = await validateToken(body.widget_id, token, env.TOKEN_SECRET);
  if (!valid) {
    return jsonError("invalid_token", 403);
  }

  // Forward to DO
  const doId = env.WIDGET_DO.idFromName(body.widget_id);
  const stub = env.WIDGET_DO.get(doId);

  const doReq = new Request("https://do/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html: body.html,
      text_fallback: body.text_fallback,
      interaction: body.interaction,
    }),
  });

  const doRes = await stub.fetch(doReq);
  if (!doRes.ok) {
    const err = await doRes.json();
    return new Response(JSON.stringify(err), {
      status: doRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const doData = (await doRes.json()) as DOFinalizeResponse;

  // Write HTML to R2
  const r2Key = `widgets/${body.widget_id}/revisions/${doData.revision_id}.html`;
  await env.WIDGET_R2.put(r2Key, doData.html, {
    httpMetadata: { contentType: "text/html; charset=utf-8" },
  });

  // Build response
  const serviceUrl = new URL(request.url).origin;
  const response: FinalizeResponse = {
    ok: true,
    revision: {
      revision_id: doData.revision_id,
      widget_id: body.widget_id,
      created_at: new Date().toISOString(),
      r2_key: r2Key,
    },
    state: doData.state,
    viewer_url: `${serviceUrl}/w/${body.widget_id}/${doData.revision_id}`,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
