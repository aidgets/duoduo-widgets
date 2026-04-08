import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const CACHE_DIR = process.env.XDG_CACHE_HOME
  ? path.join(process.env.XDG_CACHE_HOME, "duoduo-widget")
  : path.join(os.homedir(), ".cache", "duoduo-widget");

export interface CacheEntry {
  widget_id: string;
  title?: string;
  viewer_url: string;
  control_url: string;
  control_token: string;
  control_token_expires_at: string;
}

/** List all cached entries (including expired ones). */
export async function listAllCache(): Promise<CacheEntry[]> {
  try {
    const files = await fs.promises.readdir(CACHE_DIR);
    const entries: CacheEntry[] = [];
    for (const f of files) {
      if (!f.endsWith(".json") || f.endsWith(".tmp")) continue;
      try {
        const raw = await fs.promises.readFile(path.join(CACHE_DIR, f), "utf-8");
        entries.push(JSON.parse(raw) as CacheEntry);
      } catch {
        // skip malformed files
      }
    }
    return entries;
  } catch {
    return [];
  }
}

/** Persist a control mapping so later commands can resolve by widget_id. */
export async function writeCache(entry: CacheEntry): Promise<void> {
  await fs.promises.mkdir(CACHE_DIR, { recursive: true });
  const filePath = path.join(CACHE_DIR, `${entry.widget_id}.json`);
  const tmpPath = filePath + ".tmp";
  await fs.promises.writeFile(tmpPath, JSON.stringify(entry, null, 2));
  await fs.promises.rename(tmpPath, filePath);
}

/** Read a cached entry by widget_id. Returns null if missing or expired. */
export async function readCache(widgetId: string): Promise<CacheEntry | null> {
  const filePath = path.join(CACHE_DIR, `${widgetId}.json`);
  try {
    const raw = await fs.promises.readFile(filePath, "utf-8");
    const entry = JSON.parse(raw) as CacheEntry;
    if (entry.control_token_expires_at && new Date(entry.control_token_expires_at) < new Date()) {
      return null; // expired
    }
    return entry;
  } catch {
    return null;
  }
}

/**
 * Resolve widget control info from CLI flags.
 * Priority: --wid flag (cache lookup) > error.
 * Returns { widget_id, control_url, control_token }.
 */
export async function resolveWidget(
  wid?: string,
): Promise<{ widget_id: string; control_url: string; control_token: string }> {
  if (wid) {
    const entry = await readCache(wid);
    if (!entry) {
      throw new Error(`No cached control info for widget "${wid}" (expired or not found)`);
    }
    return {
      widget_id: entry.widget_id,
      control_url: entry.control_url,
      control_token: entry.control_token,
    };
  }
  throw new Error("--wid is required");
}
