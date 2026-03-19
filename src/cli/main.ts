import { parseArgs } from "node:util";

// Enable HTTP(S) proxy support for Node.js fetch
import { ProxyAgent, setGlobalDispatcher } from "undici";
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

import { WidgetClient } from "./http-client.js";
import { openCommand } from "./commands/open.js";
import { updateCommand } from "./commands/update.js";
import { finalizeCommand } from "./commands/finalize.js";
import { waitCommand } from "./commands/wait.js";
import { getCommand } from "./commands/get.js";
import { inspectCommand } from "./commands/inspect.js";

const USAGE = `Usage: duoduo-widget <command> [options]

Commands:
  open        Create a new widget draft
  update      Update the current draft
  finalize    Freeze the current draft into an immutable revision
  wait        Block until user submits (or timeout)
  get         Non-blocking check for user submission
  inspect     Debug: show widget manifest

Global options:
  --wid <widget_id>             Widget ID (resolved from local cache)

Open options:
  --title <title>               Widget title
  --ttl-seconds <n>             Draft TTL in seconds
  --widget-id <id>              Explicit widget ID (reopen)
  --fork <widget_id>            Fork from existing widget
  --interaction-mode <mode>     "submit"
  --interaction-prompt <text>   Prompt shown to user
  --interaction-ttl <n>         Interaction TTL in seconds

Update options:
  --html <html>                 HTML content (or pipe via stdin)
  --text-fallback <text>        Plain-text fallback
  --mode <partial|full>         Update mode (default: full)

Wait options:
  --timeout-seconds <n>         Timeout in seconds (default: 600)

Environment:
  WIDGET_SERVICE_URL            Base URL of the widget service (required)
`;

function main(): void {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      wid: { type: "string" },
      title: { type: "string" },
      "ttl-seconds": { type: "string" },
      "timeout-seconds": { type: "string" },
      "text-fallback": { type: "string" },
      html: { type: "string" },
      mode: { type: "string" },
      "interaction-mode": { type: "string" },
      "interaction-prompt": { type: "string" },
      "interaction-ttl": { type: "string" },
      fork: { type: "string" },
      "widget-id": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help || positionals.length === 0) {
    console.error(USAGE);
    process.exit(positionals.length === 0 && !values.help ? 1 : 0);
  }

  const command = positionals[0];
  const baseUrl = process.env.WIDGET_SERVICE_URL;
  if (!baseUrl) {
    console.error("Error: WIDGET_SERVICE_URL environment variable is required");
    process.exit(1);
  }

  const client = new WidgetClient(baseUrl);

  const args = values as Record<string, string | boolean | undefined>;

  const run = async (): Promise<void> => {
    switch (command) {
      case "open":
        await openCommand(client, args);
        break;
      case "update":
        await updateCommand(client, args);
        break;
      case "finalize":
        await finalizeCommand(client, args);
        break;
      case "wait":
        await waitCommand(client, args);
        break;
      case "get":
        await getCommand(client, args);
        break;
      case "inspect":
        await inspectCommand(client, args);
        break;
      default:
        console.error(`Unknown command: ${command}\n`);
        console.error(USAGE);
        process.exit(1);
    }
  };

  run().catch((err: Error) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

main();
