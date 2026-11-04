/**
 * Task 059: the maths behind "Your deal" as a benchmark. Pure functions
 * shared by the Got the VIN? screen, the results row and the car page,
 * so a saved deal is priced one way everywhere.
 */

import type { QuotePick } from "@/components/QuoteCheck";
import { fmtUsd } from "@/components/render/format";
import { taxAmountFor } from "@/lib/tax";
import { usedRetention } from "@/lib/used";

import { analyzeQuote, type headsUp, type SameTerms } from "./compare";
import type { Quote } from "./schema";

/** A model's resale history from /api/vin (null when Low Key has none). */
export type VinRetention = { retention5y: number; byAge: Record<string, number> | null; slopePerYear: number | null };
export type CarInfo = { year: number | null; miles: number | null; retention: VinRetention | null };
export type Resale = Parameters<typeof analyzeQuote>[2];

/**
 * A model's resale history applies only to that model: a car from its
 * VIN is priced on its own curve by age and miles; otherwise the quote's
 * vehicle text picks one of the Low Key picks; otherwise a typical curve.
 */
export function resaleFor(q: Quote, info: CarInfo | null, picks: QuotePick[], nowYear: number): Resale {
  if (info) {
    const r = usedRetention({
      buildYear: info.year,
      odometer: q.mileage ?? info.miles,
      nowYear,
      retention: info.retention,
    });
    if (info.retention || r.basis !== "new") return r;
  }
  const v = (q.vehicle ?? "").toLowerCase();
  const p = v
    ? picks.find((pk) => v.includes((pk.deal.model ?? "\u0000").toLowerCase()) || v.includes(pk.label.toLowerCase()))
    : undefined;
  return p && p.retention5y !== null ? { retention5y: p.retention5y } : null;
}

/** The pick's state sales tax applied to this quote's price (used only when the quote lists none). */
export function estTaxFor(q: Quote, pick: QuotePick | null): number | null {
  const di = pick?.dealInputs;
  if (!pick || !di || di.taxStatus !== "included" || !di.taxRule || q.sellingPrice === null) return null;
  return taxAmountFor(
    di.taxRule,
    q.sellingPrice + q.fees.filter((f) => f.kind !== "government").reduce((t, f) => t + (f.amount ?? 0), 0),
    di.mpg,
  );
}

/** "2026 Honda Civic Sport" from the VIN lookup, else the typed year and vehicle. */
export function dealTitle(q: Quote): string {
  const fromCar = q.car ? [q.car.year, q.car.make, q.car.model, q.car.trim].filter(Boolean).join(" ") : "";
  if (fromCar) return fromCar;
  const typed = [q.year, q.vehicle].filter(Boolean).join(" ").trim();
  return typed || "Your deal";
}

/** What the "Your deal" row shows: the monthly as quoted, the total, and the equity month. */
export function dealRowOf(
  q: Quote,
  terms: SameTerms,
  resale: Resale,
): { monthly: number | null; outTheDoor: number | null; equityMonth: number | null; basis: "model" | "typical" | null } {
  const r = analyzeQuote(q, terms, resale);
  if (!r.ok) return { monthly: q.statedMonthly, outTheDoor: q.outTheDoor, equityMonth: null, basis: null };
  const a = r.analysis;
  return {
    monthly: q.statedMonthly ?? a.asQuoted?.monthly ?? null,
    outTheDoor: a.outTheDoor,
    equityMonth: a.asQuoted ? a.asQuoted.positiveEquityMonth : a.sameTerms.positiveEquityMonth,
    basis: a.retentionSource,
  };
}

/** The car page's one line: this car against the saved deal, both on the car's terms. */
export function vsDealLine(hu: ReturnType<typeof headsUp>): string | null {
  if (!hu.ok) return null;
  const monthly = hu.rows.find((r) => r.label === "Monthly payment");
  const equity = hu.rows.find((r) => r.label.startsWith("Positive equity"));
  const parts: string[] = [];
  // difference = deal − car, so a positive difference means the car is cheaper or sooner.
  if (monthly && monthly.difference !== null) {
    const d = Math.round(Math.abs(monthly.difference));
    parts.push(d === 0 ? "same monthly" : `${fmtUsd(d)}/mo ${monthly.difference > 0 ? "less" : "more"}`);
  }
  if (equity && equity.difference !== null) {
    const d = Math.round(Math.abs(equity.difference));
    parts.push(
      d === 0 ? "equity at the same time" : `equity ${d} ${d === 1 ? "month" : "months"} ${equity.difference > 0 ? "sooner" : "later"}`,
    );
  }
  return parts.length ? `vs your deal, on the same terms: ${parts.join(" · ")}` : null;
}
