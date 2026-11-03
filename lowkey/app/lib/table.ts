import { get } from "@vercel/blob";

/**
 * Server-only access to the private depreciation table (task 027).
 *
 * Built weekly on dylan-pc by lowkey/pipeline/build_table.py and
 * uploaded as the private blob `lowkey/table.json`. Read here with
 * BLOB_READ_WRITE_TOKEN and cached in memory for one hour. Callers
 * only ever receive one category's lineup (see tools.ts); no route
 * returns the whole table.
 */

export type Category = "Sedan" | "SUV" | "Pickup";

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
  lineups: Record<Category, TableLineup>;
  mpg: Record<
    string,
    { mpg: number; epaId: string; epaModel: string; drive: string } | null
  >;
  gasSeries: Record<string, GasSeriesEntry>;
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
    ...(flag ? { flag } : {}),
  };
}

export type RankPick = ReturnType<typeof toRankPick>;

/** One category's lineup plus footer metadata. Nothing else leaks. */
export function lineupFromTable(table: LowkeyTable, category: Category) {
  const lineup = table.lineups[category];
  const picks = lineup.picks.map((p) => toRankPick(p));
  const commodity = lineup.commodity
    ? toRankPick(
        lineup.commodity,
        lineup.commodityFlag === "badge" || lineup.commodityFlag === "extra"
          ? lineup.commodityFlag
          : undefined,
      )
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
 */
export function resolveTablePick(
  table: LowkeyTable,
  model: string,
): { pick: TablePick; category: Category } | undefined {
  const wanted = model.trim().toLowerCase();
  const all: { pick: TablePick; category: Category }[] = [];
  for (const category of Object.keys(table.lineups) as Category[]) {
    const lineup = table.lineups[category];
    for (const pick of lineup.picks) all.push({ pick, category });
    if (lineup.commodity) {
      if (!lineup.picks.some((p) => p.model === lineup.commodity!.model)) {
        all.push({ pick: lineup.commodity, category });
      }
    }
  }
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
