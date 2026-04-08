import type { GalleryWidget } from "./types.js";

/**
 * Render a self-contained gallery HTML page.
 * Pure function — takes widget data, returns HTML string.
 * Reusable by admin gallery (工程二).
 */
export function renderGalleryHtml(widgets: GalleryWidget[]): string {
  const sorted = [...widgets].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const stats = {
    total: sorted.length,
    draft: sorted.filter((w) => w.state === "draft").length,
    finalized: sorted.filter((w) => w.state === "finalized").length,
    awaiting_input: sorted.filter((w) => w.state === "awaiting_input").length,
    submitted: sorted.filter((w) => w.state === "submitted").length,
    expired: sorted.filter((w) => w.state === "draft_expired" || !w.has_metadata).length,
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Widget Gallery</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }

    :root {
      color-scheme: light dark;
      --bg: #1a1a1a;
      --surface: #242424;
      --surface-hover: #2e2e2e;
      --text: #e0e0e0;
      --text-secondary: #999;
      --muted: #888;
      --dim: #555;
      --border: rgba(255,255,255,0.08);
      --brand: #4a9;
      --brand-hover: #5cb;
    }

    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f5f6f8;
        --surface: #fff;
        --surface-hover: #f8f9fa;
        --text: #1a1a1a;
        --text-secondary: #666;
        --muted: #666;
        --dim: #999;
        --border: rgba(0,0,0,0.08);
        --brand: #0d7a5f;
        --brand-hover: #0a6b52;
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

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 32px 24px;
    }

    header {
      margin-bottom: 32px;
    }

    header h1 {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .stats {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      font-size: 13px;
      color: var(--text-secondary);
    }

    .stat {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .stat-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 20px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      text-decoration: none;
      color: inherit;
      display: block;
    }

    .card:hover {
      background: var(--surface-hover);
      border-color: var(--brand);
    }

    .card.no-metadata {
      opacity: 0.5;
    }

    .card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 12px;
    }

    .card-title {
      font-size: 15px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }

    .badge {
      font-size: 11px;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 12px;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .badge-draft { background: #92400e22; color: #f59e0b; }
    .badge-finalized { background: #065f4622; color: #10b981; }
    .badge-awaiting_input { background: #1e40af22; color: #60a5fa; }
    .badge-submitted { background: #6b21a822; color: #a78bfa; }
    .badge-draft_expired, .badge-unknown { background: #37415122; color: #9ca3af; }

    .card-meta {
      font-size: 12px;
      color: var(--text-secondary);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .card-meta .wid {
      font-family: "SF Mono", Monaco, Consolas, monospace;
      font-size: 11px;
      color: var(--dim);
    }

    .card-meta .date {
      color: var(--muted);
    }

    .card-interaction {
      margin-top: 8px;
      font-size: 11px;
      color: var(--brand);
    }

    .empty {
      text-align: center;
      color: var(--muted);
      padding: 80px 20px;
      font-size: 15px;
    }

    .branding {
      text-align: center;
      padding: 24px;
      font-size: 11px;
      color: var(--dim);
    }

    .branding a {
      color: var(--brand);
      text-decoration: none;
    }

    @media (max-width: 640px) {
      .container { padding: 20px 16px; }
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" width="28" height="28">
          <g><ellipse cx="60" cy="48" rx="30" ry="28" fill="currentColor" opacity="0.3"/><ellipse cx="32" cy="65" rx="14" ry="22" fill="currentColor" opacity="0.3"/><ellipse cx="88" cy="65" rx="14" ry="22" fill="currentColor" opacity="0.3"/><circle cx="45" cy="68" r="15" fill="currentColor" opacity="0.3"/><circle cx="75" cy="68" r="15" fill="currentColor" opacity="0.3"/><ellipse cx="60" cy="74" rx="20" ry="15" fill="currentColor" opacity="0.2"/></g>
          <ellipse cx="48" cy="54" rx="5" ry="6.5" fill="currentColor" opacity="0.6"/><ellipse cx="72" cy="54" rx="5" ry="6.5" fill="currentColor" opacity="0.6"/>
        </svg>
        Widget Gallery
      </h1>
      <div class="stats">
        <span class="stat"><strong>${stats.total}</strong> total</span>
        ${stats.finalized ? `<span class="stat"><span class="stat-dot" style="background:#10b981"></span>${stats.finalized} finalized</span>` : ""}
        ${stats.submitted ? `<span class="stat"><span class="stat-dot" style="background:#a78bfa"></span>${stats.submitted} submitted</span>` : ""}
        ${stats.awaiting_input ? `<span class="stat"><span class="stat-dot" style="background:#60a5fa"></span>${stats.awaiting_input} awaiting</span>` : ""}
        ${stats.draft ? `<span class="stat"><span class="stat-dot" style="background:#f59e0b"></span>${stats.draft} draft</span>` : ""}
        ${stats.expired ? `<span class="stat"><span class="stat-dot" style="background:#9ca3af"></span>${stats.expired} expired</span>` : ""}
      </div>
    </header>

    ${
      sorted.length === 0
        ? '<div class="empty">No widgets found in local cache.<br>Create one with <code>duoduo-widget open</code></div>'
        : `<div class="grid">${sorted.map(renderCard).join("\n")}</div>`
    }

    <div class="branding">
      Powered by <a href="https://openduo.ai" target="_blank" rel="noopener">openduo.ai</a>
    </div>
  </div>
</body>
</html>`;
}

function renderCard(w: GalleryWidget): string {
  const title = escapeHtml(w.title || w.widget_id);
  const badgeClass = `badge-${w.has_metadata ? w.state : "unknown"}`;
  const stateLabel = w.has_metadata ? w.state.replace(/_/g, " ") : "no token";
  const date = w.has_metadata ? formatDate(w.created_at) : "";
  const noMeta = w.has_metadata ? "" : " no-metadata";

  return `      <a class="card${noMeta}" href="${escapeAttr(w.viewer_url)}" target="_blank" rel="noopener">
        <div class="card-header">
          <span class="card-title">${title}</span>
          <span class="badge ${badgeClass}">${stateLabel}</span>
        </div>
        <div class="card-meta">
          <span class="wid">${escapeHtml(w.widget_id)}</span>
          ${date ? `<span class="date">${date}</span>` : ""}
          ${w.has_metadata && w.revision_count > 0 ? `<span>${w.revision_count} revision${w.revision_count > 1 ? "s" : ""}</span>` : ""}
        </div>
        ${w.interaction ? `<div class="card-interaction">interactive: ${escapeHtml(w.interaction.mode)}</div>` : ""}
      </a>`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
