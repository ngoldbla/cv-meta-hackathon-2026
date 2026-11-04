import { get } from "@vercel/blob";

import type { Category } from "./categories";
import type { EpaVariant } from "./mpgmatch";
import type { TaxSection } from "./tax";

/**
 * Server-only access to the private depreciation table (task 027).
 *
 * Built weekly on dylan-pc by lowkey/pipeline/build_table.py and
 * uploaded as the private blob `lowkey/table.json`. Read here with
 * BLOB_READ_WRITE_TOKEN and cached in memory for one hour. Callers
 * only ever receive one category's lineup (see tools.ts); no route
 * returns the whole table.
 */

export type { Category };

export const TABLE_PATHNAME = "lowkey/table.json";
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface TablePick {
  rank: number | null;
  make: string;
  model: string;
  providerModel: string;
  retentionRetail: number;
  retentionAfterDiscount: number;
  depPerMonth: number;
  typicalNewPrice: number;
  sampleSizes: {
    byAge: Record<string, number>;
    total: number;
    fittedAges: number[];
  };
  mpg: number | null;
  /** Task 042, part 2b: EPA variants a local unit is matched to. */
  epaVariants?: EpaVariant[];
  /** Task 029 trim/lifespan fields (null on tables built before 029). */
  baseTrim?: string | null;
  stepUpTrim?: string | null;
  recommendedTrim?: string | null;
  trimBaseMsrp?: number | null;
  trimRecommendedMsrp?: number | null;
  trimStepCost?: number | null;
  trimIsStepUp?: boolean;
  trimGuardHit?: boolean;
  trimRetention5y?: number | null;
  trimSource?: string | null;
  trimFeatures?: string[];
  lifespanYears?: number | null;
  lifespanMiles?: number | null;
  lifespanSource?: string | null;
  lifespanAsOf?: string | null;
  /** Task 057: sold price ÷ new price by age in years (ages with ≥ 30 sales); null on older tables. */
  retentionByAge?: Record<string, number> | null;
  /** Task 057: the per-year slope of log(retention) from the same fit. */
  retentionSlopePerYear?: number | null;
}

export interface TableLineup {
  category: Category;
  picks: TablePick[];
  commodity: TablePick | null;
  commodityFlag: "badge" | "extra" | null;
  makes: string[];
  soldTotal: number;
}

export interface GasForecast {
  horizonWeeks: number;
  p10: number[];
  p50: number[];
  p90: number[];
  meanP10: number;
  meanP50: number;
  meanP90: number;
}

export interface GasSeriesEntry {
  duoarea: string;
  areaName: string | null;
  displayName: string;
  seriesId: string | null;
  latestPrice: number;
  latestDate: string;
  asOf: string;
  forecast: GasForecast | null;
}

export interface LowkeyTable {
  version: number;
  builtAt: string;
  tradeInFactor: number;
  /** Minivan and Hybrid are absent on tables built before task 042. */
  lineups: Partial<Record<Category, TableLineup>> & Record<"Sedan" | "SUV" | "Pickup", TableLineup>;
  mpg: Record<
    string,
    { mpg: number; epaId: string; epaModel: string; drive: string } | null
  >;
  gasSeries: Record<string, GasSeriesEntry>;
  /** Task 037, P19: vehicle sales-tax rules (null on older tables). */
  tax?: TaxSection | null;
  zipMap: {
    cityZip3: Record<string, number[]>;
    zip3Ranges: [number, number, string][];
    stateSeries: Record<string, string>;
    paddByState: Record<string, string>;
    fallbackDuoarea: string;
  };
  totals: { soldVehicles: number; asOf: string };
  sources: {
    provider: { asOf: string };
    epa: { asOf: string; modelYear: number };
    eia: { asOf: string | null };
    forecast: { model: string; asOf: string; horizonWeeks: number };
  };
}

let cached: { data: LowkeyTable; fetchedAt: number } | null = null;

/** Test hook: seed or clear the in-memory table cache. */
export function setCachedTable(data: LowkeyTable | null): void {
  cached = data ? { data, fetchedAt: Date.now() } : null;
}

export function parseTable(text: string): LowkeyTable {
  const data = JSON.parse(text) as LowkeyTable;
  if (data.version !== 1 || !data.lineups?.Sedan || !data.gasSeries) {
    throw new Error("depreciation table has an unexpected shape");
  }
  return data;
}

export async function getTable(): Promise<LowkeyTable> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }
  // Local checks only: a freshly built table can be tried before it is
  // uploaded. Ignored on Vercel, which always reads the Blob table.
  const localFile = process.env.LOWKEY_TABLE_FILE;
  if (localFile && !process.env.VERCEL) {
    const { readFile } = await import("node:fs/promises");
    const data = parseTable(await readFile(localFile, "utf8"));
    cached = { data, fetchedAt: Date.now() };
    return data;
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const result = await get(TABLE_PATHNAME, {
    access: "private",
    useCache: false,
    ...(token ? { token } : {}),
  });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("depreciation table is unavailable");
  }
  const text = await new Response(result.stream).text();
  const data = parseTable(text);
  cached = { data, fetchedAt: Date.now() };
  return data;
}

/** UI-shaped pick: keeps the task-025/026 field names the cards use. */
export function toRankPick(pick: TablePick, flag?: "badge" | "extra") {
  return {
    rank: pick.rank,
    make: pick.make,
    model: pick.model,
    providerModel: pick.providerModel,
    price: pick.typicalNewPrice,
    typicalNewPrice: pick.typicalNewPrice,
    retention5y: pick.retentionAfterDiscount,
    retentionRetail: pick.retentionRetail,
    retentionAfterDiscount: pick.retentionAfterDiscount,
    depPerMonth: pick.depPerMonth,
    sampleSizes: pick.sampleSizes,
    mpg: pick.mpg,
    epaVariants: pick.epaVariants ?? [],
    baseTrim: pick.baseTrim ?? null,
    stepUpTrim: pick.stepUpTrim ?? null,
    recommendedTrim: pick.recommendedTrim ?? null,
    trimBaseMsrp: pick.trimBaseMsrp ?? null,
    trimRecommendedMsrp: pick.trimRecommendedMsrp ?? null,
    trimStepCost: pick.trimStepCost ?? null,
    trimIsStepUp: pick.trimIsStepUp ?? false,
    trimGuardHit: pick.trimGuardHit ?? false,
    trimRetention5y: pick.trimRetention5y ?? null,
    trimSource: pick.trimSource ?? null,
    trimFeatures: pick.trimFeatures ?? [],
    lifespanYears: pick.lifespanYears ?? null,
    lifespanMiles: pick.lifespanMiles ?? null,
    lifespanSource: pick.lifespanSource ?? null,
    lifespanAsOf: pick.lifespanAsOf ?? null,
    ...(flag ? { flag } : {}),
  };
}

export type RankPick = ReturnType<typeof toRankPick>;

/** One category's lineup plus footer metadata. Nothing else leaks. */
export function lineupFromTable(table: LowkeyTable, category: Category) {
  const lineup = table.lineups[category];
  if (!lineup) throw new Error(`no ${category} lineup in the table yet`);
  const picks = lineup.picks.map((p) => ({
    ...toRankPick(p),
    // Task 031: the table's discount factor, so the card can show
    // after-discount percentages from the same factor the dollars use.
    tradeInFactor: table.tradeInFactor,
    // Task 031: the table's current model year, for leftover notes.
    currentYear: table.sources.epa.modelYear,
  }));
  const commodity = lineup.commodity
    ? {
        ...toRankPick(
          lineup.commodity,
          lineup.commodityFlag === "badge" || lineup.commodityFlag === "extra"
            ? lineup.commodityFlag
            : undefined,
        ),
        tradeInFactor: table.tradeInFactor,
        currentYear: table.sources.epa.modelYear,
      }
    : null;
  return {
    category: lineup.category,
    picks,
    commodity,
    soldVehicles: table.totals.soldVehicles,
    providerAsOf: table.totals.asOf,
    builtAt: table.builtAt,
  };
}

/**
 * Resolve a caller-supplied model string ("Honda CR-V", "CR-V") to a
 * table pick, longest provider-model match first (so "Silverado 1500"
 * beats the bare Ram "1500"), mirroring the old fixture resolver.
 * Task 042: the same model can sit in two lineups (the gas CR-V in
 * SUV, the hybrid CR-V in Hybrid), so a given category is searched
 * first.
 */
export function resolveTablePick(
  table: LowkeyTable,
  model: string,
  category?: string | null,
): { pick: TablePick; category: Category } | undefined {
  const wanted = model.trim().toLowerCase();
  const all: { pick: TablePick; category: Category }[] = [];
  const order = (Object.keys(table.lineups) as Category[]).sort(
    (a, b) => Number(b === category) - Number(a === category),
  );
  for (const category of order) {
    const lineup = table.lineups[category];
    if (!lineup) continue;
    for (const pick of lineup.picks) all.push({ pick, category });
    if (lineup.commodity) {
      if (!lineup.picks.some((p) => p.model === lineup.commodity!.model)) {
        all.push({ pick: lineup.commodity, category });
      }
    }
  }
  // Stable sort: within one length the preferred category stays first.
  const sorted = [...all].sort(
    (a, b) => b.pick.model.length - a.pick.model.length,
  );
  for (const entry of sorted) {
    const bare = entry.pick.model.toLowerCase();
    const full = `${entry.pick.make} ${entry.pick.model}`.toLowerCase();
    if (wanted === bare || wanted === full) return entry;
  }
  for (const entry of sorted) {
    const bare = entry.pick.model.toLowerCase();
    if (wanted.endsWith(` ${bare}`) || wanted.endsWith(bare)) return entry;
  }
  return undefined;
}
