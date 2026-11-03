/**
 * Code-written summary sentences (task 026, part 4).
 *
 * The model no longer writes the "why this car" sentence or any
 * closing summary. Every sentence here is built by template from
 * tool results only, so every number in it is a tool number.
 */

export interface SummaryPick {
  rank: number | null;
  make: string;
  model: string;
  price: number;
  retention5y: number;
  depPerMonth: number;
  flag?: "badge" | "extra";
  /** Task 029: step-up trim and lifespan, when known. */
  baseTrim?: string | null;
  stepUpTrim?: string | null;
  recommendedTrim?: string | null;
  trimIsStepUp?: boolean;
  trimGuardHit?: boolean;
  lifespanYears?: number | null;
}

export interface SummaryOwnership {
  monthlyPayment: number;
  evenMonth?: number | null;
  underwaterMonth?: number | null;
  walkAway: {
    month: number;
    getBack?: number;
    costPerMonth?: number;
    walkAwayCost?: number;
    perMonth?: number;
  }[];
}

export function evenOf(ownership: SummaryOwnership): number | null {
  if (ownership.evenMonth !== undefined) return ownership.evenMonth;
  return ownership.underwaterMonth ?? null;
}

/** Small-chart label, e.g. "Underwater for 7 months". */
export function underwaterLabel(evenMonth: number | null | undefined): string {
  if (evenMonth === null || evenMonth === undefined) {
    return "Underwater for the whole term";
  }
  if (evenMonth <= 0) return "Never underwater";
  if (evenMonth === 1) return "Underwater for 1 month";
  return `Underwater for ${evenMonth} months`;
}

/**
 * One plain sentence per card, from tool results (task 038 short
 * form). Example: "LX: keeps about 63% of its price after 5 years
 * — most here. Lasts about 14 years." Every number traces to a
 * tool result; retention5y is already the after-discount figure
 * (task 031). Underwater months and walk-away costs live on the
 * card's chart row and in the walk-away view.
 */
export function cardSentence(
  pick: SummaryPick,
  ownership: SummaryOwnership | undefined,
  peers: SummaryPick[],
  category: string,
): string {
  void category;
  const pct = Math.round(pick.retention5y * 100);
  const maxRetention = Math.max(...peers.map((p) => p.retention5y));
  const isTopRetention =
    peers.length > 1 && pick.retention5y === maxRetention &&
    peers.filter((p) => p.retention5y === maxRetention).length === 1;
  // Task 038 (distill): same numbers, fewer words. The definition of
  // the percentage lives in the Sources & assumptions popover.
  const keeps = `keeps about ${pct}% of its price after 5 years${isTopRetention ? " — most here." : "."}`;
  let first: string;
  if (pick.recommendedTrim && pick.trimIsStepUp) {
    first = `${pick.recommendedTrim} (one step up): ${keeps}`;
  } else if (pick.recommendedTrim) {
    first = `${pick.recommendedTrim}: ${keeps}`;
  } else {
    first = `K${keeps.slice(1)}`;
  }
  const lifespan =
    pick.lifespanYears !== null && pick.lifespanYears !== undefined
      ? ` Lasts about ${Math.round(pick.lifespanYears)} years.`
      : "";
  // Task 029, part 3: the card face carries only the salient
  // numbers, so the sentence stops at trim/retention/lifespan; the
  // underwater months and walk-away costs live on the card's chart
  // row and in the walk-away view. `ownership` stays in the
  // signature for caller compatibility.
  void ownership;
  return `${first}${lifespan}`;
}

/** One closing line for the whole lineup, from tool results. */
export function closingLine(
  entries: { pick: SummaryPick; ownership?: SummaryOwnership }[],
  category: string,
): string | null {
  void category;
  const ranked = entries.filter((e) => e.pick.rank !== null);
  const pool = ranked.length > 0 ? ranked : entries;
  if (pool.length === 0) return null;
  const top = [...pool].sort(
    (a, b) => (a.pick.rank ?? 99) - (b.pick.rank ?? 99),
  )[0];
  // Task 038 (distill): name the pick only; its payment, retention
  // and leave cost already sit on its card and in the comparison.
  void top.ownership;
  return `Start with the ${top.pick.make} ${top.pick.model}.`;
}
