/**
 * Used-car resale (task 057). A model's sold-price ratio by age
 * (from the table) gives a curve whose loss slows with age; a used car
 * sits on it at an effective age from its age and its miles. The weight
 * w comes from one fit on sold data (mileage-weight.json); when that
 * fit was not accepted, w is 0 and the car is placed by age alone.
 */

import weightFile from "./mileage-weight.json";
import { DEFAULT_RETENTION_5Y } from "./ownership";

export const TYPICAL_MILES_PER_YEAR = 12000;
export const MILEAGE_WEIGHT: number = weightFile.accepted ? Number(weightFile.weight) || 0 : 0;

export interface AgeCurve {
  byAge: Record<string, number>;
  slopePerYear: number;
}
export type UsedBasis = "new" | "used-age-miles" | "used-age" | "used-typical";

/** (age, log V) points from V(0) = 1, never rising: noisy sold medians can't make a car gain value. */
function points(c: AgeCurve): [number, number][] {
  const pts = Object.entries(c.byAge)
    .map(([a, r]) => [Number(a), r] as [number, number])
    .filter(([a, r]) => a > 0 && r > 0 && r <= 1.5)
    .sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [[0, 0]];
  for (const [a, r] of pts) out.push([a, Math.min(Math.log(r), out[out.length - 1][1])]);
  return out;
}

/** V(age): log-linear between stored ages, the fitted slope past the last one. */
export function curveValue(c: AgeCurve, ageYears: number): number {
  if (ageYears <= 0) return 1;
  const pts = points(c);
  for (let i = 1; i < pts.length; i += 1) {
    const [a1, l1] = pts[i];
    if (ageYears <= a1) {
      const [a0, l0] = pts[i - 1];
      return Math.exp(l0 + ((l1 - l0) * (ageYears - a0)) / (a1 - a0));
    }
  }
  const [aLast, lLast] = pts[pts.length - 1];
  return Math.exp(lLast + Math.min(0, c.slopePerYear) * (ageYears - aLast));
}

export function effectiveAge(ageYears: number, odometer: number, w = MILEAGE_WEIGHT): number {
  const age = Math.max(0, ageYears);
  return Math.max(0, age + (w * (odometer - TYPICAL_MILES_PER_YEAR * age)) / TYPICAL_MILES_PER_YEAR);
}

/** Resale ÷ the purchase-price basis after t months (miles keep adding at the typical rate). */
export function usedResaleFactor(c: AgeCurve, aEff: number): (tMonths: number) => number {
  const v0 = curveValue(c, aEff);
  return (t: number) => Math.min(1, curveValue(c, aEff + Math.max(0, t) / 12) / v0);
}

export function isNewCar(ageYears: number, odometer: number | null): boolean {
  return ageYears <= 0 && (odometer ?? 0) < 1000;
}

export function usedRetention(args: {
  buildYear: number | null;
  odometer: number | null;
  nowYear: number;
  retention: { retention5y: number; byAge: Record<string, number> | null; slopePerYear: number | null } | null;
}): { retention5y: number; resaleFactor?: (t: number) => number; basis: UsedBasis } {
  const retention5y = args.retention?.retention5y ?? DEFAULT_RETENTION_5Y;
  const age = args.buildYear !== null ? Math.max(0, args.nowYear - args.buildYear) : 0;
  if (isNewCar(age, args.odometer)) return { retention5y, basis: "new" };
  const r = args.retention;
  if (!r?.byAge || Object.keys(r.byAge).length === 0 || r.slopePerYear === null) {
    return { retention5y, basis: "used-typical" };
  }
  const curve = { byAge: r.byAge, slopePerYear: r.slopePerYear };
  const odometer = args.odometer ?? TYPICAL_MILES_PER_YEAR * age;
  return {
    retention5y,
    resaleFactor: usedResaleFactor(curve, effectiveAge(age, odometer)),
    basis: MILEAGE_WEIGHT > 0 && args.odometer !== null ? "used-age-miles" : "used-age",
  };
}
