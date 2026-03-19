/**
 * GET /w/<wid>/stream — SSE stream proxied from the Durable Object.
 */

import type { Env } from "../index.js";

export async function handleStream(widgetId: string, _request: Request, env: Env): Promise<Response> {
  const doId = env.WIDGET_DO.idFromName(widgetId);
  const stub = env.WIDGET_DO.get(doId);

  const doRes = await stub.fetch(new Request("https://do/stream"));

  // Pass through the SSE response from the DO directly
  return new Response(doRes.body, {
    status: doRes.status,
    headers: doRes.headers,
  });
}
