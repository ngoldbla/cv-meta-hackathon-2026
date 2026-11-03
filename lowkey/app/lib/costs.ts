/**
 * Salient card costs (task 029, parts 2-3). Pure arithmetic on tool
 * results only; every number here traces to rank_category,
 * local_units or ownership_math.
 */
import { monthlyPayment, TRADE_IN_FACTOR } from "./ownership";

export interface MonthlyBills {
  total: number;
  loan: number;
  /** Median (p50) fuel per month, or null when there is no estimate. */
  gas: number | null;
}

/** Monthly bills: loan payment + gas (the fuel range's median). */
export function monthlyBills(
  loanPayment: number,
  gasPerMonth: number | null | undefined,
): MonthlyBills {
  const gas = gasPerMonth === null || gasPerMonth === undefined ? null : gasPerMonth;
  return { total: loanPayment + (gas ?? 0), loan: loanPayment, gas };
}

/**
 * Effective monthly cost to drive over the 5-year hold:
 * (depreciation over 5 years + interest paid + fuel over 5 years) / 60.
 * Depreciation is price x (1 - retention after discount); interest is
 * payments x 60 - loan amount. Fuel is the median monthly estimate.
 */
export function effectiveMonthlyCost(args: {
  price: number;
  retentionAfterDiscount: number;
  monthlyPayment: number;
  loanAmount: number;
  fuelPerMonth: number | null | undefined;
}): number {
  const depreciation = args.price * (1 - args.retentionAfterDiscount);
  const interest = args.monthlyPayment * 60 - args.loanAmount;
  const fuel = (args.fuelPerMonth ?? 0) * 60;
  return (depreciation + interest + fuel) / 60;
}

/** Expected life in years at 12,000 miles a year. */
export function lifespanYearsFromMiles(miles: number): number {
  return miles / 12000;
}

/** Expected life miles implied by a lifespan in years. */
export function lifespanMilesFromYears(years: number): number {
  return years * 12000;
}

/** Cost per year of life: price with fees / expected years of life. */
export function costPerYearOfLife(
  priceWithFees: number,
  lifespanYears: number,
): number {
  return priceWithFees / lifespanYears;
}

/** Unit title on the card, e.g. "2027 Civic Sport" (task 031). */
export function unitTitle(
  year: number | null | undefined,
  model: string,
  trim: string | null | undefined,
): string {
  const parts: Array<string | number> = [];
  if (year !== null && year !== undefined) parts.push(year);
  parts.push(model);
  if (trim) parts.push(trim);
  return parts.join(" ");
}

/**
 * Leftover-year note (task 031): a unit older than the table's
 * current model year counts as a year older at resale. Same or
 * later years, or a missing year, get no note.
 */
export function leftoverYearNote(
  year: number | null | undefined,
  currentModelYear: number | null | undefined,
): string | null {
  if (year === null || year === undefined) return null;
  if (currentModelYear === null || currentModelYear === undefined) return null;
  if (year >= currentModelYear) return null;
  return `${year} model year: at resale it counts as a year older.`;
}

/** Lifespan row text (task 031): unrated models say so, no number. */
export function lifespanRowText(lifespanYears: number | null | undefined): string {
  if (lifespanYears === null || lifespanYears === undefined) return "Not yet rated";
  return lastsAboutLabel(lifespanYears);
}

/** "Lasts about N years" (whole years, as on the card). */
export function lastsAboutLabel(lifespanYears: number): string {
  return `Lasts about ${Math.round(lifespanYears)} years`;
}

/**
 * What the step up adds a month: the payment on the financed part
 * of the step cost (price step less the 10% down share), at the
 * loan's APR over 60 months.
 */
export function trimStepMonthly(
  stepCost: number,
  aprPercent: number,
  termMonths = 60,
  downFraction = 0.1,
): number {
  return monthlyPayment(stepCost * (1 - downFraction), aprPercent, termMonths);
}

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/**
 * The one-line trim note on the card (task 029, part 1), from tool
 * results only. The no-stock fallback (the shopper's ZIP had no
 * step-up units within 150 miles) outranks the weekly guard note.
 */
export function trimLineText(args: {
  baseTrim?: string | null;
  stepUpTrim?: string | null;
  recommendedTrim?: string | null;
  trimIsStepUp?: boolean;
  trimGuardHit?: boolean;
  trimRetention5y?: number | null;
  modelRetentionRetail?: number | null;
  /** Trade-in discount factor from the table (retention basis). */
  tradeInFactor?: number;
  trimStepCost?: number | null;
  trimFeatures?: string[];
  aprPercent?: number | null;
  fellBackToBase?: boolean;
}): string | null {
  const base = args.baseTrim ?? null;
  const recommended = args.recommendedTrim ?? null;
  if (!base && !recommended) return null;
  if (args.fellBackToBase && base && recommended && recommended !== base) {
    return `${base} (base): no ${recommended} in stock within 150 miles, so the base trim is shown.`;
  }
  if (args.trimGuardHit && base) {
    const step = args.stepUpTrim ?? "the step-up trim";
    if (
      args.trimRetention5y !== null && args.trimRetention5y !== undefined &&
      args.modelRetentionRetail !== null && args.modelRetentionRetail !== undefined
    ) {
      // Display only (task 031): every percentage shown is the
      // after-discount figure (retail fit x the table's trade-in
      // factor), matching the dollar figures on the card. The guard
      // decision itself stays on the retail fits in trim.py; only
      // these displayed numbers change.
      const factor = args.tradeInFactor ?? TRADE_IN_FACTOR;
      const trimPct = Math.round(args.trimRetention5y * factor * 100);
      const modelPct = Math.round(args.modelRetentionRetail * factor * 100);
      return `${base} (base): the ${step} keeps ${trimPct}% of its price after 5 years, more than 3 points below the model's ${modelPct}%, so the base trim is recommended.`;
    }
    return `${base} (base): the step-up trim keeps its value clearly worse, so the base trim is recommended.`;
  }
  if (args.trimIsStepUp && recommended && base && args.trimStepCost) {
    const monthly =
      args.aprPercent !== null && args.aprPercent !== undefined
        ? `, about ${usd0.format(Math.round(trimStepMonthly(args.trimStepCost, args.aprPercent)))} a month`
        : "";
    const adds =
      args.trimFeatures && args.trimFeatures.length > 0
        ? ` Adds: ${args.trimFeatures.join(", ")}.`
        : "";
    return `${recommended}: +${usd0.format(Math.round(args.trimStepCost))} over ${base}${monthly}.${adds}`;
  }
  if (recommended) return `${recommended} (base).`;
  return null;
}
