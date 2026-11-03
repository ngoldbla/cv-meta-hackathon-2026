import { describe, expect, it } from "vitest";

import {
  balanceAt,
  monthlyPayment,
  ownershipMath,
  resaleAt,
} from "./ownership";

describe("monthlyPayment (known amortisation values)", () => {
  it("matches the standard table for $27,000 at 6% over 60 months", () => {
    // Independent value: 27000 * 0.005 / (1 - 1.005^-60) = 521.9856.
    expect(monthlyPayment(27000, 6, 60)).toBeCloseTo(521.99, 2);
  });

  it("matches $10,000 at 12% over 12 months", () => {
    expect(monthlyPayment(10000, 12, 12)).toBeCloseTo(888.49, 2);
  });

  it("handles 0% APR as principal over term", () => {
    expect(monthlyPayment(12000, 0, 60)).toBeCloseTo(200, 6);
  });

  it("is zero for a zero loan", () => {
    expect(monthlyPayment(0, 8, 60)).toBe(0);
  });
});

describe("balanceAt", () => {
  it("starts at the principal and ends at zero", () => {
    expect(balanceAt(27000, 6, 60, 0)).toBe(27000);
    expect(balanceAt(27000, 6, 60, 60)).toBe(0);
    expect(balanceAt(27000, 6, 60, 72)).toBe(0);
  });

  it("matches the amortisation schedule at month 12", () => {
    expect(balanceAt(27000, 6, 60, 12)).toBeCloseTo(22226.31, 1);
  });
});

describe("resaleAt", () => {
  it("drops to 85% at month 0 and hits the 5-year retention at 60", () => {
    expect(resaleAt(30000, 0.6, 0)).toBeCloseTo(25500, 6);
    expect(resaleAt(30000, 0.6, 60)).toBeCloseTo(18000, 6);
  });
});

describe("ownershipMath", () => {
  const base = ownershipMath({
    price: 30000,
    down: 3000,
    apr: 6,
    term: 60,
    retention5y: 0.6,
    model: "Test",
  });

  it("uses 10% down, 8% APR and 60 months by default", () => {
    const d = ownershipMath({ price: 30000 });
    expect(d.downPayment).toBe(3000);
    expect(d.aprPercent).toBe(8);
    expect(d.termMonths).toBe(60);
  });

  it("charges the default-APR payment on the default loan", () => {
    const d = ownershipMath({ price: 30000 });
    // Loan 27000 at 8% over 60 months (result is rounded to cents).
    expect(d.monthlyPayment).toBeCloseTo(monthlyPayment(27000, 8, 60), 2);
    expect(d.monthlyPayment).toBeGreaterThan(521.99);
  });

  it("walk-away at month 0 is the immediate 15% lot loss", () => {
    const at0 = ownershipMath({ price: 30000, down: 3000, apr: 6, term: 60, retention5y: 0.6 });
    // Recompute month 0 from the pieces: down - (resale0 - balance0).
    const resale0 = resaleAt(30000, 0.6, 0);
    const balance0 = balanceAt(27000, 6, 60, 0);
    expect(at0.walkAway[0].month).toBe(6);
    expect(3000 - (resale0 - balance0)).toBeCloseTo(4500, 6);
    expect(resale0).toBeCloseTo(25500, 6);
    expect(balance0).toBe(27000);
  });

  it("walk-away equals depreciation plus interest at every table month", () => {
    for (const point of base.walkAway) {
      const principal = 27000;
      const payment = monthlyPayment(principal, 6, 60);
      const balance = balanceAt(principal, 6, 60, point.month);
      const resale = resaleAt(30000, 0.6, point.month);
      const depreciation = 30000 - resale;
      const interestPaid = payment * point.month - (principal - balance);
      expect(point.walkAwayCost).toBeCloseTo(depreciation + interestPaid, 1);
      expect(point.resale).toBeCloseTo(resale, 1);
      expect(point.balance).toBeCloseTo(balance, 1);
    }
  });

  it("returns the full 6/12/24/36/60 table and an above-water month", () => {
    expect(base.walkAway.map((p) => p.month)).toEqual([6, 12, 24, 36, 60]);
    expect(base.walkAwayCost.month_12).toBe(base.walkAway[1].walkAwayCost);
    expect(base.underwaterMonth).not.toBeNull();
    expect(base.underwaterMonth!).toBeGreaterThanOrEqual(1);
    expect(base.underwaterMonth!).toBeLessThanOrEqual(60);
    // At the reported month the owner is above water; the month before, not.
    const m = base.underwaterMonth!;
    const resaleM = resaleAt(30000, 0.6, m);
    const balanceM = balanceAt(27000, 6, 60, m);
    expect(resaleM).toBeGreaterThanOrEqual(balanceM);
    if (m > 1) {
      expect(resaleAt(30000, 0.6, m - 1)).toBeLessThan(
        balanceAt(27000, 6, 60, m - 1),
      );
    }
  });

  it("rejects a non-positive price", () => {
    expect(() => ownershipMath({ price: 0 })).toThrow("price must be positive");
  });
});
