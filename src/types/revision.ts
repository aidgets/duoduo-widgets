/**
 * Widget revision — an immutable snapshot of rendered content.
 */

export interface WidgetRevision {
  revision_id: string; // rev_NNNN
  widget_id: string;
  created_at: string; // ISO 8601 UTC
  r2_key: string; // widgets/<wid>/revisions/<rev_id>.html
}
