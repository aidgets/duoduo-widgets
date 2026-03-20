/**
 * Viewer shell HTML generator.
 *
 * Produces a self-contained HTML page that:
 * - Connects to the SSE stream for live draft updates
 * - Uses morphdom for efficient DOM patching
 * - Provides the window.duoduo bridge for interaction submissions
 * - Supports light/dark theme following system preference
 * - Responsive layout for mobile and desktop
 */

import { buildCSP } from "./csp.js";

export interface ShellOptions {
  widgetId: string;
  /** Pre-rendered HTML for finalized/submitted widgets (no SSE needed) */
  staticHtml?: string;
  /** Current widget state */
  state?: string;
  /** Widget title */
  title?: string;
}

export function renderShell(opts: ShellOptions): string {
  const { widgetId, staticHtml, state, title } = opts;
  const isLive = !staticHtml && state === "draft";
  const csp = buildCSP(widgetId);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${escapeAttr(csp)}">
  <title>${escapeHtml(title || widgetId)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }

    :root {
      color-scheme: light dark;
      --bg: #1a1a1a;
      --text: #e0e0e0;
      --muted: #888;
      --dim: #555;
      --brand: #4a9;
      --brand-hover: #5cb;
      --branding-bg: rgba(0,0,0,0.5);
      --branding-border: rgba(255,255,255,0.06);
    }

    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f8f9fa;
        --text: #1a1a1a;
        --muted: #666;
        --dim: #999;
        --brand: #0d7a5f;
        --brand-hover: #0a6b52;
        --branding-bg: rgba(255,255,255,0.8);
        --branding-border: rgba(0,0,0,0.08);
      }
    }

    html, body {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.6;
    }
    #root {
      max-width: 960px;
      margin: 0 auto;
      padding: 24px 16px 48px;
    }
    @media (max-width: 640px) {
      #root { padding: 16px 12px 48px; }
    }
    .widget-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      color: var(--muted);
      font-size: 14px;
    }
    .widget-loading .dot {
      animation: pulse 1.4s infinite;
      margin: 0 2px;
    }
    .widget-loading .dot:nth-child(2) { animation-delay: 0.2s; }
    .widget-loading .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes pulse {
      0%, 80%, 100% { opacity: 0.3; }
      40% { opacity: 1; }
    }
    .widget-status {
      position: fixed;
      top: 8px;
      right: 12px;
      font-size: 10px;
      color: var(--dim);
      pointer-events: none;
      z-index: 10;
    }
    .widget-status.connected { color: var(--brand); }
    .widget-status.disconnected { color: #a54; }

    .widget-branding {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      padding: 5px 12px;
      font-size: 10px;
      color: var(--dim);
      background: var(--branding-bg);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-top: 1px solid var(--branding-border);
      z-index: 10;
    }
    .widget-branding a {
      color: var(--brand);
      text-decoration: none;
    }
    .widget-branding a:hover { color: var(--brand-hover); }
    .widget-branding svg { opacity: 0.6; }
  </style>
</head>
<body>
  <div id="root">${staticHtml ? staticHtml : '<div class="widget-loading"><span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></div>'}</div>
  <div id="status" class="widget-status"></div>
  <div class="widget-branding">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" width="14" height="14">
      <g><ellipse cx="60" cy="48" rx="30" ry="28" fill="currentColor" opacity="0.3"/><ellipse cx="32" cy="65" rx="14" ry="22" fill="currentColor" opacity="0.3"/><ellipse cx="88" cy="65" rx="14" ry="22" fill="currentColor" opacity="0.3"/><circle cx="45" cy="68" r="15" fill="currentColor" opacity="0.3"/><circle cx="75" cy="68" r="15" fill="currentColor" opacity="0.3"/><ellipse cx="60" cy="74" rx="20" ry="15" fill="currentColor" opacity="0.2"/></g>
      <ellipse cx="48" cy="54" rx="5" ry="6.5" fill="currentColor" opacity="0.6"/><ellipse cx="72" cy="54" rx="5" ry="6.5" fill="currentColor" opacity="0.6"/>
    </svg>
    <span>Powered by <a href="https://openduo.ai" target="_blank" rel="noopener">openduo.ai</a></span>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/morphdom@2.7.4/dist/morphdom-umd.min.js"></script>
  <script>
    (function() {
      var widgetId = ${JSON.stringify(widgetId)};
      var root = document.getElementById('root');
      var statusEl = document.getElementById('status');

      // duoduo bridge
      window.duoduo = {
        submit: async function(action, payload) {
          var res = await fetch('/api/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              widget_id: widgetId,
              event_id: 'evt_' + crypto.randomUUID(),
              action: action,
              payload: payload || {}
            })
          });
          return res.json();
        },
        openLink: function(url) {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      };

      ${isLive ? renderSSEScript() : "// Static content — no SSE needed"}
    })();
  </script>
</body>
</html>`;
}

function renderSSEScript(): string {
  return `
      function setStatus(text, cls) {
        statusEl.textContent = text;
        statusEl.className = 'widget-status ' + cls;
      }

      function execScripts(html) {
        // Remove previously injected scripts to avoid duplicate execution
        document.querySelectorAll('script[data-widget-injected]').forEach(function(s) {
          s.remove();
        });
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        var scripts = tmp.querySelectorAll('script');
        scripts.forEach(function(s) {
          var ns = document.createElement('script');
          ns.setAttribute('data-widget-injected', '1');
          if (s.src) {
            ns.src = s.src;
          } else {
            // Wrap in IIFE to isolate scope — prevents "already declared"
            // errors when the same script re-executes on subsequent updates
            ns.textContent = '(function(){' + s.textContent + '})();';
          }
          document.body.appendChild(ns);
        });
      }

      function connect() {
        setStatus('connecting...', '');
        var es = new EventSource('/w/' + widgetId + '/stream');

        es.addEventListener('open', function() {
          setStatus('live', 'connected');
        });

        es.addEventListener('update', function(e) {
          try {
            var data = JSON.parse(e.data);
            if (data.html) {
              var tmp = document.createElement('div');
              tmp.innerHTML = data.html;
              morphdom(root, tmp, { childrenOnly: false });
              execScripts(data.html);
            }
          } catch (err) {
            console.error('update parse error', err);
          }
        });

        es.addEventListener('finalize', function(e) {
          try {
            var data = JSON.parse(e.data);
            if (data.html) {
              var tmp = document.createElement('div');
              tmp.innerHTML = data.html;
              morphdom(root, tmp, { childrenOnly: false });
              execScripts(data.html);
            }
          } catch (err) {
            console.error('finalize parse error', err);
          }
          setStatus('finalized', 'disconnected');
          es.close();
        });

        es.addEventListener('error', function() {
          setStatus('reconnecting...', 'disconnected');
        });
      }

      connect();`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
