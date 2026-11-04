/**
 * Check a quote (task 046): deterministic maths over a confirmed
 * Quote, built on the same ownership maths the cards use. No model
 * and no network: every figure here comes from the shopper's own
 * document (as typed or confirmed) and Low Key's code.
 *
 * - The out-the-door price is the one the quote states, or the sum of
 *   its lines (price − rebates + every fee), and we say which.
 * - The monthly payment is recomputed from the quote's own numbers;
 *   if the stated payment is more than $5 away, we say so calmly.
 * - Add-ons are totalled on their own line.
 * - "Same terms" re-prices every quote (and a Low Key pick) with one
 *   down-payment rule, APR and term, so quotes compare like for like.
 *   We never name a winner; we show the difference in dollars.
 */

import { downFor, type DownRule } from "../deal";
import { DEFAULT_RETENTION_5Y, monthlyPayment, ownershipMath } from "../ownership";
import type { FeeKind, Quote } from "./schema";

export const PAYMENT_TOLERANCE = 5;
export const TOTAL_TOLERANCE = 1;

export interface SameTerms {
  downRule: DownRule;
  aprPercent: number;
  termMonths: number;
}

export interface Priced {
  down: number;
  aprPercent: number;
  termMonths: number;
  amountFinanced: number;
  monthly: number;
  interestPaid: number;
  positiveEquityMonth: number | null;
}

/** The APR (percent) at which `principal` over `termMonths` costs `payment` a month. */
export function impliedApr(principal: number, payment: number, termMonths: number): number | null {
  if (!(principal > 0) || !(payment > 0) || !(termMonths > 0)) return null;
  if (payment * termMonths < principal) return null; // below zero interest: not a loan on these numbers
  let lo = 0;
  let hi = 60;
  if (monthlyPayment(principal, hi, termMonths) < payment) return null;
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (monthlyPayment(principal, mid, termMonths) < payment) lo = mid;
    else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 100) / 100;
}

export interface PaymentEstimate {
  down: number;
  termMonths: number;
  low: number;
  high: number;
  financed: number;
  aprLow: number | null;
  aprHigh: number | null;
}

export interface QuoteAnalysis {
  /** Vehicle price before fees (the resale basis). */
  price: number;
  feesByKind: Record<FeeKind, number>;
  feesTotal: number;
  addonTotal: number;
  outTheDoor: number;
  outTheDoorSource: "stated" | "sum";
  /** stated total − sum of lines, when both exist and differ. */
  totalGap: number | null;
  /** The quote's own loan, when it states an APR and a term. */
  asQuoted: Priced | null;
  /** stated payment − recomputed payment, when it is off by more than $5. */
  paymentGap: number | null;
  /** stated amount financed − the lines' amount financed, when they differ. */
  financedGap: number | null;
  /** The sheet's payment estimates (for this down payment) and the APR each implies. */
  estimates: PaymentEstimate[];
  sameTerms: Priced;
  retentionSource: "model" | "typical";
  /** Short, calm questions to take back to the dealer. */
  questions: string[];
}

export type AnalysisResult =
  | { ok: true; analysis: QuoteAnalysis }
  | { ok: false; missing: string[] };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Price one deal: the loan, its interest and the positive-equity month. */
export function priceDeal(args: {
  price: number;
  outTheDoor: number;
  down: number;
  aprPercent: number;
  termMonths: number;
  retention5y: number;
}): Priced {
  const { price, outTheDoor, aprPercent, termMonths, retention5y } = args;
  // Costs above the car's price (fees, tax) are financed and never come
  // back; a rebate larger than the fees works like extra cash down.
  const extra = Math.max(0, outTheDoor - price);
  const rebateExcess = Math.max(0, price - outTheDoor);
  const down = Math.max(0, args.down);
  const own = ownershipMath({
    price,
    tax: extra,
    down: down + rebateExcess,
    apr: aprPercent,
    term: termMonths,
    retention5y,
  });
  const amountFinanced = Math.max(0, outTheDoor - down);
  const monthly = monthlyPayment(amountFinanced, aprPercent, termMonths);
  return {
    down: round2(down),
    aprPercent,
    termMonths,
    amountFinanced: round2(amountFinanced),
    monthly: round2(monthly),
    interestPaid: round2(Math.max(0, monthly * termMonths - amountFinanced)),
    positiveEquityMonth: own.positiveEquityMonth,
  };
}

export function analyzeQuote(
  q: Quote,
  terms: SameTerms,
  retention?: { retention5y: number } | null,
): AnalysisResult {
  const missing: string[] = [];
  if (q.unconfirmed.length) missing.push("confirm the fields read from your photo");
  if (q.sellingPrice === null && q.outTheDoor === null) missing.push("the vehicle price or the out-the-door total");
  if (missing.length) return { ok: false, missing };

  const feesByKind: Record<FeeKind, number> = { government: 0, dealer: 0, addon: 0, unknown: 0 };
  for (const f of q.fees) feesByKind[f.kind] += f.amount ?? 0;
  const feesTotal = feesByKind.government + feesByKind.dealer + feesByKind.addon + feesByKind.unknown;
  const rebates = q.rebates ?? 0;

  const sum = q.sellingPrice !== null ? q.sellingPrice - rebates + feesTotal : null;
  const outTheDoor = q.outTheDoor ?? (sum as number);
  const outTheDoorSource = q.outTheDoor !== null ? "stated" : "sum";
  const totalGap =
    q.outTheDoor !== null && sum !== null && Math.abs(q.outTheDoor - sum) > TOTAL_TOLERANCE
      ? round2(q.outTheDoor - sum)
      : null;
  const price = q.sellingPrice ?? Math.max(1, outTheDoor - feesTotal + rebates);

  const retention5y = retention?.retention5y ?? DEFAULT_RETENTION_5Y;
  const retentionSource = retention ? "model" : "typical";
  const cashIn = (q.down ?? 0) + (q.tradeIn ?? 0);

  let asQuoted: Priced | null = null;
  let paymentGap: number | null = null;
  if (q.apr !== null && q.termMonths !== null) {
    asQuoted = priceDeal({
      price,
      outTheDoor,
      down: cashIn,
      aprPercent: q.apr,
      termMonths: q.termMonths,
      retention5y,
    });
    if (q.statedMonthly !== null && Math.abs(q.statedMonthly - asQuoted.monthly) > PAYMENT_TOLERANCE) {
      paymentGap = round2(q.statedMonthly - asQuoted.monthly);
    }
  }

  // Same terms: the cards' down-payment rule applies to the price with
  // dealer fees and add-ons (taxes and government fees excluded), as on
  // the cards.
  const priceWithFees = price + feesByKind.dealer + feesByKind.addon + feesByKind.unknown - rebates;
  const sameTerms = priceDeal({
    price,
    outTheDoor,
    down: downFor(terms.downRule, Math.max(0, priceWithFees)),
    aprPercent: terms.aprPercent,
    termMonths: terms.termMonths,
    retention5y,
  });

  const financedFromLines = Math.max(0, outTheDoor - cashIn);
  const financedGap =
    q.amountFinanced !== null && Math.abs(q.amountFinanced - financedFromLines) > TOTAL_TOLERANCE
      ? round2(q.amountFinanced - financedFromLines)
      : null;

  // A payment grid: the APR each estimate implies, from the sheet's own lines.
  const rows = q.paymentOptions.filter((o) => q.down === null || o.down === null || o.down === q.down);
  const estimates: PaymentEstimate[] = rows.map((o) => {
    const financed = Math.max(0, outTheDoor - (o.down ?? q.down ?? 0) - (q.tradeIn ?? 0));
    return {
      down: o.down ?? q.down ?? 0,
      termMonths: o.termMonths,
      low: o.low,
      high: o.high,
      financed: round2(financed),
      aprLow: impliedApr(financed, o.low, o.termMonths),
      aprHigh: impliedApr(financed, o.high, o.termMonths),
    };
  });

  const questions: string[] = [];
  if (feesByKind.addon > 0) questions.push("Can the add-ons come off?");
  for (const f of q.fees) if (f.kind === "unknown") questions.push(`What is “${f.label}” for, and is it optional?`);
  if (paymentGap !== null) questions.push("The payment doesn't match the other numbers. How was it worked out?");
  if (totalGap !== null) questions.push("The total doesn't match the lines. What is the difference for?");
  if (estimates.length && q.apr === null) questions.push("What APR are these payment estimates based on? Ask for it in writing.");
  if (financedGap !== null) questions.push("The amount financed doesn't match the lines. What is the difference for?");
  if (q.priceIsSticker) questions.push("What is your selling price for this car, out the door?");
  else if (q.outTheDoor === null) questions.push("Is this the out-the-door price with every fee and tax?");

  return {
    ok: true,
    analysis: {
      price: round2(price),
      feesByKind: {
        government: round2(feesByKind.government),
        dealer: round2(feesByKind.dealer),
        addon: round2(feesByKind.addon),
        unknown: round2(feesByKind.unknown),
      },
      feesTotal: round2(feesTotal),
      addonTotal: round2(feesByKind.addon),
      outTheDoor: round2(outTheDoor),
      outTheDoorSource,
      totalGap,
      asQuoted,
      paymentGap,
      financedGap,
      estimates,
      sameTerms,
      retentionSource,
      questions,
    },
  };
}

/** A Low Key pick as the cards priced it (the ownership_math output). */
export interface PickDeal {
  model: string;
  /** Price with fees, before tax. */
  price: number;
  taxAmount: number;
  downPayment: number;
  aprPercent: number;
  termMonths: number;
  monthlyPayment: number;
  positiveEquityMonth: number | null;
}

export interface HeadsUpRow {
  label: string;
  quote: number | null;
  pick: number | null;
  /** quote − pick, or null when either side is missing. */
  difference: number | null;
}

/**
 * The shopper's quote next to one Low Key pick, both on the pick's own
 * terms (the same down payment rule, APR and term). The pick's figures
 * are the ones its card already shows; nothing is recomputed for it.
 */
export function quoteListsSalesTax(q: Quote): boolean {
  return q.fees.some((f) => /\btax\b/i.test(f.label));
}

export function headsUp(
  q: Quote,
  pick: PickDeal,
  downRule: DownRule,
  retention?: { retention5y: number } | null,
  /** The pick's state sales tax applied to this quote's price, used only when the quote lists none. */
  estTaxForQuote?: number | null,
): { ok: true; rows: HeadsUpRow[]; addedTax: number | null } | { ok: false; missing: string[] } {
  const addedTax =
    estTaxForQuote && estTaxForQuote > 0 && !quoteListsSalesTax(q) ? round2(estTaxForQuote) : null;
  const priced: Quote =
    addedTax === null
      ? q
      : {
          ...q,
          outTheDoor: q.outTheDoor === null ? null : q.outTheDoor + addedTax,
          fees: [...q.fees, { label: "Sales tax (est.)", amount: addedTax, kind: "government" }],
        };
  const result = analyzeQuote(
    priced,
    { downRule, aprPercent: pick.aprPercent, termMonths: pick.termMonths },
    retention,
  );
  if (!result.ok) return result;
  const a = result.analysis;
  const pickOtd = round2(pick.price + pick.taxAmount);
  const diff = (x: number | null, y: number | null) => (x === null || y === null ? null : round2(x - y));
  return {
    ok: true,
    addedTax,
    rows: [
      { label: "Monthly payment", quote: a.sameTerms.monthly, pick: round2(pick.monthlyPayment), difference: diff(a.sameTerms.monthly, round2(pick.monthlyPayment)) },
      { label: "Out the door (est.)", quote: a.outTheDoor, pick: pickOtd, difference: diff(a.outTheDoor, pickOtd) },
      { label: "Positive equity by month", quote: a.sameTerms.positiveEquityMonth, pick: pick.positiveEquityMonth, difference: diff(a.sameTerms.positiveEquityMonth, pick.positiveEquityMonth) },
    ],
  };
}
