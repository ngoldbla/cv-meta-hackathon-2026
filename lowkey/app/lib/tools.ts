import { isCategory } from "./categories";
import { fuelForModel } from "./fuel";
import { matchUnitMpg } from "./mpgmatch";
import { aprLabel, getDefaultApr } from "./fred";
import { fetchUnitsWithTrimFallback } from "./listings";
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
  const search = await fetchUnitsWithTrimFallback({
    zip,
    providerModel,
    recommendedTrim: resolved?.pick.recommendedTrim ?? null,
    baseTrim: resolved?.pick.baseTrim ?? null,
    category: searchCategory,
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
  priceSource?: "local" | "typical" | "given";
  /**
   * How `down` was set (task 041), so the listing sheet can price
   * another unit the same way. Default: a stated dollar `down` is a
   * fixed amount; no `down` is 10% of the price.
   */
  downRule?: DownRule;
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
  let priceSource: "local" | "typical" | "given" = args.priceSource ?? "given";
  let typicalPrice: number | null = resolved?.pick.typicalNewPrice ?? null;
  let trimUsed: string | null = resolved?.pick.recommendedTrim ?? null;
  let fellBackToBase = false;
  if (zip && resolved) {
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
