import type { InteractionConfig } from "../../types/manifest.js";

/** Standardized widget data for gallery rendering. */
export interface GalleryWidget {
  widget_id: string;
  title: string;
  state: string;
  created_at: string;
  updated_at: string;
  viewer_url: string;
  revision_count: number;
  interaction: InteractionConfig | null;
  /** false if token expired or network error — only cache info available */
  has_metadata: boolean;
}
