import type { WidgetClient } from "../http-client.js";
import { resolveWidget } from "../cache.js";

export interface GetArgs {
  wid?: string;
}

export async function getCommand(client: WidgetClient, args: GetArgs): Promise<void> {
  const { widget_id, control_url, control_token } = await resolveWidget(args.wid);
  const res = await client.get(control_url, control_token, widget_id);
  console.log(JSON.stringify(res, null, 2));
}
