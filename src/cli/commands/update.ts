import type { WidgetClient } from "../http-client.js";
import type { UpdateRequest, UpdateResponse, PatchOp } from "../../types/index.js";
import { resolveWidget } from "../cache.js";

export interface UpdateArgs {
  wid?: string;
  html?: string;
  patch?: string;
  "text-fallback"?: string;
  mode?: string;
}

export async function updateCommand(client: WidgetClient, args: UpdateArgs): Promise<void> {
  const { widget_id, control_url, control_token } = await resolveWidget(args.wid);

  // Patch mode: --patch takes a JSON array of PatchOp
  if (args.patch) {
    let patches: PatchOp[];
    try {
      patches = JSON.parse(args.patch);
    } catch {
      console.error("Error: --patch must be valid JSON array");
      process.exit(1);
    }
    if (!Array.isArray(patches) || patches.length === 0) {
      console.error("Error: --patch must be a non-empty JSON array");
      process.exit(1);
    }

    const req: UpdateRequest = {
      widget_id,
      patches,
      text_fallback: args["text-fallback"],
    };

    const res = await client.update(control_url, control_token, req);
    const hints = generateHints(res, 0);
    const output: Record<string, unknown> = { ...res };
    if (hints.length > 0) output._hints = hints;
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Full HTML mode (existing behavior)
  let html: string;
  if (args.html) {
    html = args.html;
  } else if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    html = Buffer.concat(chunks).toString("utf-8");
  } else {
    console.error("Error: --html, --patch, or stdin required");
    process.exit(1);
  }

  const req: UpdateRequest = {
    widget_id,
    html,
    text_fallback: args["text-fallback"],
    mode: (args.mode as "partial" | "full") || "full",
  };

  const res = await client.update(control_url, control_token, req);

  // Generate agent hints based on metrics
  const hints = generateHints(res, html.length);

  const output: Record<string, unknown> = { ...res };
  if (hints.length > 0) {
    output._hints = hints;
  }

  console.log(JSON.stringify(output, null, 2));
}

function generateHints(res: UpdateResponse, localHtmlBytes: number): string[] {
  const hints: string[] = [];

  const htmlBytes = res.html_bytes ?? localHtmlBytes;

  // Large payload warning
  if (htmlBytes > 50_000) {
    hints.push(
      "html_large: page is " +
        Math.round(htmlBytes / 1024) +
        "KB. Consider splitting content across multiple widgets or simplifying.",
    );
  } else if (htmlBytes > 20_000) {
    hints.push(
      "html_growing: page is " + Math.round(htmlBytes / 1024) + "KB. Keep sections concise.",
    );
  }

  // No viewers connected
  if (res.sse_viewers !== undefined && res.sse_viewers === 0) {
    hints.push(
      "no_viewers: no browser is watching this widget. Ensure the viewer link was sent to the user.",
    );
  }

  // First update reminder
  if (res.update_seq === 1) {
    hints.push("first_update: skeleton pushed. Send viewer link to user now if not already sent.");
  }

  // High update count — might be over-updating
  if (res.update_seq !== undefined && res.update_seq > 15) {
    hints.push(
      "many_updates: " +
        res.update_seq +
        " updates sent. Consider finalizing soon — the user is waiting.",
    );
  }

  // Draft TTL warning
  if (res.draft_ttl_remaining !== undefined && res.draft_ttl_remaining < 60) {
    hints.push(
      "ttl_expiring: draft expires in " +
        res.draft_ttl_remaining +
        "s. Finalize now or content will be lost.",
    );
  } else if (res.draft_ttl_remaining !== undefined && res.draft_ttl_remaining < 120) {
    hints.push(
      "ttl_low: " +
        res.draft_ttl_remaining +
        "s remaining before draft expires. Wrap up and finalize soon.",
    );
  }

  return hints;
}
