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
  positiveEquityMonth?: number | null;
  evenMonth?: number | null;
  underwaterMonth?: number | null;
  walkAway: {
    month: number;
    getBack?: number;
    equity?: number;
    costPerMonth?: number;
    walkAwayCost?: number;
    perMonth?: number;
  }[];
}

/** Positive-equity month from any tool-output shape (new field first). */
export function positiveEquityOf(ownership: SummaryOwnership): number | null {
  if (ownership.positiveEquityMonth !== undefined) {
    return ownership.positiveEquityMonth;
  }
  if (ownership.evenMonth !== undefined) return ownership.evenMonth;
  return ownership.underwaterMonth ?? null;
}

/** Legacy alias of positiveEquityOf; kept until every caller moves. */
export function evenOf(ownership: SummaryOwnership): number | null {
  return positiveEquityOf(ownership);
}

const usdExact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** Whole dollars with commas, e.g. "$20,113". */
export function formatUsdExact(n: number): string {
  return usdExact.format(Math.round(n));
}

/** "About" dollars for the sell-at sentence: nearest $100. */
export function aboutUsd(n: number): number {
  return Math.round(Math.abs(n) / 100) * 100;
}

/** Small-chart label, e.g. "Positive equity by month 7". */
export function positiveEquityLabel(
  month: number | null | undefined,
): string {
  if (month === null || month === undefined) {
    return "Equity stays below zero for the loan";
  }
  if (month <= 0) return "Positive equity from day one";
  return `Positive equity by month ${month}`;
}

/** Legacy alias; returns the positive-equity phrasing. */
export function underwaterLabel(
  month: number | null | undefined,
): string {
  return positiveEquityLabel(month);
}

/** Walk-away headline, e.g. "Positive equity by month 7." */
export function equityHeadline(month: number | null | undefined): string {
  return `${positiveEquityLabel(month)}.`;
}

/** Second line on the card, e.g. "$20,113 yours at 5 years". */
export function yoursAt5YearsLabel(equityAt60: number): string {
  if (equityAt60 >= 0) return `${formatUsdExact(equityAt60)} yours at 5 years`;
  return `You'd owe ${formatUsdExact(-equityAt60)} at 5 years`;
}

/** Sell-at sentence at the slider month (whole template, for tests). */
export function sellLine(month: number, equity: number): string {
  const about = formatUsdExact(aboutUsd(equity));
  if (equity >= 0) return `Sell at month ${month}: about ${about} is yours`;
  return `Sell at month ${month}: you'd owe about ${about}`;
}

/**
 * One plain sentence per card, from tool results (task 038 short
 * form). Example: "LX: keeps about 63% of its price after 5 years
 * — most here. Lasts about 14 years." Every number traces to a
 * tool result; retention5y is already the after-discount figure
 * (task 031). The positive-equity month and walk-away costs live
 * on the card's chart row and in the walk-away view.
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
  // positive-equity month and walk-away costs live on the card's
  // chart row and in the walk-away view. `ownership` stays in the
  // signature for caller compatibility.
  void ownership;
  return `${first}${lifespan}`;
}
