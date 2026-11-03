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

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function dollars(n: number): string {
  return usd0.format(Math.round(n));
}

function costAt(ownership: SummaryOwnership, month: number): number | undefined {
  const p = ownership.walkAway.find((w) => w.month === month);
  if (!p) return undefined;
  return p.costPerMonth ?? p.perMonth;
}

function getBackAt(ownership: SummaryOwnership, month: number): number | undefined {
  const p = ownership.walkAway.find((w) => w.month === month);
  if (!p) return undefined;
  if (p.getBack !== undefined) return p.getBack;
  return undefined;
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

function categoryNoun(category: string): string {
  if (category === "SUV") return "SUV";
  if (category === "Sedan") return "sedan";
  if (category === "Pickup") return "pickup";
  return category.toLowerCase();
}

/**
 * One plain sentence per card, from tool results. Example shape:
 * "Keeps 63% of its price after 5 years, the most of any gas SUV
 * here. Underwater for 7 months; sell after a year and having it
 * cost about $732 a month." With task-029 trim/lifespan data the
 * sentence names the step-up trim and the lifespan, for example:
 * "The SE is one step up from base and keeps 74% of its price
 * after 5 years. Built to last about 17 years."
 */
export function cardSentence(
  pick: SummaryPick,
  ownership: SummaryOwnership | undefined,
  peers: SummaryPick[],
  category: string,
): string {
  const pct = Math.round(pick.retention5y * 100);
  const maxRetention = Math.max(...peers.map((p) => p.retention5y));
  const isTopRetention =
    peers.length > 1 && pick.retention5y === maxRetention &&
    peers.filter((p) => p.retention5y === maxRetention).length === 1;
  const keeps = isTopRetention
    ? `keeps ${pct}% of its price after 5 years, the most of any gas ${categoryNoun(category)} here.`
    : `keeps ${pct}% of its price after 5 years.`;
  let first: string;
  if (pick.recommendedTrim && pick.trimIsStepUp) {
    first = `The ${pick.recommendedTrim} is one step up from base and ${keeps}`;
  } else if (pick.recommendedTrim) {
    first = `The ${pick.recommendedTrim} ${keeps}`;
  } else {
    first = `K${keeps.slice(1)}`;
  }
  const lifespan =
    pick.lifespanYears !== null && pick.lifespanYears !== undefined
      ? ` Built to last about ${Math.round(pick.lifespanYears)} years.`
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
  const ranked = entries.filter((e) => e.pick.rank !== null);
  const pool = ranked.length > 0 ? ranked : entries;
  if (pool.length === 0) return null;
  const top = [...pool].sort(
    (a, b) => (a.pick.rank ?? 99) - (b.pick.rank ?? 99),
  )[0];
  if (!top.ownership) {
    return `Start with the ${top.pick.make} ${top.pick.model}.`;
  }
  const pct = Math.round(top.pick.retention5y * 100);
  const cost12 = costAt(top.ownership, 12);
  const back36 = getBackAt(top.ownership, 36);
  const pay = dollars(top.ownership.monthlyPayment);
  void category;
  void back36;
  if (cost12 === undefined) {
    return `Start with the ${top.pick.make} ${top.pick.model} at ${pay} a month; it keeps ${pct}% of its price after 5 years.`;
  }
  return `Start with the ${top.pick.make} ${top.pick.model} at ${pay} a month; it keeps ${pct}% of its price after 5 years, and leaving after a year costs about ${dollars(cost12)} a month.`;
}
