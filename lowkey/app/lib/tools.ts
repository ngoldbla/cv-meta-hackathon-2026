import { isCategory } from "./categories";
import { fuelForModel } from "./fuel";
import { matchUnitMpg } from "./mpgmatch";
import { aprLabel, getDefaultApr } from "./fred";
import { fetchFarUnits, fetchUnitsForYear, fetchUnitsWithTrimFallback, type LocalUnit } from "./listings";
import { farLeads, farMargin, fetchMarketStats, type PriceContext } from "./priceStats";
import type { DealInputs, DownRule } from "./deal";
import { ownershipMath } from "./ownership";
import { resolveTax, taxNoticeText } from "./tax";
import {
  getTable,
  lineupFromTable,
  resolveTablePick,
  type Category,
} from "./table";

/**
 * The search's executors (tasks 027, 049). rank_category reads the private Blob table
 * (one category per call), local_units searches the listings provider
 * over REST, and ownership_math prices the cheapest local unit (or
 * the table's typical price, labelled). Called only by code
 * (lib/searchRun.ts); no model calls them since task 049.
 */

export async function executeRankCategory(category: Category) {
  const table = await getTable();
  return lineupFromTable(table, category);
}

export async function executeLocalUnits(args: {
  zip: string;
  model?: string;
  category?: string;
  radius?: number;
  /** Task 054: every new model year instead of the newest one. */
  allYears?: boolean;
}) {
  const { zip, model, category } = args;
  let table = null;
  try {
    table = await getTable();
  } catch {
    table = null;
  }
  const resolved = table && model ? resolveTablePick(table, model, category) : undefined;
  const providerModel = resolved?.pick.providerModel ?? (model ?? "");
  const searchCategory = resolved?.category ?? (isCategory(category) ? category : undefined);
  // Task 054: one model year by default, the pick's newest (its newest
  // EPA variant); "include older model years" searches every new year.
  const variantYears = (resolved?.pick.epaVariants ?? []).map((v) => v.year);
  const newestYear = args.allYears || variantYears.length === 0 ? null : Math.max(...variantYears);
  const search = await fetchUnitsForYear({
    zip,
    providerModel,
    recommendedTrim: resolved?.pick.recommendedTrim ?? null,
    baseTrim: resolved?.pick.baseTrim ?? null,
    category: searchCategory,
    newestYear,
  });
  const result = search.result;
  // Task 042, part 2b: the fuel estimate uses the cheapest local
  // unit's own EPA match (the unit the payment prices), else the
  // model's figure labelled "typical MPG".
  const match = resolved
    ? matchUnitMpg(result.units[0] ?? {}, resolved.pick.epaVariants, resolved.pick.mpg)
    : null;
  const fuel =
    table && match
      ? fuelForModel({ mpg: match.mpg, mpgLevel: match.level, zip, table })
      : null;
  return {
    zip,
    model: resolved?.pick.model ?? (model ?? null),
    providerModel: providerModel || null,
    make: resolved?.pick.make ?? null,
    category: resolved?.category ?? category ?? null,
    recommendedTrim: resolved?.pick.recommendedTrim ?? null,
    baseTrim: resolved?.pick.baseTrim ?? null,
    trimUsed: search.trimUsed,
    fellBackToBase: search.fellBackToBase,
    yearUsed: search.yearUsed,
    fellBackToOlderYear: search.fellBackToOlderYear,
    allYears: Boolean(args.allYears),
    units: result.units,
    unitsFound: result.unitsFound,
    totalFound: result.totalFound,
    bestPrice: result.bestPrice ?? null,
    bestDealer: result.bestDealer ?? null,
    radiusUsed: result.radiusUsed,
    widened: result.widened,
    error: result.error ?? null,
    fuel,
  };
}

/**
 * Task 054: the fuel estimate for a unit the shopper chose, from that
 * unit's own EPA match (the same rule the cheapest unit gets).
 */
export async function fuelForUnit(args: { zip: string; model: string; category?: string; unit: LocalUnit }) {
  let table = null;
  try {
    table = await getTable();
  } catch {
    return null;
  }
  const resolved = resolveTablePick(table, args.model, args.category);
  if (!resolved) return null;
  const match = matchUnitMpg(args.unit, resolved.pick.epaVariants, resolved.pick.mpg);
  return match ? fuelForModel({ mpg: match.mpg, mpgLevel: match.level, zip: args.zip, table }) : null;
}

/**
 * Task 054, part 2: the price context for the unit a card is priced
 * on. Two stats calls at most (local, national), each cached 6 hours.
 * Without a year or a model there is nothing to match, so no call.
 */
export async function executePriceContext(args: {
  zip: string;
  providerModel: string | null;
  make: string | null;
  model: string;
  trim: string | null;
  category: string | null;
  radius: number;
  unit: LocalUnit;
}): Promise<{ context: PriceContext | null; calls: number }> {
  const { unit } = args;
  if (!args.providerModel || unit.year === null || !isCategory(args.category)) return { context: null, calls: 0 };
  const q = { providerModel: args.providerModel, trim: args.trim, year: unit.year, category: args.category };
  const local = await fetchMarketStats({ ...q, zip: args.zip, radius: args.radius });
  const national = await fetchMarketStats(q);
  return {
    calls: 2,
    context: {
      make: args.make,
      model: args.model,
      trim: args.trim,
      year: unit.year,
      radius: args.radius,
      local,
      national,
      unit: { vin: unit.vin, listedPrice: unit.listedPrice ?? null, msrp: unit.msrp ?? null },
    },
  };
}

export interface FartherResult {
  /** The cheapest local price the leads are measured against. */
  bestLocal: number | null;
  margin: number | null;
  radius: number;
  year: number | null;
  trim: string | null;
  leads: (LocalUnit & { saves: number })[];
  /** How many units the national search returned (before the margin rule). */
  searched: number;
  error: string | null;
  calls: number;
}

/**
 * Task 054, part 2: far-away leads for one car. The local search is the
 * card's own (cached); the national search is the one on-demand call.
 * Only units with a VIN can be chosen, so only those are offered.
 */
export async function executeFarther(args: {
  zip: string;
  model: string;
  category?: string;
  allYears?: boolean;
}): Promise<FartherResult> {
  const local = await executeLocalUnits({ zip: args.zip, model: args.model, category: args.category, allYears: args.allYears });
  const face = local.units[0] ?? null;
  const base = {
    bestLocal: local.bestPrice,
    margin: local.bestPrice !== null ? farMargin(local.bestPrice) : null,
    radius: local.radiusUsed,
    year: face?.year ?? null,
    trim: local.trimUsed,
    leads: [],
    searched: 0,
    calls: 0,
  };
  if (!face || local.bestPrice === null || face.year === null || !local.providerModel || !isCategory(local.category)) {
    return { ...base, error: local.error ?? "No local price to compare with" };
  }
  const far = await fetchFarUnits({
    zip: args.zip,
    providerModel: local.providerModel,
    trim: local.trimUsed,
    year: face.year,
    category: local.category,
  });
  if (!far) return { ...base, calls: 1, error: "Couldn't search farther away just now" };
  const withVin = far.units.filter((u) => u.vin !== null);
  return {
    ...base,
    calls: 1,
    searched: far.units.length,
    leads: farLeads(withVin, local.bestPrice, local.radiusUsed, local.units.map((u) => u.vin)),
    error: null,
  };
}

export async function executeOwnership(args: {
  price?: number;
  down?: number;
  apr?: number;
  term?: number;
  model?: string;
  zip?: string;
  /** The lineup the model is from (task 042: "CR-V" is in SUV and Hybrid). */
  category?: string;
  retention5y?: number;
  /** Set by the fast path when `price` is already the resolved price. */
  priceSource?: "local" | "typical" | "given" | "chosen";
  /**
   * How `down` was set (task 041), so the listing sheet can price
   * another unit the same way. Default: a stated dollar `down` is a
   * fixed amount; no `down` is 10% of the price.
   */
  downRule?: DownRule;
  /** Task 054: with priceSource "chosen", the card's local search facts. */
  trimUsed?: string | null;
  fellBackToBase?: boolean;
}) {
  const { down, apr, term, model, zip } = args;
  let table = null;
  try {
    table = await getTable();
  } catch {
    table = null;
  }
  const resolved = table && model ? resolveTablePick(table, model, args.category) : undefined;
  const retention5y =
    args.retention5y ?? resolved?.pick.retentionAfterDiscount;

  let price = args.price;
  let priceSource: "local" | "typical" | "given" | "chosen" = args.priceSource ?? "given";
  let typicalPrice: number | null = resolved?.pick.typicalNewPrice ?? null;
  let trimUsed: string | null = resolved?.pick.recommendedTrim ?? null;
  let fellBackToBase = false;
  // Task 054: the search (runSearch) passes the price it resolved, with
  // the local search's facts; no second search. Other callers search.
  if (args.priceSource !== undefined && args.trimUsed !== undefined) {
    trimUsed = args.trimUsed ?? trimUsed;
    fellBackToBase = args.fellBackToBase ?? false;
  } else if (zip && resolved) {
    const search = await fetchUnitsWithTrimFallback({
      zip,
      providerModel: resolved.pick.providerModel,
      recommendedTrim: resolved.pick.recommendedTrim ?? null,
      baseTrim: resolved.pick.baseTrim ?? null,
      category: resolved.category,
    });
    const local = search.result;
    trimUsed = search.trimUsed;
    fellBackToBase = search.fellBackToBase;
    if (local.bestPrice !== undefined) {
      price = local.bestPrice;
      priceSource = "local";
    } else {
      // No usable local unit (none found, or the search failed): the
      // table's typical price, labelled. The card shows the load
      // error alongside this typical-price payment.
      price = resolved.pick.typicalNewPrice;
      priceSource = "typical";
    }
  } else if (price === undefined && resolved) {
    price = resolved.pick.typicalNewPrice;
    priceSource = "typical";
  }
  if (price === undefined) {
    throw new Error("ownership_math needs a price or a ranked model");
  }

  const aprInfo = apr === undefined ? await getDefaultApr() : null;
  // Task 037: sales tax on the price with fees for the shopper's
  // state (ZIP -> state via the table's ZIP3 rules; DC uses MPG).
  // Unknown state means no tax in the loan and an explicit card
  // line, never a guessed rate.
  const taxRes = resolveTax({
    zip,
    priceWithFees: price,
    mpg: resolved?.pick.mpg,
    zip3Ranges: table?.zipMap.zip3Ranges,
    tax: table?.tax,
  });
  const result = ownershipMath({
    price,
    tax: taxRes.status === "included" ? taxRes.tax : 0,
    down,
    apr: apr ?? aprInfo?.aprPercent,
    term,
    model: resolved?.pick.model ?? model,
    retention5y,
  });
  // Task 041: the assumptions a second local unit is priced with.
  const dealInputs: DealInputs = {
    downRule:
      args.downRule ??
      (down !== undefined
        ? { kind: "amount", usd: down }
        : { kind: "share", share: 0.1 }),
    aprPercent: result.aprPercent,
    termMonths: result.termMonths,
    retention5y: result.retention5y,
    taxStatus: taxRes.status,
    taxRule: taxRes.rule,
    mpg: resolved?.pick.mpg ?? null,
  };
  return {
    ...result,
    dealInputs,
    taxStatus: taxRes.status,
    taxState: taxRes.state,
    taxStateName: taxRes.rule?.name ?? null,
    taxLabel: taxRes.rule?.label ?? null,
    taxRate: taxRes.effectiveRate,
    taxNotice: taxNoticeText(taxRes),
    make: resolved?.pick.make ?? null,
    priceSource,
    priceLabel: priceSource === "typical" ? "typical price" : null,
    typicalPrice,
    trimUsed,
    fellBackToBase,
    recommendedTrim: resolved?.pick.recommendedTrim ?? null,
    baseTrim: resolved?.pick.baseTrim ?? null,
    lifespanYears: resolved?.pick.lifespanYears ?? null,
    aprDate: aprInfo?.dateIso ?? null,
    aprAssumed: aprInfo?.assumed ?? false,
    aprLabel: aprInfo ? aprLabel(aprInfo) : null,
  };
}
