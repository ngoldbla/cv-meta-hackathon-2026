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

describe("ownershipMath curve, evenMonth and walk-away table (task 026)", () => {
  it("returns a 61-point curve from month 0 to 60", () => {
    const r = ownershipMath({ price: 30000, down: 3000, apr: 6, term: 60, retention5y: 0.6 });
    expect(r.curve).toHaveLength(61);
    expect(r.curve.map((p) => p.month)).toEqual(
      Array.from({ length: 61 }, (_, i) => i),
    );
    for (const p of r.curve) {
      expect(p.resale).toBeCloseTo(resaleAt(30000, 0.6, p.month), 1);
      expect(p.balance).toBeCloseTo(balanceAt(27000, 6, 60, p.month), 1);
    }
  });

  it("curve month 0 balance is the loan amount and month 60 balance is 0", () => {
    const r = ownershipMath({ price: 33000, apr: 8, term: 60, retention5y: 0.629 });
    expect(r.loanAmount).toBe(29700);
    expect(r.curve[0].balance).toBe(29700);
    expect(r.curve[60].balance).toBe(0);
    expect(r.curve[0].resale).toBeCloseTo(33000 * 0.85, 2);
  });

  it("evenMonth matches a brute-force scan and aliases underwaterMonth", () => {
    const cases = [
      { price: 30000, down: 3000, apr: 6, term: 60, retention5y: 0.6 },
      { price: 33000, down: 3300, apr: 8, term: 60, retention5y: 0.629 },
      { price: 24856, down: 2485.6, apr: 8, term: 60, retention5y: 0.575 },
      { price: 20000, down: 2000, apr: 12, term: 60, retention5y: 0.3 },
    ];
    for (const c of cases) {
      const r = ownershipMath(c);
      let brute: number | null = null;
      for (let t = 0; t <= c.term; t += 1) {
        if (resaleAt(c.price, c.retention5y, t) >= balanceAt(c.price - c.down, c.apr, c.term, t)) {
          brute = t;
          break;
        }
      }
      expect(r.evenMonth).toBe(brute);
      expect(r.underwaterMonth).toBe(brute);
    }
  });

  it("equity points are resale − balance, and month 60 equity equals resale (task 039)", () => {
    const r = ownershipMath({ price: 33000, down: 3300, apr: 8, term: 60, retention5y: 0.629 });
    for (const p of r.curve) expect(p.equity).toBeCloseTo(p.resale - p.balance, 1);
    const last = r.curve[60]!;
    expect(last.balance).toBeCloseTo(0, 1);
    expect(last.equity).toBeCloseTo(last.resale, 1);
    expect(r.positiveEquityMonth).toBe(r.evenMonth);
  });

  it("sample check: $33k, 10% down, 8% APR, 60 mo, retention 0.629", () => {
    const r = ownershipMath({ price: 33000, down: 3300, apr: 8, term: 60, retention5y: 0.629 });
    expect(r.evenMonth).toBe(7);
    const at36 = r.walkAway.find((p) => p.month === 36)!;
    expect(Math.abs(at36.getBack - 10118)).toBeLessThan(35);
    const at60 = r.walkAway.find((p) => p.month === 60)!;
    expect(at60.costPerMonth).toBeCloseTo(311, 0);
    expect(Math.abs(at60.costPerMonth - 311)).toBeLessThan(2);
  });

  it("walk-away table uses getBack and costPerMonth", () => {
    const r = ownershipMath({ price: 30000, down: 3000, apr: 6, term: 60, retention5y: 0.6 });
    expect(r.walkAway.map((p) => p.month)).toEqual([6, 12, 24, 36, 60]);
    for (const p of r.walkAway) {
      expect(p.getBack).toBeCloseTo(p.resale - p.balance, 1);
      expect(p.getBack).toBeCloseTo(p.equity, 1);
      expect(p.costPerMonth).toBeCloseTo(p.walkAwayCost / p.month, 1);
      expect(p.costPerMonth).toBeCloseTo(p.perMonth, 1);
    }
    // Negative getBack means the owner would still owe.
    const early = ownershipMath({ price: 33000, down: 3300, apr: 8, term: 60, retention5y: 0.629 });
    expect(early.walkAway.find((p) => p.month === 6)!.getBack).toBeLessThan(0);
  });

  it("evenMonth falls back to the payoff month at the latest", () => {
    // Balance is 0 at month 60 and resale is positive, so the
    // curves always meet by payoff; a very fast-depreciating car
    // with no down payment crosses only at the end.
    const r = ownershipMath({ price: 20000, down: 0, apr: 20, term: 60, retention5y: 0.2 });
    expect(r.evenMonth).not.toBeNull();
    expect(r.evenMonth!).toBeGreaterThan(12);
    expect(r.evenMonth!).toBeLessThanOrEqual(60);
  });
});

describe("financed sales tax (task 037, part 3)", () => {
  const taxed = ownershipMath({
    price: 31950,
    tax: 2869.11,
    apr: 8,
    term: 60,
    retention5y: 0.629,
  });
  const untaxed = ownershipMath({
    price: 31950,
    apr: 8,
    term: 60,
    retention5y: 0.629,
  });

  it("finances the tax: loan is price with fees plus tax less down", () => {
    // Down stays 10% of the price with fees, not of price plus tax.
    expect(taxed.downPayment).toBe(3195);
    expect(taxed.taxAmount).toBe(2869.11);
    expect(taxed.loanAmount).toBeCloseTo(31950 + 2869.11 - 3195, 2);
    expect(taxed.monthlyPayment).toBeCloseTo(
      monthlyPayment(31950 + 2869.11 - 3195, 8, 60),
      2,
    );
    expect(taxed.monthlyPayment).toBeGreaterThan(untaxed.monthlyPayment);
  });

  it("leaves the resale value unchanged", () => {
    for (const month of [0, 12, 36, 60]) {
      expect(taxed.curve[month]!.resale).toBe(untaxed.curve[month]!.resale);
    }
    expect(taxed.curve[60]!.resale).toBeCloseTo(31950 * 0.629, 1);
  });

  it("moves evenMonth later (or keeps it) and deepens the walk-away", () => {
    expect(taxed.evenMonth).not.toBeNull();
    expect(untaxed.evenMonth).not.toBeNull();
    expect(taxed.evenMonth!).toBeGreaterThanOrEqual(untaxed.evenMonth!);
    // The financed tax is underwater longer on this fixture.
    expect(taxed.evenMonth!).toBeGreaterThan(untaxed.evenMonth!);
    const taxed60 = taxed.walkAway.find((p) => p.month === 60)!;
    const plain60 = untaxed.walkAway.find((p) => p.month === 60)!;
    expect(taxed60.walkAwayCost).toBeGreaterThan(plain60.walkAwayCost);
  });

  it("walk-away at 60 is depreciation plus interest plus tax", () => {
    const at60 = taxed.walkAway.find((p) => p.month === 60)!;
    const depreciation = 31950 - taxed.curve[60]!.resale;
    const interest =
      monthlyPayment(taxed.loanAmount, 8, 60) * 60 - taxed.loanAmount;
    expect(at60.walkAwayCost).toBeCloseTo(depreciation + interest + 2869.11, 1);
  });
});
