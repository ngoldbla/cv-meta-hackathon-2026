/**
 * Vehicle sales tax (task 037, P19). The researched per-state rule
 * table rides in the private Blob table (`tax` section, built by
 * lowkey/pipeline/tax_table.py from an outside-git cache with a
 * state revenue/DMV source and date per state, checked against the
 * Tax Foundation state-and-average-local table). This module is the
 * pure arithmetic: ZIP -> state reuses the table's ZIP3 ranges (the
 * task-027 rules), tax is charged on the price with fees (which is
 * before tax and registration; see report 037, part 1), and an
 * unmapped ZIP or a table without tax rules means unknown — never
 * a guessed rate.
 */

export type TaxKind =
  | "sales"
  | "tavt"
  | "hut"
  | "excise"
  | "imf"
  | "dc"
  | "none";

export interface TaxRule {
  state: string;
  name: string;
  kind: TaxKind;
  label: string;
  stateRate: number;
  avgLocalRate: number;
  cap: number | null;
  localBaseCap: number | null;
  flatAdd: number;
  vehicleAddRate: number;
  mpgBands?: { maxMpg: number | null; rate: number }[] | null;
  base: string;
  note: string;
  sourceUrl: string;
  sourceDate: string;
}

export interface TaxSection {
  version: number | null;
  asOf: string | null;
  taxFoundation: { title?: string; url?: string; accessed?: string } | null;
  states: Record<string, TaxRule>;
}

export type TaxResolution =
  | {
      status: "included";
      state: string;
      rule: TaxRule;
      tax: number;
      /** tax / price with fees (differs from the statutory rate when capped). */
      effectiveRate: number;
    }
  | { status: "none"; state: string; rule: TaxRule; tax: 0; effectiveRate: 0 }
  | { status: "unknown"; state: null; rule: null; tax: null; effectiveRate: null };

/** ZIP3 prefix -> state from the table's ranges (task-027 rules). */
export function stateForZip(
  zip: string,
  zip3Ranges: [number, number, string][] | undefined,
): string | null {
  if (!/^\d{5}$/.test(zip) || !zip3Ranges) return null;
  const prefix = Number(zip.slice(0, 3));
  for (const [lo, hi, state] of zip3Ranges) {
    if (prefix >= lo && prefix <= hi) return state;
  }
  return null;
}

/** Tax in dollars for one rule (mirror of pipeline tax_amount). */
export function taxAmountFor(
  rule: TaxRule,
  priceWithFees: number,
  mpg?: number | null,
): number {
  if (!(priceWithFees > 0) || rule.kind === "none") return 0;
  if (rule.kind === "dc") {
    const bands = rule.mpgBands ?? [];
    const band =
      bands.find((b) => b.maxMpg === null || (mpg ?? 0) <= b.maxMpg) ??
      bands[bands.length - 1];
    return band ? priceWithFees * band.rate : 0;
  }
  const localBase = Math.min(priceWithFees, rule.localBaseCap ?? priceWithFees);
  const amount =
    priceWithFees * rule.stateRate +
    localBase * rule.avgLocalRate +
    priceWithFees * rule.vehicleAddRate +
    rule.flatAdd;
  return rule.cap !== null && rule.cap !== undefined
    ? Math.min(amount, rule.cap)
    : amount;
}

export function resolveTax(args: {
  zip?: string | null;
  priceWithFees: number;
  mpg?: number | null;
  zip3Ranges?: [number, number, string][];
  tax?: TaxSection | null;
}): TaxResolution {
  const state = args.zip ? stateForZip(args.zip, args.zip3Ranges) : null;
  const rule = state ? (args.tax?.states?.[state] ?? null) : null;
  if (!state || !rule) {
    return { status: "unknown", state: null, rule: null, tax: null, effectiveRate: null };
  }
  if (rule.kind === "none") {
    return { status: "none", state, rule, tax: 0, effectiveRate: 0 };
  }
  const tax = taxAmountFor(rule, args.priceWithFees, args.mpg);
  return {
    status: "included",
    state,
    rule,
    tax,
    effectiveRate: args.priceWithFees > 0 ? tax / args.priceWithFees : 0,
  };
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** Card/footer tax line. Rates are always labelled estimates. */
export function taxNoticeText(res: TaxResolution): string {
  if (res.status === "unknown") return "Tax not included: unknown state";
  if (res.status === "none") {
    return `No state sales tax on cars in ${res.rule.name}.`;
  }
  const { rule } = res;
  if (rule.cap !== null && rule.cap !== undefined) {
    return `Includes ${rule.label} at ${pct(rule.stateRate)} capped at ${usd0.format(rule.cap)} (est.).`;
  }
  if (rule.avgLocalRate > 0) {
    return `Includes about ${pct(res.effectiveRate)} ${rule.label} (state + average local, est.).`;
  }
  return `Includes about ${pct(res.effectiveRate)} ${rule.label} (est.).`;
}
