/**
 * The chooser (task 040). Every car shown is one Low Key stands
 * behind, so there is no rank: the shopper picks the order, and each
 * car carries "best-at" labels computed here from tool results.
 * Pure functions; the spec builders and the chooser view share them.
 */

export type SortKey = "real" | "monthly" | "nearest" | "lasts";

export const SORT_KEYS: readonly SortKey[] = ["real", "monthly", "nearest", "lasts"];

export const SORT_LABEL: Record<SortKey, string> = {
  real: "Real cost",
  monthly: "Monthly",
  nearest: "Nearest",
  lasts: "Lasts longest",
};

export const DEFAULT_SORT: SortKey = "real";

export type BestAt =
  | "Holds value best"
  | "Cheapest to own"
  | "Lowest monthly"
  | "Nearest"
  | "Lasts longest";

/** The figures the chooser sorts and labels by, one per car. */
export interface ChooserFacts {
  /** Stable key (the provider model string). */
  model: string;
  /** "Make Model", the tie-break of last resort. */
  label: string;
  /** After-discount 5-year retention. */
  retention: number;
  /** Real cost a month, whole dollars. */
  total: number;
  /** Loan + gas a month, whole dollars. */
  bills: number;
  /** Closest local unit in miles, or null with none nearby. */
  nearestMiles: number | null;
  /** Rated lifespan in years, or null when not yet rated. */
  lifespanYears: number | null;
}

/**
 * Sorting and labels compare what the shopper reads: whole miles and
 * whole years (the rows print "14 mi away", "lasts about 14 yrs"), so
 * two cars that read the same share a label and fall back to real
 * cost for their order.
 */
export function shownMiles(f: { nearestMiles: number | null }): number | null {
  return f.nearestMiles === null ? null : Math.round(f.nearestMiles);
}

export function shownYears(f: { lifespanYears: number | null }): number | null {
  return f.lifespanYears === null ? null : Math.round(f.lifespanYears);
}

/** What sorting needs (retention only feeds the labels). */
export type SortableFacts = Omit<ChooserFacts, "retention">;

export function isSortKey(value: unknown): value is SortKey {
  return typeof value === "string" && (SORT_KEYS as readonly string[]).includes(value);
}

/** Nulls last, then ascending or descending, then real cost, then name. */
function compareBy(
  a: SortableFacts,
  b: SortableFacts,
  pick: (f: SortableFacts) => number | null,
  descending: boolean,
): number {
  const av = pick(a);
  const bv = pick(b);
  if (av === null && bv !== null) return 1;
  if (bv === null && av !== null) return -1;
  if (av !== null && bv !== null && av !== bv) {
    return descending ? bv - av : av - bv;
  }
  if (a.total !== b.total) return a.total - b.total;
  return a.label.localeCompare(b.label);
}

/** A new array in the chosen order; the input is not changed. */
export function sortFacts<T extends SortableFacts>(rows: readonly T[], key: SortKey): T[] {
  const copy = [...rows];
  switch (key) {
    case "real":
      return copy.sort((a, b) => compareBy(a, b, (f) => f.total, false));
    case "monthly":
      return copy.sort((a, b) => compareBy(a, b, (f) => f.bills, false));
    case "nearest":
      return copy.sort((a, b) => compareBy(a, b, shownMiles, false));
    case "lasts":
      return copy.sort((a, b) => compareBy(a, b, shownYears, true));
  }
}

/**
 * Model -> best-at labels. A label goes to every car at the best
 * value (ties share it), and is left off entirely when every car ties
 * or no car has the figure, since then it tells the shopper nothing.
 * Needs at least two cars.
 */
export function bestAtLabels(rows: readonly ChooserFacts[]): Map<string, BestAt[]> {
  const out = new Map<string, BestAt[]>(rows.map((r) => [r.model, []]));
  if (rows.length < 2) return out;
  const award = (
    label: BestAt,
    pick: (f: ChooserFacts) => number | null,
    best: "max" | "min",
  ) => {
    const known = rows.filter((r) => pick(r) !== null);
    if (known.length === 0) return;
    const values = known.map((r) => pick(r)!);
    const target = best === "max" ? Math.max(...values) : Math.min(...values);
    const winners = known.filter((r) => pick(r) === target);
    if (winners.length === rows.length) return;
    for (const w of winners) out.get(w.model)!.push(label);
  };
  award("Holds value best", (f) => f.retention, "max");
  award("Cheapest to own", (f) => f.total, "min");
  award("Lowest monthly", (f) => f.bills, "min");
  award("Nearest", shownMiles, "min");
  award("Lasts longest", shownYears, "max");
  return out;
}
