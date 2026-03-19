/**
 * Cloudflare Worker entry point for the duoduo widget service.
 */

import { WidgetDurableObject } from "./durable-objects/widget-do.js";
import { handleRequest } from "./router.js";

export { WidgetDurableObject };

export interface Env {
  WIDGET_DO: DurableObjectNamespace;
  WIDGET_R2: R2Bucket;
  TOKEN_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
