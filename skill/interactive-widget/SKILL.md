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

### 3. Append section + push (repeat)

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

| Command    | Purpose          | Key flags                                                                |
| ---------- | ---------------- | ------------------------------------------------------------------------ |
| `open`     | Create draft     | `--title`, `--ttl-seconds`, `--interaction-mode`, `--interaction-prompt` |
| `update`   | Push HTML        | `--wid`, stdin or `--html`, `--text-fallback`                            |
| `finalize` | Freeze           | `--wid`                                                                  |
| `wait`     | Block for submit | `--wid`, `--timeout-seconds`                                             |
| `get`      | Poll status      | `--wid`                                                                  |

## State machine

`draft` → `finalized` → `awaiting_input` → `submitted` (terminal)

Finalized artifacts are permanent. Fork: `open --fork <widget_id>`.

## Environment

`WIDGET_SERVICE_URL` env var (default: `https://aidgets.dev`).
