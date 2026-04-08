import * as http from "node:http";
import { exec } from "node:child_process";
import { listAllCache, type CacheEntry } from "../cache.js";
import type { WidgetClient } from "../http-client.js";
import type { GalleryWidget } from "../gallery/types.js";
import { renderGalleryHtml } from "../gallery/render.js";

export interface GalleryArgs {
  port?: string;
}

export async function galleryCommand(
  client: WidgetClient,
  args: GalleryArgs,
  subcommand?: string,
): Promise<void> {
  const entries = await listAllCache();

  if (entries.length === 0) {
    console.error("No widgets found in local cache.");
    console.error('Create one with: duoduo-widget open --title "My Widget"');
    process.exit(0);
  }

  if (subcommand === "open") {
    await startGalleryServer(client, entries, args);
  } else {
    printTerminalList(entries);
  }
}

/** Print a terminal-friendly list of cached widgets. */
function printTerminalList(entries: CacheEntry[]): void {
  // Sort by expiry descending (newest first)
  const sorted = [...entries].sort((a, b) => {
    const ta = new Date(a.control_token_expires_at).getTime();
    const tb = new Date(b.control_token_expires_at).getTime();
    return tb - ta;
  });

  const now = Date.now();
  const rows = sorted.map((e) => {
    const tokenExpired = new Date(e.control_token_expires_at).getTime() < now;
    const title = e.title || "-";
    return {
      id: e.widget_id,
      title,
      token: tokenExpired ? "expired" : "active",
      viewer_url: e.viewer_url,
      token_expires: e.control_token_expires_at,
    };
  });

  const active = rows.filter((r) => r.token === "active").length;
  const tokenExpired = rows.filter((r) => r.token === "expired").length;
  console.error(`${rows.length} widgets (${active} token active, ${tokenExpired} token expired)`);
  console.error("Note: viewer_url remains accessible even after token expiry.\n");

  // JSON output for machine consumption (agent can parse this)
  console.log(JSON.stringify(rows, null, 2));
}

/** Start a local HTTP server with the gallery web UI. */
async function startGalleryServer(
  client: WidgetClient,
  entries: CacheEntry[],
  args: GalleryArgs,
): Promise<void> {
  const port = parseInt(args.port || "3210", 10);

  console.error(`Found ${entries.length} cached widgets. Fetching metadata...`);

  // Short timeout per inspect call to avoid blocking gallery startup
  // when the service is unreachable. Cache data is sufficient for fallback.
  const INSPECT_TIMEOUT_MS = 5_000;

  const results = await Promise.allSettled(
    entries.map(async (entry): Promise<GalleryWidget> => {
      try {
        const data = await Promise.race([
          client.inspect(entry.control_url, entry.control_token, entry.widget_id),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), INSPECT_TIMEOUT_MS),
          ),
        ]);
        const m = data.manifest;
        return {
          widget_id: m.widget_id,
          title: m.title,
          state: m.state,
          created_at: m.created_at,
          updated_at: m.updated_at,
          viewer_url: entry.viewer_url,
          revision_count: m.revision_count,
          interaction: m.interaction,
          has_metadata: true,
        };
      } catch {
        return {
          widget_id: entry.widget_id,
          title: entry.title || "",
          state: "unknown",
          created_at: "",
          updated_at: "",
          viewer_url: entry.viewer_url,
          revision_count: 0,
          interaction: null,
          has_metadata: false,
        };
      }
    }),
  );

  const widgets: GalleryWidget[] = results
    .filter((r): r is PromiseFulfilledResult<GalleryWidget> => r.status === "fulfilled")
    .map((r) => r.value);

  const withMeta = widgets.filter((w) => w.has_metadata).length;
  console.error(
    `Loaded ${withMeta}/${widgets.length} with full metadata (${widgets.length - withMeta} expired/unreachable)`,
  );

  const html = renderGalleryHtml(widgets);

  const server = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/gallery") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.error(`Gallery running at ${url}`);
    console.error("Press Ctrl+C to stop.\n");

    const cmd =
      process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    exec(`${cmd} ${url}`);
  });

  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      server.close();
      resolve();
    });
    process.on("SIGTERM", () => {
      server.close();
      resolve();
    });
  });
}
