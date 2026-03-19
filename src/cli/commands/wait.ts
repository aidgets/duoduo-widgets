import type { WidgetClient } from "../http-client.js";
import { resolveWidget } from "../cache.js";

export interface WaitArgs {
  wid?: string;
  "timeout-seconds"?: string;
}

export async function waitCommand(client: WidgetClient, args: WaitArgs): Promise<void> {
  const { widget_id, control_url, control_token } = await resolveWidget(args.wid);
  const timeout = args["timeout-seconds"] ? parseInt(args["timeout-seconds"], 10) : 600;
  const res = await client.wait(control_url, control_token, widget_id, timeout);
  console.log(JSON.stringify(res, null, 2));
  if (!res.submitted) process.exit(1);
}
