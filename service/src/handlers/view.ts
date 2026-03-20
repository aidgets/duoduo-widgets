/**
 * GET /w/<wid> — Serve the viewer shell HTML page.
 * GET /w/<wid>/<rev_id> — Serve a specific revision from R2.
 */

import type { Env } from "../index.js";
import { renderShell } from "../viewer/shell.js";
import { buildCSP } from "../viewer/csp.js";

export async function handleView(
  widgetId: string,
  revisionId: string | null,
  _request: Request,
  env: Env,
): Promise<Response> {
  // If a specific revision is requested, try to serve from R2
  if (revisionId) {
    const r2Key = `widgets/${widgetId}/revisions/${revisionId}.html`;
    const obj = await env.WIDGET_R2.get(r2Key);
    if (!obj) {
      return new Response("Revision not found", { status: 404 });
    }

    const html = await obj.text();
    const shell = renderShell({
      widgetId,
      staticHtml: html,
      state: "finalized",
    });

    return new Response(shell, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": buildCSP(widgetId),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  // Live viewer — check DO state to decide between live SSE or static
  const doId = env.WIDGET_DO.idFromName(widgetId);
  const stub = env.WIDGET_DO.get(doId);

  const doRes = await stub.fetch(new Request("https://do/get"));
  if (!doRes.ok) {
    return new Response("Widget not found", { status: 404 });
  }

  const doData = (await doRes.json()) as { state: string; title: string };
  let staticHtml: string | undefined;

  // For non-draft states, try to serve the last revision from R2
  if (doData.state !== "draft") {
    const inspectRes = await stub.fetch(new Request("https://do/inspect"));
    if (inspectRes.ok) {
      const inspect = (await inspectRes.json()) as {
        manifest: { current_revision_id: string | null };
      };
      if (inspect.manifest.current_revision_id) {
        const r2Key = `widgets/${widgetId}/revisions/${inspect.manifest.current_revision_id}.html`;
        const obj = await env.WIDGET_R2.get(r2Key);
        if (obj) {
          staticHtml = await obj.text();
        }
      }
    }
  }

  const shell = renderShell({
    widgetId,
    staticHtml,
    state: doData.state,
    title: doData.title,
  });

  return new Response(shell, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": buildCSP(widgetId),
      "Cache-Control": "no-cache",
    },
  });
}
