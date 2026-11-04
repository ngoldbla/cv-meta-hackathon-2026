/**
 * Price in context (task 054, part 2). For the unit a card is priced
 * on, at its model, trim and year: the local market inside the search
 * radius, the national market (no ZIP, no radius), and the MSRP.
 *
 * One provider stats call per market, so at most two per pick per
 * search. Each call asks the facets endpoint for one year bucket with
 * the listed-price percentiles (p5, p25, median, p75, p95) and the
 * median MSRP. The provider returns null for any percentile with fewer
 * than ten listings; the screens then say what is missing.
 *
 * The basis is the listed (advertised) price throughout: the provider's
 * percentiles exist only for it, so the unit is compared by its own
 * listed price, never by its price with fees. "Low" and "high" are the
 * 5th and 95th percentiles ("9 in 10 listed between"), which keeps one
 * mislisted car from stretching the range. Cached for 6 hours.
 *
 * Documented rounding: national percentiles come back interpolated
 * (for example 28498.451); every stat is rounded to the nearest whole
 * dollar here, once, and copied unchanged from then on.
 */

import { listingFilters, type Category } from "./categories";
import type { ListingsFetcher } from "./listings";

const REVALIDATE_SECONDS = 6 * 60 * 60;

export const STATS_METRICS = [
  "price.p5",
  "price.p25",
  "price.median",
  "price.p75",
  "price.p95",
  "msrp.median",
] as const;

export interface MarketStats {
  /** Listings of this model, trim and year in the market. */
  count: number;
  p5: number | null;
  p25: number | null;
  median: number | null;
  p75: number | null;
  p95: number | null;
  msrpMedian: number | null;
}

/** One pick's price context, for the unit its card is priced on. */
export interface PriceContext {
  make: string | null;
  model: string;
  trim: string | null;
  year: number | null;
  /** The local search radius in miles (50, or 150 when widened). */
  radius: number;
  /** Null when the local stats couldn't be loaded. */
  local: MarketStats | null;
  /** Null when the national stats couldn't be loaded. */
  national: MarketStats | null;
  /** The priced unit's own listed price and MSRP, when the listing has them. */
  unit: { vin: string | null; listedPrice: number | null; msrp: number | null };
}

export interface StatsQuery {
  providerModel: string;
  trim: string | null;
  year: number;
  category: Category;
  /** Local market only: the shopper's ZIP and the search radius. */
  zip?: string;
  radius?: number;
}

export function statsUrl(baseUrl: string, q: StatsQuery): string {
  const params = new URLSearchParams({
    facets: "year",
    metrics: STATS_METRICS.join(","),
    inventory_type: "new",
    availability_status: "stock",
    model: q.providerModel,
    year: String(q.year),
    ...listingFilters(q.category),
  });
  if (q.trim) params.set("trim", q.trim);
  if (q.zip && q.radius) {
    params.set("postal_code", q.zip);
    params.set("radius", String(q.radius));
  }
  return `${baseUrl.replace(/\/$/, "")}/facets?${params.toString()}`;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** A facets response -> the year's market stats (all null below ten listings). */
export function mapStatsResponse(body: unknown, year: number): MarketStats {
  const data = ((body ?? {}) as { data?: { total?: unknown; facets?: { year?: unknown } } }).data ?? {};
  const buckets = Array.isArray(data.facets?.year) ? (data.facets!.year as Record<string, unknown>[]) : [];
  const bucket = buckets.find((b) => String(b.value) === String(year));
  const metrics = (bucket?.metrics ?? {}) as Record<string, { value?: unknown } | undefined>;
  const m = (name: (typeof STATS_METRICS)[number]) => {
    const v = num(metrics[name]?.value);
    return v === null ? null : Math.round(v);
  };
  return {
    count: num(bucket?.count) ?? 0,
    p5: m("price.p5"),
    p25: m("price.p25"),
    median: m("price.median"),
    p75: m("price.p75"),
    p95: m("price.p95"),
    msrpMedian: m("msrp.median"),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One stats call (cached 6 hours), or null when it fails. */
export async function fetchMarketStats(args: StatsQuery & {
  fetcher?: ListingsFetcher;
  baseUrl?: string;
  apiKey?: string;
  retryDelaysMs?: number[];
}): Promise<MarketStats | null> {
  const baseUrl = args.baseUrl ?? process.env.LOWKEY_PROVIDER_BASE_URL;
  const apiKey = args.apiKey ?? process.env.LOWKEY_PROVIDER_KEY;
  if (!baseUrl || !apiKey || !args.providerModel) return null;
  const fetcher: ListingsFetcher = args.fetcher ?? (fetch as unknown as ListingsFetcher);
  const url = statsUrl(baseUrl, args);
  const delays = args.retryDelaysMs ?? [700, 1400, 2800];
  try {
    for (let attempt = 0; ; attempt += 1) {
      const res = await fetcher(url, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        next: { revalidate: REVALIDATE_SECONDS },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return mapStatsResponse(await res.json(), args.year);
      if (res.status === 429 && attempt < delays.length) {
        const retryAfter = Number(res.headers?.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 10000) : delays[attempt]!);
        continue;
      }
      console.error(`lowkey: stats call failed (HTTP ${res.status})`);
      return null;
    }
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- facts

export type Position = { side: "lower" | "higher"; share: 0.9 | 0.75 | 0.5 } | { side: "at"; share: null };

/**
 * Where a listed price sits among the market's percentiles, stated
 * only as far as the percentiles prove it: below p5 is lower than at
 * least 9 in 10, below p25 lower than 3 in 4, below the median lower
 * than half (and the mirror image above). Null without a median.
 */
export function positionOf(price: number, s: MarketStats): Position | null {
  if (s.median === null) return null;
  if (price === s.median) return { side: "at", share: null };
  if (price < s.median) {
    if (s.p5 !== null && price < s.p5) return { side: "lower", share: 0.9 };
    if (s.p25 !== null && price < s.p25) return { side: "lower", share: 0.75 };
    return { side: "lower", share: 0.5 };
  }
  if (s.p95 !== null && price > s.p95) return { side: "higher", share: 0.9 };
  if (s.p75 !== null && price > s.p75) return { side: "higher", share: 0.75 };
  return { side: "higher", share: 0.5 };
}

export interface PriceFacts {
  /** The priced unit's listed price, or null when the listing has none. */
  listed: number | null;
  /** listed − local median (negative = under), or null. */
  vsLocalMedian: number | null;
  /** listed − national median (negative = under), or null. */
  vsNationalMedian: number | null;
  /** The MSRP compared with: the unit's own, else the trim's median. */
  msrp: number | null;
  msrpOwn: boolean;
  /** listed − MSRP (negative = under), or null. */
  vsMsrp: number | null;
  position: Position | null;
}

/** Every derived figure, in code, from one context. */
export function priceFacts(ctx: PriceContext): PriceFacts {
  const listed = ctx.unit.listedPrice;
  const localMedian = ctx.local?.median ?? null;
  const nationalMedian = ctx.national?.median ?? null;
  const msrpOwn = ctx.unit.msrp !== null;
  const msrp = ctx.unit.msrp ?? ctx.national?.msrpMedian ?? ctx.local?.msrpMedian ?? null;
  return {
    listed,
    vsLocalMedian: listed !== null && localMedian !== null ? listed - localMedian : null,
    vsNationalMedian: listed !== null && nationalMedian !== null ? listed - nationalMedian : null,
    msrp,
    msrpOwn,
    vsMsrp: listed !== null && msrp !== null ? listed - msrp : null,
    position: listed !== null && ctx.local ? positionOf(listed, ctx.local) : null,
  };
}

const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const money = (n: number) => usd0.format(Math.round(n));

function gap(delta: number, what: string): string {
  if (delta === 0) return `at ${what}`;
  return `${money(Math.abs(delta))} ${delta < 0 ? "under" : "over"} ${what}`;
}

const SHARE_WORDS = { 0.9: "9 in 10", 0.75: "3 in 4", 0.5: "half" } as const;

/** "Lower than 3 in 4 listed within 50 miles." */
export function positionText(p: Position, radius: number): string {
  if (p.side === "at") return `At the middle of those listed within ${radius} miles.`;
  return `${p.side === "lower" ? "Lower" : "Higher"} than ${SHARE_WORDS[p.share]} listed within ${radius} miles.`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface SentenceInput {
  title: string;
  radius: number;
  localLoaded: boolean;
  localCount: number | null;
  facts: Pick<PriceFacts, "listed" | "vsLocalMedian" | "vsMsrp" | "msrpOwn" | "position">;
}

/**
 * The plain sentence under the strip. Every figure in it is a guarded
 * spec prop; when a figure's stats are missing it says what is missing.
 */
export function priceSentence(s: SentenceInput): string {
  const { facts } = s;
  if (facts.listed === null) return "This listing shows no listed price, so it can't be placed among the others.";
  const out: string[] = [];
  const msrpWhat = facts.msrpOwn ? "its MSRP" : "the median MSRP for this trim";
  const msrpPart = facts.vsMsrp !== null ? gap(facts.vsMsrp, msrpWhat) : null;
  if (facts.vsLocalMedian !== null) {
    out.push(`${cap(gap(facts.vsLocalMedian, `the local median for a ${s.title}`))}${msrpPart ? `, and ${msrpPart}` : ""}.`);
  } else {
    if (!s.localLoaded) out.push("Local prices couldn't be loaded just now.");
    else out.push(`Too few listed within ${s.radius} miles for a local median (${s.localCount ?? 0} listed).`);
    if (msrpPart) out.push(`${cap(msrpPart)}.`);
  }
  if (facts.vsMsrp === null) out.push("No MSRP on record for this car.");
  if (facts.position) out.push(positionText(facts.position, s.radius));
  return out.join(" ");
}

/** The results row's compact line: "$1,180 under the local median", or null. */
export function rowPriceLine(vsLocalMedian: number | null): string | null {
  return vsLocalMedian === null ? null : gap(vsLocalMedian, "the local median");
}

// ----------------------------------------------------------- far away

/** A far-away unit must beat the best local price by at least this. */
export const FAR_MIN_USD = 750;
export const FAR_MIN_SHARE = 0.03;

/** The margin a far-away unit must beat: the larger of $750 and 3%. */
export function farMargin(bestLocal: number): number {
  return Math.max(FAR_MIN_USD, Math.round(bestLocal * FAR_MIN_SHARE));
}

export interface FarCandidate {
  price: number;
  distanceMiles: number;
  vin: string | null;
}

/**
 * Up to three units beyond the local radius that beat the best local
 * price by the margin, cheapest first. Units already in local stock are
 * left out. `saves` is best local − price (whole dollars, positive).
 */
export function farLeads<T extends FarCandidate>(
  units: readonly T[],
  bestLocal: number,
  radius: number,
  localVins: readonly (string | null)[] = [],
  max = 3,
): (T & { saves: number })[] {
  const margin = farMargin(bestLocal);
  const seen = new Set(localVins.filter((v): v is string => Boolean(v)));
  return units
    .filter((u) => u.distanceMiles > radius && bestLocal - u.price >= margin && !(u.vin && seen.has(u.vin)))
    .sort((a, b) => a.price - b.price || a.distanceMiles - b.distanceMiles)
    .slice(0, max)
    .map((u) => ({ ...u, saves: bestLocal - u.price }));
}
