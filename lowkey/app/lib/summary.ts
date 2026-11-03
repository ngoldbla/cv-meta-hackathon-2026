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
 * cost about $732 a month."
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
  const first = isTopRetention
    ? `Keeps ${pct}% of its price after 5 years, the most of any gas ${categoryNoun(category)} here.`
    : `Keeps ${pct}% of its price after 5 years.`;
  if (!ownership) return first;
  const even = evenOf(ownership);
  const under =
    even === null
      ? "Still underwater at 5 years"
      : even <= 0
        ? "Never underwater"
        : even === 1
          ? "Underwater for 1 month"
          : `Underwater for ${even} months`;
  const cost12 = costAt(ownership, 12);
  if (cost12 === undefined) return `${first} ${under}.`;
  return `${first} ${under}; sell after a year and having it cost about ${dollars(cost12)} a month.`;
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
