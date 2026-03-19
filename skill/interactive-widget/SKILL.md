---
name: interactive-widget
description: >
  Create shareable interactive web pages — dashboards, charts, forms, simulations —
  via the duoduo-widget CLI. Each widget gets a permanent URL that works in any browser.
  Use when: the response needs a visual, interactive, or non-linear UI that goes beyond
  chat text (data dashboards, confirmation forms, parameter pickers, live visualizations,
  sortable tables, Canvas animations); structured user input is needed (approve/reject,
  multi-field forms, parameter confirmation); the artifact should be shareable via URL
  and persist beyond the conversation. Trigger on: "build a page", "create a form",
  "make a dashboard", "interactive view", "confirm parameters", "shareable link",
  "widget", "visualize this as a page", "let the user pick". Do NOT use for plain text
  answers, code snippets, or ephemeral local-only visuals.
---

# Widget — Durable Interactive Artifacts

`duoduo-widget` CLI creates persistent web widgets with `open -> update -> finalize` lifecycle.

## Prerequisites

Install the CLI if not already available:

```bash
npm install -g @openduo/duoduo-widgets
```

## Workflow

```bash
# 1. Create draft — returns widget_id, viewer_url, control_url, control_token
duoduo-widget open --title "Dashboard" --ttl-seconds 300

# 2. Push HTML (progressive — user sees real-time SSE updates)
echo '<h1>Results</h1>...' | duoduo-widget update --wid "wid_..."

# 3. Freeze to immutable revision
duoduo-widget finalize --wid "wid_..."
```

**Send `viewer_url` to user. NEVER send `control_url` or `control_token`.**

Use `--wid` (local cache) instead of long URLs. For large HTML, write to a temp file first then pipe: `cat /tmp/widget.html | duoduo-widget update --wid "wid_..."`.

## Platform links

`open` and `finalize` return a `links` object with ready-to-use URLs for different platforms:

```json
{
  "links": {
    "browser": "https://aidgets.dev/w/wid_...",
    "feishu_sidebar": "https://applink.feishu.cn/client/web_url/open?mode=sidebar-semi&url=...",
    "feishu_window": "https://applink.feishu.cn/client/web_url/open?mode=window&url=..."
  }
}
```

- **Feishu/Lark**: use `links.feishu_sidebar` to open widget in the sidebar, or `links.feishu_window` for a separate window
- **Other channels**: use `links.browser` (the plain `viewer_url`)

## Interactive widgets

Collect structured user input:

```bash
duoduo-widget open --title "Confirm" --ttl-seconds 300 \
  --interaction-mode submit --interaction-prompt "Review and confirm" --interaction-ttl 120
```

Include submit button in HTML:

```html
<button onclick="window.duoduo.submit('confirm', {symbol:'NVDA', confirmed:true})">Confirm</button>
```

After finalize, read result:

```bash
duoduo-widget wait --wid "wid_..." --timeout-seconds 120
# Returns: { submitted: true, event: { action: "confirm", payload: {...} } }
```

Non-blocking alternative: `duoduo-widget get --wid "wid_..."`

## CLI commands

| Command    | Purpose            | Key flags                                                                                     |
| ---------- | ------------------ | --------------------------------------------------------------------------------------------- |
| `open`     | Create draft       | `--title`, `--ttl-seconds`, `--interaction-mode`, `--interaction-prompt`, `--interaction-ttl` |
| `update`   | Push HTML          | `--wid`, `--html` or stdin, `--text-fallback`, `--mode partial\|full`                         |
| `finalize` | Freeze revision    | `--wid`                                                                                       |
| `wait`     | Block for submit   | `--wid`, `--timeout-seconds`                                                                  |
| `get`      | Poll submit status | `--wid`                                                                                       |
| `inspect`  | Debug manifest     | `--wid`                                                                                       |

## HTML authoring

- Dark theme: `background: #1a1a1a; color: #e0e0e0`
- Inline styles preferred (streaming-friendly)
- CDN allowlist: `cdnjs.cloudflare.com`, `esm.sh`, `cdn.jsdelivr.net`, `unpkg.com`
- Bridge: `window.duoduo.submit(action, payload)`, `window.duoduo.openLink(url)`
- Forbidden: `fetch()`, `XMLHttpRequest`, `WebSocket`, `eval()`, `new Function()`
- For component patterns, color system, and examples: read `references/html_patterns.md`

## Channel fallback

Always provide `--text-fallback`:

```bash
echo '<div>...</div>' | duoduo-widget update --wid "wid_..." \
  --text-fallback "Analysis complete. Open the widget to view."
```

## State machine

```text
draft -> finalized -> awaiting_input -> submitted (terminal)
draft -> draft_expired | awaiting_input -> interaction_expired
```

Finalized/submitted artifacts are permanent. To continue: `open --fork <widget_id>`.

## Environment

Requires `WIDGET_SERVICE_URL` env var (e.g. `https://aidgets.dev`).
