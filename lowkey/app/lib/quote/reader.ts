/**
 * Server-side seam to the photo reader (task 047). The reader runs on a
 * scale-to-zero GPU service; this module holds the only copy of its
 * token on our side (Vercel env, never sent to the browser), applies a
 * per-address limit, and never logs or stores the image.
 */

const WINDOW_MS = 60 * 60 * 1000;
export const READS_PER_HOUR = 12;
const hits = new Map<string, number[]>();

export function readerConfig(): { url: string; token: string } | null {
  const url = process.env.LOWKEY_QUOTE_URL;
  const token = process.env.LOWKEY_QUOTE_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Best-effort sliding window per address (per server instance). */
export function allowRead(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= READS_PER_HOUR) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export async function readerFetch(path: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const cfg = readerConfig();
  if (!cfg) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15000);
  try {
    return await fetch(cfg.url + path, {
      ...init,
      signal: ctrl.signal,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}
