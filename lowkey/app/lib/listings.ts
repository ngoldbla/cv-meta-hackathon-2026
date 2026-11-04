/**
 * Live local listings (task 027, part 3). Server-side REST search:
 * new, in stock, the category filter (strict gas-only for Sedan, SUV and Pickup; task 042), cheapest first, limit 3, radius 50
 * widening to 150 when fewer than 3 are found. Results are cached
 * per model/ZIP/radius for 6 hours by the Next.js fetch cache, with
 * an 8-second timeout. Any failure returns the "couldn't load" card
 * state; this module never invents sample units.
 *
 * Task 031: the search keeps all model years of new units (no year
 * filter); the card shows each unit's year and notes leftover years.
 */

import { listingFilters, type Category } from "./categories";

export interface LocalUnit {
  price: number;
  dealer: string;
  distanceMiles: number;
  daysOnLot: number | null;
  year: number | null;
  trim: string | null;
  url: string;
  /** The listing's VIN (task 041; shown under licence section 3), or null. */
  vin: string | null;
  /** Task 042, part 2b: what the per-unit MPG match reads (or null). */
  drivetrain?: string | null;
  engine?: string | null;
  cylinders?: number | null;
  powertrain?: string | null;
  /** Task 054: the advertised price (the price-context basis), the unit's own MSRP, and where the dealer is. */
  listedPrice?: number | null;
  msrp?: number | null;
  city?: string | null;
  state?: string | null;
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
  category: Category = "Sedan",
  /** Task 054: one model year, or null for every new model year. */
  year: number | null = null,
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
    ...listingFilters(category),
    // Task 042, part 2b: the fields the per-unit MPG match needs,
    // projected in the same call.
    // Task 054: msrp, city and state for the price context.
    fields: "default,drivetrain,engine,cylinders,powertrain_type,msrp,city,state",
  });
  if (trim) params.set("trim", trim);
  if (year !== null) params.set("year", String(year));
  return `${baseUrl.replace(/\/$/, "")}/listings?${params.toString()}`;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** A well-formed 17-character VIN (no I, O or Q), or null. */
export function vinOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toUpperCase();
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(v) ? v : null;
}

/** Map a provider response to card units (cheapest first, at most 3). */
export function mapListingsResponse(
  body: unknown,
  _zip?: string,
  max = 3,
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
      vin: vinOf(r.vin),
      drivetrain: typeof r.drivetrain === "string" ? r.drivetrain : null,
      engine: typeof r.engine === "string" ? r.engine : null,
      cylinders: num(r.cylinders),
      powertrain: typeof r.powertrain_type === "string" ? r.powertrain_type : null,
      listedPrice: num(r.price),
      msrp: num(r.msrp),
      city: typeof r.city === "string" && r.city ? r.city : null,
      state: typeof r.state === "string" && r.state ? r.state : null,
    });
  }
  units.sort((a, b) => a.price - b.price);
  const total = num(root.pagination?.total) ?? units.length;
  return { units: units.slice(0, max), total };
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
  category?: Category;
  /** Task 054: one model year, or null/absent for every new model year. */
  year?: number | null;
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
    const url = listingsUrl(baseUrl!, providerModel, zip, radius, trim, args.category, args.year ?? null);
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
  category?: Category;
  year?: number | null;
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
    category: args.category,
    year: args.year ?? null,
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

/**
 * The national search for far-away leads (task 054, part 2): the same
 * model, trim and year with no radius, cheapest first. The ZIP is the
 * distance origin only. One call, made on demand, cached for 6 hours.
 */
export const FAR_LIMIT = 20;

export function farListingsUrl(
  baseUrl: string,
  providerModel: string,
  zip: string,
  trim: string | null,
  year: number,
  category: Category = "Sedan",
): string {
  const params = new URLSearchParams({
    inventory_type: "new",
    availability_status: "stock",
    model: providerModel,
    year: String(year),
    postal_code: zip,
    sort: "price",
    price_basis: "selected",
    limit: String(FAR_LIMIT),
    ...listingFilters(category),
    fields: "default,drivetrain,engine,cylinders,powertrain_type,msrp,city,state",
  });
  if (trim) params.set("trim", trim);
  return `${baseUrl.replace(/\/$/, "")}/listings?${params.toString()}`;
}

export async function fetchFarUnits(args: {
  zip: string;
  providerModel: string;
  trim: string | null;
  year: number;
  category?: Category;
  fetcher?: ListingsFetcher;
  baseUrl?: string;
  apiKey?: string;
}): Promise<{ units: LocalUnit[]; total: number } | null> {
  const baseUrl = args.baseUrl ?? process.env.LOWKEY_PROVIDER_BASE_URL;
  const apiKey = args.apiKey ?? process.env.LOWKEY_PROVIDER_KEY;
  if (!baseUrl || !apiKey || !args.providerModel || !/^\d{5}$/.test(args.zip)) return null;
  const fetcher: ListingsFetcher = args.fetcher ?? (fetch as unknown as ListingsFetcher);
  try {
    const res = await fetcher(farListingsUrl(baseUrl, args.providerModel, args.zip, args.trim, args.year, args.category), {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return mapListingsResponse(await res.json(), args.zip, FAR_LIMIT);
  } catch {
    return null;
  }
}

export interface YearSearchOutcome extends TrimSearchOutcome {
  /** The model year searched, or null for every new model year. */
  yearUsed: number | null;
  /** True when the newest year had no stock and the year before was searched. */
  fellBackToOlderYear: boolean;
}

/**
 * Task 054: one model year at a time. The newest model year is searched
 * first (with the trim fallback inside); only a clean zero within 150
 * miles falls back to the year before. `newestYear` null searches every
 * new model year (the shopper's "include older model years").
 */
export async function fetchUnitsForYear(
  args: Parameters<typeof fetchUnitsWithTrimFallback>[0] & { newestYear: number | null },
): Promise<YearSearchOutcome> {
  const { newestYear, ...rest } = args;
  if (newestYear === null) {
    const all = await fetchUnitsWithTrimFallback({ ...rest, year: null });
    return { ...all, yearUsed: null, fellBackToOlderYear: false };
  }
  const first = await fetchUnitsWithTrimFallback({ ...rest, year: newestYear });
  if (first.result.error || first.result.totalFound > 0 || first.result.unitsFound > 0) {
    return { ...first, yearUsed: newestYear, fellBackToOlderYear: false };
  }
  const older = await fetchUnitsWithTrimFallback({ ...rest, year: newestYear - 1 });
  return { ...older, yearUsed: newestYear - 1, fellBackToOlderYear: true };
}
