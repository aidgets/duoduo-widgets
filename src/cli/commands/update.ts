import type { WidgetClient } from "../http-client.js";
import type { UpdateRequest } from "../../types/index.js";
import { resolveWidget } from "../cache.js";

export interface UpdateArgs {
  wid?: string;
  html?: string;
  "text-fallback"?: string;
  mode?: string;
}

export async function updateCommand(client: WidgetClient, args: UpdateArgs): Promise<void> {
  const { widget_id, control_url, control_token } = await resolveWidget(args.wid);

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
    console.error("Error: --html or stdin required");
    process.exit(1);
  }

  const req: UpdateRequest = {
    widget_id,
    html,
    text_fallback: args["text-fallback"],
    mode: (args.mode as "partial" | "full") || "full",
  };

  const res = await client.update(control_url, control_token, req);
  console.log(JSON.stringify(res, null, 2));
}
