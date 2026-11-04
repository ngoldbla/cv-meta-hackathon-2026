/**
 * The VIN lookup (task 057): the car's facts from the listings
 * provider's VIN endpoint. A VIN is checked in code before any call is
 * billed; only the facts the quote uses are kept; responses are cached
 * for 6 hours by the Next.js fetch cache (the same promise as listings).
 */

import { vinCheckOk } from "./quote/schema";

export interface VinFacts {
  vin: string;
  status: "active" | "sold" | "missing";
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  msrp: number | null;
  listedPrice: number | null;
  miles: number | null;
  dealerName: string | null;
}

export type VinLookup =
  | { ok: true; facts: VinFacts }
  | { ok: false; reason: "bad_vin" | "not_found" | "unavailable" | "resting" };

const REVALIDATE_SECONDS = 6 * 60 * 60;
const WINDOW_MS = 60 * 60 * 1000;
export const VIN_PER_HOUR = 20;
export const VIN_DAILY_CAP = 300;
const hits = new Map<string, number[]>();
let day = { key: "", count: 0 };

const str = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);
const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : null);

export function mapVinResponse(body: unknown): VinFacts | null {
  const d = (body as { data?: Record<string, unknown> } | null)?.data;
  if (!d || typeof d.vin !== "string") return null;
  const status = d.status === "active" || d.status === "sold" || d.status === "missing" ? d.status : null;
  if (!status) return null;
  const b = (d.build ?? {}) as Record<string, unknown>;
  const l = (d.latest_listing ?? {}) as Record<string, unknown>;
  const dealer = (l.dealer ?? {}) as Record<string, unknown>;
  const year = num(b.year);
  const miles = num(l.miles);
  return {
    vin: d.vin.toUpperCase(),
    status,
    year: year !== null ? Math.round(year) : null,
    make: str(b.make),
    model: str(b.model),
    trim: str(b.trim),
    msrp: num(b.combined_msrp) ?? num(b.base_msrp),
    listedPrice: num(l.price),
    miles: miles !== null ? Math.round(miles) : null,
    dealerName: str(dealer.name),
  };
}

/** Best-effort per-address window plus a daily ceiling (per server instance). */
export function allowVin(key: string, now = Date.now()): boolean {
  const today = new Date(now).toISOString().slice(0, 10);
  if (day.key !== today) day = { key: today, count: 0 };
  if (day.count >= VIN_DAILY_CAP) return false;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= VIN_PER_HOUR) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  day.count += 1;
  return true;
}

export async function lookupVin(
  vin: string,
  opts: { fetcher?: typeof fetch; baseUrl?: string; apiKey?: string } = {},
): Promise<VinLookup> {
  const v = vin.trim().toUpperCase();
  if (!vinCheckOk(v)) return { ok: false, reason: "bad_vin" };
  const baseUrl = opts.baseUrl ?? process.env.LOWKEY_PROVIDER_BASE_URL;
  const apiKey = opts.apiKey ?? process.env.LOWKEY_PROVIDER_KEY;
  if (!baseUrl || !apiKey) return { ok: false, reason: "unavailable" };
  const fetcher = opts.fetcher ?? fetch;
  try {
    const res = await fetcher(`${baseUrl.replace(/\/$/, "")}/vins/${v}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(5000),
    } as RequestInit);
    if (res.status === 404) return { ok: false, reason: "not_found" };
    if (!res.ok) return { ok: false, reason: "unavailable" };
    const facts = mapVinResponse(await res.json());
    return facts ? { ok: true, facts } : { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
