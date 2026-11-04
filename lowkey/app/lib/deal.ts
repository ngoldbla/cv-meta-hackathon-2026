/**
 * One listing's deal (task 041). The card prices the cheapest local
 * unit; the listing sheet prices the unit the shopper tapped, with
 * the same assumptions ownership_math used (down-payment rule, APR,
 * term, 5-year retention, the state's tax rule). Pure: the listing
 * spec builder and the number guard both call it, so every figure in
 * the sheet and the deal-sheet text traces to tool results.
 */

import { ownershipMath } from "./ownership";
import { taxAmountFor, type TaxRule } from "./tax";

/** How the down payment was set: a share of the price, or dollars. */
export type DownRule =
  | { kind: "share"; share: number }
  | { kind: "amount"; usd: number };

/** The ownership_math assumptions a second unit is priced with. */
export interface DealInputs {
  downRule: DownRule;
  aprPercent: number;
  termMonths: number;
  /** After-discount 5-year retention, as ownership_math used it. */
  retention5y: number;
  taxStatus: "included" | "none" | "unknown";
  /** The state's rule when taxStatus is "included" or "none". */
  taxRule: TaxRule | null;
  /** Combined MPG (DC's tax depends on it). */
  mpg: number | null;
}

export interface UnitDeal {
  /** Price with fees, before tax (copied from the listing). */
  price: number;
  /** Estimated sales tax, or null when the state is unknown. */
  tax: number | null;
  /** price + tax, or null when the state is unknown. */
  outTheDoor: number | null;
  down: number;
  loan: number;
  /** loan + gas, unrounded. */
  bills: number;
  positiveEquityMonth: number | null;
}

export function downFor(rule: DownRule, price: number): number {
  return rule.kind === "amount" ? rule.usd : price * rule.share;
}

/** This unit's tax, payment and equity month at the turn's assumptions. */
export function unitDeal(
  inputs: DealInputs,
  price: number,
  gasPerMonth: number | null,
): UnitDeal {
  let tax: number | null = null;
  if (inputs.taxStatus === "none") tax = 0;
  else if (inputs.taxStatus === "included" && inputs.taxRule) {
    tax = taxAmountFor(inputs.taxRule, price, inputs.mpg);
  }
  const down = downFor(inputs.downRule, price);
  const own = ownershipMath({
    price,
    tax: tax ?? 0,
    down,
    apr: inputs.aprPercent,
    term: inputs.termMonths,
    retention5y: inputs.retention5y,
  });
  return {
    price,
    tax,
    outTheDoor: tax === null ? null : price + tax,
    down: own.downPayment,
    loan: own.monthlyPayment,
    bills: own.monthlyPayment + (gasPerMonth ?? 0),
    positiveEquityMonth: own.positiveEquityMonth,
  };
}

/** What the deal-sheet text is written from: the checked spec props. */
export interface DealSheetFacts {
  title: string;
  vin: string | null;
  dealer: string;
  price: number;
  tax: number | null;
  outTheDoor: number | null;
  down: number;
  downShare: number | null;
  aprPercent: number;
  termMonths: number;
  loan: number;
  gas: number | null;
  bills: number;
  positiveEquityMonth: number | null;
}

export const DEALER_QUESTIONS = [
  "Is this the out-the-door price with all fees?",
  "Are there add-ons or dealer packages already on this car?",
  "Can I get this rate pre-approved elsewhere?",
] as const;

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function money(n: number): string {
  return usd0.format(n);
}

function equityLine(month: number | null): string {
  if (month === null) return "The loan stays above the car's resale value for the whole loan.";
  if (month <= 0) return "Positive equity from day one.";
  return `Positive equity by month ${month}.`;
}

/**
 * The short summary a shopper takes to the dealer (task 041, part
 * 2). Every number comes from the guarded listing props; the dealer
 * appears by name only.
 */
export function dealSheetText(facts: DealSheetFacts, resultsUrl: string): string {
  const lines: string[] = [];
  lines.push(`${facts.title} at ${facts.dealer}`);
  if (facts.vin) lines.push(`VIN ${facts.vin}`);
  lines.push("");
  lines.push(`Price with fees: ${money(facts.price)}`);
  if (facts.outTheDoor !== null && facts.tax !== null && facts.tax > 0) {
    lines.push(
      `Estimated out the door: ${money(facts.outTheDoor)} (with about ${money(facts.tax)} sales tax, est.)`,
    );
  } else if (facts.outTheDoor !== null) {
    lines.push(`Estimated out the door: ${money(facts.outTheDoor)} (no state sales tax)`);
  } else {
    lines.push("Sales tax not included: unknown state");
  }
  const downText =
    facts.downShare !== null
      ? `${Math.round(facts.downShare * 100)}% down`
      : `${money(facts.down)} down`;
  const gasText = facts.gas !== null ? ` + ${money(facts.gas)} gas` : "";
  lines.push(
    `Monthly at ${downText}, ${facts.termMonths} months, ${facts.aprPercent}% APR: ${money(facts.loan)} loan${gasText} = ${money(facts.bills)}/mo`,
  );
  lines.push(equityLine(facts.positiveEquityMonth));
  lines.push("");
  lines.push("Questions to ask:");
  DEALER_QUESTIONS.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
  lines.push("");
  lines.push(`My Low Key results: ${resultsUrl}`);
  return lines.join("\n");
}
