/**
 * Live local listings (task 027, part 3). Server-side REST search:
 * new, in stock, strict gas-only, cheapest first, limit 3, radius 50
 * widening to 150 when fewer than 3 are found. Results are cached
 * per model/ZIP/radius for 6 hours by the Next.js fetch cache, with
 * an 8-second timeout. Any failure returns the "couldn't load" card
 * state; this module never invents sample units.
 *
 * Task 031: the search keeps all model years of new units (no year
 * filter); the card shows each unit's year and notes leftover years.
 */

export interface LocalUnit {
  price: number;
  dealer: string;
  distanceMiles: number;
  daysOnLot: number | null;
  year: number | null;
  trim: string | null;
  url: string;
}

export interface LocalUnitsResult {
  zip: string;
  model: string;
  providerModel: string;
  /** Trim filter the search used, or null for any trim. */
  trim: string | null;
  units: LocalUnit[];
  unitsFound: number;
  totalFound: number;
  bestPrice?: number;
  bestDealer?: string;
  radiusUsed: number;
  widened: boolean;
  error?: string;
}

export const LOAD_ERROR = "Couldn't load local stock right now";
const REVALIDATE_SECONDS = 6 * 60 * 60;

export type ListingsFetcher = (
  url: string,
  init: {
    headers: Record<string, string>;
    next?: { revalidate: number };
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  headers?: { get: (name: string) => string | null };
}>;

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function listingsUrl(
  baseUrl: string,
  providerModel: string,
  zip: string,
  radius: number,
  trim?: string | null,
): string {
  const params = new URLSearchParams({
    inventory_type: "new",
    availability_status: "stock",
    model: providerModel,
    postal_code: zip,
    radius: String(radius),
    sort: "price",
    price_basis: "selected",
    limit: "3",
    fuel_type: "Gas only",
    exclude_powertrain_type: "MHEV,HEV",
  });
  if (trim) params.set("trim", trim);
  return `${baseUrl.replace(/\/$/, "")}/listings?${params.toString()}`;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Map a provider response to card units (cheapest first, at most 3). */
export function mapListingsResponse(
  body: unknown,
  _zip?: string,
): { units: LocalUnit[]; total: number } {
  const root = (body ?? {}) as {
    data?: unknown;
    pagination?: { total?: unknown };
  };
  const rows = Array.isArray(root.data) ? root.data : [];
  const units: LocalUnit[] = [];
  for (const raw of rows) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const price =
      num(r.price_with_fees) ?? num(r.selected_price) ?? num(r.price);
    const url = typeof r.vdp_url === "string" ? r.vdp_url : "";
    if (price === null || !url) continue;
    units.push({
      price,
      dealer:
        typeof r.dealer_name === "string" && r.dealer_name
          ? r.dealer_name
          : "Dealer",
      distanceMiles: num(r.distance_miles) ?? 0,
      daysOnLot: num(r.days_on_market),
      year: num(r.year),
      trim: typeof r.trim === "string" && r.trim ? r.trim : null,
      url,
    });
  }
  units.sort((a, b) => a.price - b.price);
  const total = num(root.pagination?.total) ?? units.length;
  return { units: units.slice(0, 3), total };
}

function failure(
  zip: string,
  providerModel: string,
  trim: string | null = null,
): LocalUnitsResult {
  return {
    zip,
    model: providerModel,
    providerModel,
    trim,
    units: [],
    unitsFound: 0,
    totalFound: 0,
    radiusUsed: 50,
    widened: false,
    error: LOAD_ERROR,
  };
}

export async function fetchLocalUnits(args: {
  zip: string;
  providerModel: string;
  trim?: string | null;
  fetcher?: ListingsFetcher;
  baseUrl?: string;
  apiKey?: string;
  /** Backoff before each 429 retry; tests pass tiny values. */
  retryDelaysMs?: number[];
}): Promise<LocalUnitsResult> {
  const { zip, providerModel } = args;
  const trim = args.trim ?? null;
  const baseUrl = args.baseUrl ?? process.env.LOWKEY_PROVIDER_BASE_URL;
  const apiKey = args.apiKey ?? process.env.LOWKEY_PROVIDER_KEY;
  if (!baseUrl || !apiKey || !providerModel || !/^\d{5}$/.test(zip)) {
    return failure(zip, providerModel, trim);
  }
  const fetcher: ListingsFetcher =
    args.fetcher ?? (fetch as unknown as ListingsFetcher);

  const retryDelays = args.retryDelaysMs ?? [700, 1400];
  async function search(radius: number) {
    const url = listingsUrl(baseUrl!, providerModel, zip, radius, trim);
    for (let attempt = 0; ; attempt += 1) {
      const res = await fetcher(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        next: { revalidate: REVALIDATE_SECONDS },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return mapListingsResponse(await res.json(), zip);
      // Tier 1 rate limit: back off and retry the same search before
      // giving up to the "couldn't load" card state.
      if (res.status === 429 && attempt < retryDelays.length) {
        const retryAfter = Number(res.headers?.get("retry-after"));
        const delay =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 10000)
            : retryDelays[attempt];
        await sleep(delay);
        continue;
      }
      throw new Error(`listings HTTP ${res.status}`);
    }
  }

  try {
    const first = await search(50);
    if (first.total >= 3) {
      return {
        zip,
        model: providerModel,
        providerModel,
        trim,
        units: first.units,
        unitsFound: first.units.length,
        totalFound: first.total,
        bestPrice: first.units[0]?.price,
        bestDealer: first.units[0]?.dealer,
        radiusUsed: 50,
        widened: false,
      };
    }
    try {
      const wide = await search(150);
      return {
        zip,
        model: providerModel,
        providerModel,
        trim,
        units: wide.units,
        unitsFound: wide.units.length,
        totalFound: wide.total,
        bestPrice: wide.units[0]?.price,
        bestDealer: wide.units[0]?.dealer,
        radiusUsed: 150,
        widened: true,
      };
    } catch {
      // Widening failed: keep whatever the 50-mile search found.
      return {
        zip,
        model: providerModel,
        providerModel,
        trim,
        units: first.units,
        unitsFound: first.units.length,
        totalFound: first.total,
        bestPrice: first.units[0]?.price,
        bestDealer: first.units[0]?.dealer,
        radiusUsed: 50,
        widened: false,
      };
    }
  } catch {
    return failure(zip, providerModel, trim);
  }
}

export interface TrimSearchOutcome {
  result: LocalUnitsResult;
  /** Trim whose units (if any) the result carries. */
  trimUsed: string | null;
  /** True when the step-up trim had no stock and base was searched. */
  fellBackToBase: boolean;
}

/**
 * Recommended-trim search with the no-stock fallback (task 029,
 * part 1): search the recommended trim first (50 widening to 150
 * miles inside fetchLocalUnits); only a clean zero within 150 miles
 * falls back to the base trim. A load error never falls back, since
 * stock is then unknown rather than absent.
 */
export async function fetchUnitsWithTrimFallback(args: {
  zip: string;
  providerModel: string;
  recommendedTrim?: string | null;
  baseTrim?: string | null;
  fetcher?: ListingsFetcher;
  baseUrl?: string;
  apiKey?: string;
  retryDelaysMs?: number[];
}): Promise<TrimSearchOutcome> {
  const recommended = args.recommendedTrim ?? null;
  const base = args.baseTrim ?? null;
  const shared = {
    zip: args.zip,
    providerModel: args.providerModel,
    fetcher: args.fetcher,
    baseUrl: args.baseUrl,
    apiKey: args.apiKey,
    retryDelaysMs: args.retryDelaysMs,
  };
  if (!recommended || !base || recommended === base) {
    const result = await fetchLocalUnits({
      ...shared,
      trim: recommended ?? base,
    });
    return { result, trimUsed: result.trim, fellBackToBase: false };
  }
  const first = await fetchLocalUnits({ ...shared, trim: recommended });
  if (first.error || first.totalFound > 0 || first.unitsFound > 0) {
    return { result: first, trimUsed: recommended, fellBackToBase: false };
  }
  const fallback = await fetchLocalUnits({ ...shared, trim: base });
  return { result: fallback, trimUsed: base, fellBackToBase: true };
}
