import type { WidgetClient } from "../http-client.js";
import { resolveWidget } from "../cache.js";

export interface InspectArgs {
  wid?: string;
}

export async function inspectCommand(client: WidgetClient, args: InspectArgs): Promise<void> {
  const { widget_id, control_url, control_token } = await resolveWidget(args.wid);
  const res = await client.inspect(control_url, control_token, widget_id);
  console.log(JSON.stringify(res, null, 2));
}
