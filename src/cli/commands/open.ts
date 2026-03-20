import type { WidgetClient } from "../http-client.js";
import type { OpenRequest } from "../../types/index.js";
import { writeCache } from "../cache.js";

export interface OpenArgs {
  title?: string;
  "ttl-seconds"?: string;
  "widget-id"?: string;
  fork?: string;
  "interaction-mode"?: string;
  "interaction-prompt"?: string;
}

export async function openCommand(client: WidgetClient, args: OpenArgs): Promise<void> {
  const req: OpenRequest = {
    title: args.title,
    draft_ttl_seconds: args["ttl-seconds"] ? parseInt(args["ttl-seconds"], 10) : undefined,
    widget_id: args["widget-id"],
    fork_widget_id: args.fork,
    interaction: args["interaction-mode"]
      ? {
          mode: args["interaction-mode"] as "submit",
          prompt: args["interaction-prompt"] ?? "",
        }
      : undefined,
  };

  const res = await client.open(req);

  await writeCache({
    widget_id: res.widget_id,
    viewer_url: res.viewer_url,
    control_url: res.control_url,
    control_token: res.control_token,
    control_token_expires_at: res.control_token_expires_at,
  });

  // Enrich response with platform-specific deep links for agent convenience
  const links: Record<string, string> = {
    browser: res.viewer_url,
    feishu_sidebar: `https://applink.feishu.cn/client/web_url/open?mode=sidebar-semi&url=${encodeURIComponent(res.viewer_url)}`,
    feishu_window: `https://applink.feishu.cn/client/web_url/open?mode=window&url=${encodeURIComponent(res.viewer_url)}`,
  };

  console.log(JSON.stringify({ ...res, links }, null, 2));
}
