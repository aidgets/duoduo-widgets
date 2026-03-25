/**
 * Content Security Policy builder for the widget viewer shell.
 */

export function buildCSP(_widgetId: string): string {
  return [
    "default-src 'none'",
    "script-src 'unsafe-inline' https://cdnjs.cloudflare.com https://esm.sh https://cdn.jsdelivr.net https://unpkg.com https://static.cloudflareinsights.com",
    "style-src 'unsafe-inline'",
    "img-src data: blob: https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com",
    "connect-src 'self' https://cloudflareinsights.com",
    "font-src https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
    "frame-src 'none'",
    "base-uri 'none'",
  ].join("; ");
}
