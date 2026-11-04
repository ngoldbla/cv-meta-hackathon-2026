/**
 * One search, run in code (task 049). This is the chat fast path's logic
 * (tasks 026, 030, 034, 040) without the chat: rank the category, search
 * local stock one pick at a time, price each pick, then build the card
 * and chooser specs. Every spec passes the number guard here; a spec that
 * fails is dropped (logged without data), exactly as the fast path did.
 */

import { z } from "zod";

import { aprLabel, getDefaultApr } from "./fred";
import { checkCostCompareSpec, checkPickCardSpec } from "./render/guard";
import { buildCostCompareSpec, buildPickCardSpec, turnLabels, type SpecEntry } from "./render/specs";
import type { Category } from "./table";
import { executeLocalUnits, executeOwnership, executeRankCategory } from "./tools";
import type { Spec } from "@json-render/core";

export const TERMS = [36, 48, 60, 72] as const;
export type Term = (typeof TERMS)[number];

const CATEGORY_OF = {
  sedan: "Sedan",
  suv: "SUV",
  pickup: "Pickup",
  minivan: "Minivan",
  hybrid: "Hybrid",
} as const satisfies Record<string, Category>;

/** `GET /api/search` parameters. Down is a dollar amount or a percent, never both. */
export const searchParamsSchema = z
  .object({
    zip: z.string().regex(/^\d{5}$/),
    type: z.enum(["sedan", "suv", "pickup", "minivan", "hybrid"]),
    down: z.coerce.number().min(0).max(500_000).optional(),
    downPct: z.coerce.number().min(0).max(100).optional(),
    apr: z.coerce.number().min(0).max(30).optional(),
    term: z.coerce
      .number()
      .refine((t): t is Term => (TERMS as readonly number[]).includes(t))
      .optional(),
  })
  .refine((p) => p.down === undefined || p.downPct === undefined, {
    message: "give down or downPct, not both",
  });

export type SearchParams = z.infer<typeof searchParamsSchema>;

export interface SearchRequest {
  zip: string;
  category: Category;
  /** The shopper's own APR, or null for the Federal Reserve default. */
  userApr: number | null;
  /** Fixed-dollar down payment, or null. */
  downFixed: number | null;
  /** Percent down (0–100), or null for the 10% default. */
  downPercent: number | null;
  termMonths: Term;
}

export function requestFromParams(p: SearchParams): SearchRequest {
  return {
    zip: p.zip,
    category: CATEGORY_OF[p.type],
    userApr: p.apr ?? null,
    downFixed: p.down ?? null,
    downPercent: p.downPct ?? null,
    termMonths: (p.term ?? 60) as Term,
  };
}

/** Down-payment dollars for a pick price (10% by default). */
export function downForPrice(req: Pick<SearchRequest, "downFixed" | "downPercent">, price: number): number {
  if (req.downFixed !== null) return req.downFixed;
  if (req.downPercent !== null) return (price * req.downPercent) / 100;
  return price * 0.1;
}

type Rank = Awaited<ReturnType<typeof executeRankCategory>>;
type Local = Awaited<ReturnType<typeof executeLocalUnits>>;
type Ownership = Awaited<ReturnType<typeof executeOwnership>> & {
  aprDate?: string;
  aprAssumed?: unknown;
  aprLabel?: string;
};

export interface SearchResult {
  zip: string;
  category: Category;
  rank: Rank;
  /** The cards in lineup order: the picks, then the commodity pick when it is extra. */
  shown: Rank["picks"];
  locals: Local[];
  ownerships: Ownership[];
  /** Guard-checked card specs, keyed by pick model. */
  cards: { model: string; spec: Spec }[];
  /** Guard-checked chooser spec, or null with fewer than two comparable cars. */
  compare: Spec | null;
  aprLabel: string | null;
  aprPercent: number;
  downRule: { kind: "amount"; usd: number } | { kind: "share"; share: number };
  termMonths: Term;
}

export async function runSearch(req: SearchRequest): Promise<SearchResult> {
  const rank = await executeRankCategory(req.category);
  const shown = [...rank.picks];
  if (rank.commodity && !shown.some((p) => p.model === rank.commodity!.model)) {
    shown.push({ ...rank.commodity });
  }
  // One shared FRED lookup (1-day cached) unless the shopper gave a rate.
  const aprInfo = req.userApr === null ? await getDefaultApr() : null;
  const downRule =
    req.downFixed !== null
      ? ({ kind: "amount", usd: req.downFixed } as const)
      : ({ kind: "share", share: (req.downPercent ?? 10) / 100 } as const);
  // Local stock first, one search at a time (Tier 1 rate limit; at most
  // one provider call per pick at 50 miles): payments price the cheapest unit.
  const locals: Local[] = [];
  for (const pick of shown) {
    locals.push(await executeLocalUnits({ zip: req.zip, model: pick.model, category: req.category }));
  }
  const ownerships: Ownership[] = [];
  const entries: SpecEntry[] = [];
  for (let i = 0; i < shown.length; i += 1) {
    const pick = shown[i]!;
    const local = locals[i]!;
    const price = local.bestPrice ?? pick.typicalNewPrice;
    const out = await executeOwnership({
      price,
      down: downForPrice(req, price),
      term: req.termMonths,
      model: pick.model,
      zip: req.zip,
      category: req.category,
      downRule,
      retention5y: pick.retention5y,
      priceSource: local.bestPrice !== null && local.bestPrice !== undefined ? "local" : "typical",
      apr: req.userApr ?? (aprInfo ? aprInfo.aprPercent : undefined),
    });
    const own = (
      aprInfo
        ? { ...out, aprDate: aprInfo.dateIso, aprAssumed: aprInfo.assumed, aprLabel: aprLabel(aprInfo) }
        : out
    ) as Ownership;
    ownerships.push(own);
    entries.push({
      pick: pick as unknown as SpecEntry["pick"],
      ownership: own as unknown as SpecEntry["ownership"],
      local: local as unknown as SpecEntry["local"],
    });
  }
  // Built after every car is in: the best-at labels compare the whole lineup.
  const labels = turnLabels(entries);
  const cards: SearchResult["cards"] = [];
  for (const entry of entries) {
    const spec = buildPickCardSpec(
      entry,
      shown as unknown as SpecEntry["pick"][],
      req.category,
      labels.get(entry.pick.model) ?? [],
    );
    if (checkPickCardSpec(spec, entry).ok) cards.push({ model: entry.pick.model, spec });
    else console.error("lowkey: dropped a render spec that failed the number guard");
  }
  let compare = buildCostCompareSpec(entries, req.category);
  if (compare && !checkCostCompareSpec(compare, entries).ok) {
    console.error("lowkey: dropped a render spec that failed the number guard");
    compare = null;
  }
  return {
    zip: req.zip,
    category: req.category,
    rank,
    shown,
    locals,
    ownerships,
    cards,
    compare,
    aprLabel: aprInfo ? aprLabel(aprInfo) : null,
    aprPercent: req.userApr ?? aprInfo?.aprPercent ?? ownerships[0]?.aprPercent ?? 0,
    downRule,
    termMonths: req.termMonths,
  };
}
