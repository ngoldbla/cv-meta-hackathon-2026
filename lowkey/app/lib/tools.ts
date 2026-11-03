import { tool } from "ai";
import { z } from "zod";

import { fuelForModel } from "./fuel";
import { aprLabel, getDefaultApr } from "./fred";
import { fetchUnitsWithTrimFallback } from "./listings";
import { ownershipMath } from "./ownership";
import { resolveTax, taxNoticeText } from "./tax";
import {
  getTable,
  lineupFromTable,
  resolveTablePick,
  type Category,
} from "./table";

/**
 * Live tools (task 027). rank_category reads the private Blob table
 * (one category per call), local_units searches the listings provider
 * over REST, and ownership_math prices the cheapest local unit (or
 * the table's typical price, labelled). Plain executors are exported
 * for the fast path in app/api/chat/route.ts.
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
  const resolved = table && model ? resolveTablePick(table, model) : undefined;
  const providerModel = resolved?.pick.providerModel ?? (model ?? "");
  const search = await fetchUnitsWithTrimFallback({
    zip,
    providerModel,
    recommendedTrim: resolved?.pick.recommendedTrim ?? null,
    baseTrim: resolved?.pick.baseTrim ?? null,
  });
  const result = search.result;
  const fuel =
    table && resolved
      ? fuelForModel({ mpg: resolved.pick.mpg, zip, table })
      : null;
  return {
    zip,
    model: resolved?.pick.model ?? (model ?? null),
    providerModel: providerModel || null,
    make: resolved?.pick.make ?? null,
    category: category ?? null,
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
  retention5y?: number;
  /** Set by the fast path when `price` is already the resolved price. */
  priceSource?: "local" | "typical" | "given";
}) {
  const { down, apr, term, model, zip } = args;
  let table = null;
  try {
    table = await getTable();
  } catch {
    table = null;
  }
  const resolved = table && model ? resolveTablePick(table, model) : undefined;
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
  return {
    ...result,
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

export const rankCategoryTool = tool({
  description:
    "Return the ranked picks (at most 4) and the commodity pick for a category from the live depreciation table. Call this whenever the user names a sedan, SUV or pickup type to consider.",
  inputSchema: z.object({
    category: z.enum(["Sedan", "SUV", "Pickup"]),
  }),
  execute: async ({ category }: { category: Category }) =>
    executeRankCategory(category),
});

export const ownershipMathTool = tool({
  description:
    "Return the monthly payment (sales tax for the ZIP's state financed into the loan), the 61-point equity curve (resale, balance, equity), walk-away costs at 6, 12, 24, 36 and 60 months, and positiveEquityMonth (the first month the car is worth more than the loan). Pass model (the exact model string from rank_category) and zip so the server prices the cheapest local unit, or the typical price when there is no local unit. Omit apr to use the Federal Reserve average; pass apr only when the user states their own rate. Deterministic; never estimate these numbers in text.",
  inputSchema: z.object({
    price: z.number().positive().optional(),
    down: z.number().nonnegative().optional(),
    apr: z.number().nonnegative().optional(),
    term: z.number().int().positive().optional(),
    model: z.string().optional(),
    zip: z.string().optional(),
  }),
  execute: async (args: {
    price?: number;
    down?: number;
    apr?: number;
    term?: number;
    model?: string;
    zip?: string;
  }) => executeOwnership(args),
});

export const localUnitsTool = tool({
  description:
    "Return up to 3 new in-stock local units near a ZIP code for a ranked model (cheapest first, radius 50 widening to 150), with the fuel estimate for that ZIP. Set model to the exact model string from rank_category (for example \"CR-V\", not \"Honda CR-V\").",
  inputSchema: z.object({
    zip: z.string(),
    model: z.string().optional(),
    category: z.string().optional(),
    radius: z.number().int().positive().optional(),
  }),
  execute: async (args: {
    zip: string;
    model?: string;
    category?: string;
    radius?: number;
  }) => executeLocalUnits(args),
});

export const lowkeyTools = {
  rank_category: rankCategoryTool,
  ownership_math: ownershipMathTool,
  local_units: localUnitsTool,
};
