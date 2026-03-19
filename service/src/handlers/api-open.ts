/**
 * POST /api/open — Create a new widget instance.
 */

import type { Env } from "../index.js";
import type { OpenRequest, OpenResponse } from "@widget-types/api";
import type { DOOpenResponse } from "../durable-objects/widget-do.js";

export async function handleApiOpen(request: Request, env: Env): Promise<Response> {
  let body: OpenRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const draftTtl = body.draft_ttl_seconds ?? 300;
  if (draftTtl < 10 || draftTtl > 3600) {
    return jsonError("draft_ttl_seconds must be between 10 and 3600", 400);
  }

  // Generate widget ID
  const widgetId = `wid_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

  // Build interaction config
  const interaction = body.interaction
    ? {
        mode: body.interaction.mode,
        prompt: body.interaction.prompt,
        schema: body.interaction.schema ?? null,
        ttl_seconds: body.interaction.ttl_seconds ?? 120,
        expires_at: null, // set on finalize
      }
    : null;

  // Get DO stub
  const doId = env.WIDGET_DO.idFromName(widgetId);
  const stub = env.WIDGET_DO.get(doId);

  const doReq = new Request(`https://do/open?widget_id=${widgetId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: body.title ?? "",
      draft_ttl_seconds: draftTtl,
      interaction,
      token_secret: env.TOKEN_SECRET,
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

  const doData = (await doRes.json()) as DOOpenResponse;

  // Build URLs
  const serviceUrl = new URL(request.url).origin;
  const viewerUrl = `${serviceUrl}/w/${widgetId}`;
  const controlUrl = `${serviceUrl}/api`;

  const response: OpenResponse = {
    widget_id: widgetId,
    control_token: doData.control_token,
    control_token_expires_at: doData.control_token_expires_at,
    viewer_url: viewerUrl,
    control_url: controlUrl,
    manifest: doData.manifest,
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
