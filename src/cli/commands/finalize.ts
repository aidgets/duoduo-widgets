import type { WidgetClient } from "../http-client.js";
import type { FinalizeRequest } from "../../types/index.js";
import { resolveWidget } from "../cache.js";

export interface FinalizeArgs {
  wid?: string;
}

export async function finalizeCommand(client: WidgetClient, args: FinalizeArgs): Promise<void> {
  const { widget_id, control_url, control_token } = await resolveWidget(args.wid);
  const req: FinalizeRequest = { widget_id };
  const res = await client.finalize(control_url, control_token, req);

  const links: Record<string, string> = {
    browser: res.viewer_url,
    feishu_sidebar: `https://applink.feishu.cn/client/web_url/open?mode=sidebar-semi&url=${encodeURIComponent(res.viewer_url)}`,
    feishu_window: `https://applink.feishu.cn/client/web_url/open?mode=window&url=${encodeURIComponent(res.viewer_url)}`,
  };

  console.log(JSON.stringify({ ...res, links }, null, 2));
}
