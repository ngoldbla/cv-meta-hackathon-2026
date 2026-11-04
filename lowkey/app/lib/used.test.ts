import { describe, expect, it } from "vitest";

import { ownershipMath } from "./ownership";
import { curveValue, effectiveAge, isNewCar, usedResaleFactor, usedRetention } from "./used";

const curve = { byAge: { "1": 0.86, "2": 0.79, "3": 0.72 }, slopePerYear: -0.09 };

describe("curveValue", () => {
  it("is 1 when new and hits the stored points", () => {
    expect(curveValue(curve, 0)).toBe(1);
    expect(curveValue(curve, 2)).toBeCloseTo(0.79, 10);
  });
  it("interpolates log-linearly between points", () => {
    expect(curveValue(curve, 1.5)).toBeCloseTo(Math.sqrt(0.86 * 0.79), 10);
  });
  it("extrapolates past the last point with the slope", () => {
    expect(curveValue(curve, 4)).toBeCloseTo(0.72 * Math.exp(-0.09), 10);
  });
  it("never rises with age, even on noisy points", () => {
    const noisy = { byAge: { "1": 0.8, "2": 0.83, "3": 0.7 }, slopePerYear: -0.1 };
    expect(curveValue(noisy, 2)).toBeLessThanOrEqual(curveValue(noisy, 1));
  });
});

describe("effectiveAge", () => {
  it("moves a high-mileage car further along", () => {
    expect(effectiveAge(2, 24000, 0.5)).toBe(2);
    expect(effectiveAge(2, 36000, 0.5)).toBe(2.5);
    expect(effectiveAge(2, 0, 0.5)).toBe(1);
    expect(effectiveAge(0, 0, 0.5)).toBe(0);
  });
  it("is the age when w is 0", () => {
    expect(effectiveAge(3, 90000, 0)).toBe(3);
  });
});

describe("usedResaleFactor", () => {
  it("is 1 at month 0 and stays within 0..1", () => {
    const old = usedResaleFactor(curve, 3);
    expect(usedResaleFactor(curve, 0.5)(0)).toBe(1);
    expect(old(12)).toBeGreaterThan(0);
    expect(old(12)).toBeLessThanOrEqual(1);
  });
  it("more miles never raise the car's value at any later date (as a share of its new price)", () => {
    for (const t of [0, 12, 24, 48]) {
      const low = curveValue(curve, effectiveAge(2, 20000, 0.5) + t / 12);
      const high = curveValue(curve, effectiveAge(2, 40000, 0.5) + t / 12);
      expect(high).toBeLessThanOrEqual(low + 1e-12);
    }
  });
  it("a car further along loses a smaller share of its price (the curve flattens)", () => {
    const fresh = usedResaleFactor(curve, 0.5)(24);
    const older = usedResaleFactor(curve, 3)(24);
    expect(older).toBeGreaterThanOrEqual(fresh);
  });
});

describe("usedRetention", () => {
  const retention = { retention5y: 0.55, byAge: curve.byAge, slopePerYear: -0.09 };
  it("a new car keeps today's path exactly", () => {
    const r = usedRetention({ buildYear: 2026, odometer: 12, nowYear: 2026, retention });
    expect(r.basis).toBe("new");
    expect(r.resaleFactor).toBeUndefined();
    const a = ownershipMath({ price: 30000, retention5y: 0.55 });
    const b = ownershipMath({ price: 30000, retention5y: r.retention5y, resaleFactor: r.resaleFactor });
    expect(b).toEqual(a);
  });
  it("a used car with points gets a curve", () => {
    const r = usedRetention({ buildYear: 2023, odometer: 40000, nowYear: 2026, retention });
    expect(r.resaleFactor).toBeDefined();
    expect(["used-age-miles", "used-age"]).toContain(r.basis);
  });
  it("a used car without points falls back to the typical curve, labelled", () => {
    const r = usedRetention({
      buildYear: 2023,
      odometer: 40000,
      nowYear: 2026,
      retention: { retention5y: 0.55, byAge: null, slopePerYear: null },
    });
    expect(r.basis).toBe("used-typical");
    expect(r.resaleFactor).toBeUndefined();
  });
  it("knows a new car", () => {
    expect(isNewCar(0, null)).toBe(true);
    expect(isNewCar(1, 5000)).toBe(false);
    expect(isNewCar(0, 3000)).toBe(false);
  });
});
