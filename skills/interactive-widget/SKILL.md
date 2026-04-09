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

The user watches the widget **live** — stream content fast, one section per tool call.

## Quick start

```bash
npm install -g @openduo/duoduo-widgets  # if not installed
```

### 1. Open

```bash
duoduo-widget open --title "Dashboard" --ttl-seconds 300
```

Send `links.feishu_sidebar` or `links.browser` to user. **NEVER send `control_url`/`control_token`.**

### 2. Skeleton + push

```bash
cat > /tmp/w-{wid}.html << 'SKELETON'
<div style="background:#1a1a1a;color:#e0e0e0;padding:20px;font-family:system-ui;min-height:100vh;">
  <h1 style="color:#fff;font-size:28px;font-weight:500;margin:0 0 4px;">Title</h1>
  <p style="color:#999;font-size:14px;margin:0 0 20px;">Subtitle</p>
<!-- NEXT -->
</div>
SKELETON
cat /tmp/w-{wid}.html | duoduo-widget update --wid "wid_..."
```

### 3a. Append section via full HTML (classic)

```bash
python3 - /tmp/w-{wid}.html << 'PYEOF'
import sys
f = sys.argv[1]
html = open(f).read()
section = """<div style="background:#2a2a2a;padding:16px;border-radius:8px;margin-bottom:12px;">
  <h3 style="margin:0 0 8px;color:#fff;font-size:16px;font-weight:500;">Section title</h3>
  <p style="margin:0;color:#999;font-size:14px;">Content — $100 safe, no escaping needed</p>
</div>
<!-- NEXT -->"""
html = html.replace('<!-- NEXT -->', section)
open(f, 'w').write(html)
PYEOF
cat /tmp/w-{wid}.html | duoduo-widget update --wid "wid_..."
```

Quoted heredoc `'PYEOF'` — write raw HTML, no shell escaping. Only change content inside `"""..."""`.

### 3b. Incremental update via `--patch` (preferred for data-heavy widgets)

After the skeleton is pushed, use `--patch` to update specific parts of the page without re-sending the entire HTML. This is faster, uses less bandwidth, and avoids morphdom re-rendering.

```bash
duoduo-widget update --wid "wid_..." --patch '[
  {"op":"append","selector":"#rows","html":"<tr><td>New item</td><td>$100</td></tr>"},
  {"op":"text","selector":"#count","text":"42"},
  {"op":"innerHTML","selector":"#status","html":"<strong style=\"color:#4ade80\">Done</strong>"}
]'
```

**Patch operations:**

| Op          | What it does                               | Requires |
| ----------- | ------------------------------------------ | -------- |
| `append`    | Insert `html` as last child of `selector`  | `html`   |
| `prepend`   | Insert `html` as first child of `selector` | `html`   |
| `replace`   | Replace element matching `selector`        | `html`   |
| `innerHTML` | Set innerHTML of `selector`                | `html`   |
| `text`      | Set textContent of `selector`              | `text`   |
| `remove`    | Remove element matching `selector`         | —        |

**When to use patch vs full HTML:**

- **Patch**: tables gaining rows, dashboards updating numbers, status text changes, progressive list building
- **Full HTML**: first skeleton push, layout changes, adding new scripts/CDN libraries

**Important**: Patches update the live viewer instantly but do NOT update the stored HTML on the server. To ensure the finalized artifact includes all changes, use this pattern:

1. Push skeleton via full `update --html` (keep the temp file)
2. Stream data via `--patch` for live viewer speed
3. In parallel, keep appending to `/tmp/w-{wid}.html` locally
4. Before `finalize`, do one last `cat /tmp/w-{wid}.html | duoduo-widget update --wid ...`
5. Then `finalize`

Or simply: pass the final complete HTML via `duoduo-widget finalize --wid ... --html "..."` if available.

**Skeleton design for patch**: Give target elements `id` attributes so patches can address them:

```html
<tbody id="rows"></tbody>
<!-- append rows here -->
<span id="count">0</span>
<!-- update text here -->
<div id="status">Loading...</div>
<!-- update status here -->
```

### 4. Finalize

```bash
duoduo-widget finalize --wid "wid_..."
```

## Rules

1. **Copy from `references/html_patterns.md`** — read it first, pick a section template, change only the data values. Never design HTML from scratch
2. **One section per Bash call** — heredoc + cat pipe in a single command
3. **Push after every section** — never batch
4. **Never build full HTML in context** — the temp file accumulates; context only sees the section
5. **Never read the temp file back** — it only flows through the pipe
6. **Act on `_hints`** in update output: `no_viewers` → send link; `ttl_low`/`ttl_expiring` → finalize now; `many_updates` → wrap up

## Interactive widgets

```bash
duoduo-widget open --title "Confirm" --ttl-seconds 300 \
  --interaction-mode submit --interaction-prompt "Review and confirm"
```

Button: `<button onclick="window.duoduo.submit('action', {key:'val'})" style="background:#4a9;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:14px;cursor:pointer;">Label</button>`

Read result: `duoduo-widget wait --wid "wid_..." --timeout-seconds 120`

## HTML rules

- Inline styles only. CDN: `cdnjs.cloudflare.com`, `esm.sh`, `cdn.jsdelivr.net`, `unpkg.com`
- Forbidden: `fetch()`, `XMLHttpRequest`, `WebSocket`, `eval()`, `new Function()`

**Templates** — read `references/html_patterns.md` first. Copy a template, change data values only.

## CLI reference

| Command    | Purpose            | Key flags                                                                |
| ---------- | ------------------ | ------------------------------------------------------------------------ |
| `open`     | Create draft       | `--title`, `--ttl-seconds`, `--interaction-mode`, `--interaction-prompt` |
| `update`   | Push HTML or patch | `--wid`, stdin or `--html`, `--patch <json>`, `--text-fallback`          |
| `finalize` | Freeze             | `--wid`                                                                  |
| `wait`     | Block for submit   | `--wid`, `--timeout-seconds`                                             |
| `get`      | Poll status        | `--wid`                                                                  |

## State machine

`draft` → `finalized` → `awaiting_input` → `submitted` (terminal)

Finalized artifacts are permanent. Fork: `open --fork <widget_id>`.

## Environment

`WIDGET_SERVICE_URL` env var (default: `https://aidgets.dev`).
