import { describe, expect, it } from "vitest";

import {
  costPerYearOfLife,
  effectiveMonthlyCost,
  lastsAboutLabel,
  leftoverYearNote,
  lifespanMilesFromYears,
  lifespanRowText,
  lifespanYearsFromMiles,
  monthlyBills,
  trimLineText,
  trimStepMonthly,
  unitTitle,
} from "./costs";
import { monthlyPayment, ownershipMath } from "./ownership";

describe("monthlyBills (task 029, part 3)", () => {
  it("is loan plus the median gas estimate", () => {
    const b = monthlyBills(602, 130);
    expect(b).toEqual({ total: 732, loan: 602, gas: 130 });
  });

  it("falls back to the loan alone with no gas estimate", () => {
    expect(monthlyBills(602, null)).toEqual({ total: 602, loan: 602, gas: null });
    expect(monthlyBills(602, undefined).gas).toBeNull();
  });
});

describe("effectiveMonthlyCost (hand-worked example)", () => {
  it("matches (depreciation + interest + fuel) / 60 by hand", () => {
    // Hand example: $30,000 car, keeps 60% after discount, $27,000
    // loan (10% down) at 6% over 60 months, $100 a month of gas.
    // Payment is the known $521.99; depreciation $12,000; interest
    // $521.99*60 - $27,000 = $4,319.15; fuel $6,000; total $22,319.15
    // over 60 months is about $371.99 a month.
    const payment = monthlyPayment(27000, 6, 60);
    expect(payment).toBeCloseTo(521.99, 2);
    const eff = effectiveMonthlyCost({
      price: 30000,
      retentionAfterDiscount: 0.6,
      monthlyPayment: payment,
      loanAmount: 27000,
      fuelPerMonth: 100,
    });
    expect(eff).toBeCloseTo((12000 + 4319.15 + 6000) / 60, 1);
    expect(eff).toBeCloseTo(371.99, 1);
    expect(eff).toBeLessThan(602 + 100); // below the $702 bills here
  });

  it("agrees with ownership walk-away at month 60 plus fuel", () => {
    const own = ownershipMath({
      price: 33000, down: 3300, apr: 8, term: 60, retention5y: 0.629,
    });
    const eff = effectiveMonthlyCost({
      price: 33000,
      retentionAfterDiscount: 0.629,
      monthlyPayment: own.monthlyPayment,
      loanAmount: own.loanAmount,
      fuelPerMonth: 150,
    });
    const at60 = own.walkAway.find((p) => p.month === 60)!;
    // walkAwayCost(60) is depreciation + interest by construction.
    expect(eff).toBeCloseTo(at60.walkAwayCost / 60 + 150, 1);
  });
});

describe("lifespan conversion (task 029, part 2)", () => {
  it("divides expected miles by 12,000 a year", () => {
    expect(lifespanYearsFromMiles(204000)).toBeCloseTo(17, 6);
    expect(lifespanMilesFromYears(17)).toBe(204000);
    expect(lastsAboutLabel(13.5)).toBe("Lasts about 14 years");
    expect(lastsAboutLabel(10.7)).toBe("Lasts about 11 years");
  });

  it("prices a year of life from the price with fees", () => {
    expect(costPerYearOfLife(34000, 17)).toBeCloseTo(2000, 6);
  });
});

describe("trimStepMonthly", () => {
  it("is the payment on the financed step cost", () => {
    // $2,440 step, 10% down share removed, 8% over 60 months.
    const m = trimStepMonthly(2440, 8);
    expect(m).toBeCloseTo(monthlyPayment(2440 * 0.9, 8, 60), 6);
    expect(m).toBeGreaterThan(40);
    expect(m).toBeLessThan(50);
  });
});

describe("model years on units (task 031, part 2)", () => {
  it("shows the year next to the trim", () => {
    expect(unitTitle(2027, "Civic", "Sport")).toBe("2027 Civic Sport");
  });

  it("notes a leftover year but not the same or a later year", () => {
    expect(leftoverYearNote(2026, 2026)).toBeNull();
    expect(leftoverYearNote(2025, 2026)).toBe(
      "2025 model year: at resale it counts as a year older.",
    );
    expect(leftoverYearNote(2027, 2026)).toBeNull();
  });

  it("shows no year and no note when the year is missing", () => {
    expect(unitTitle(null, "Civic", "Sport")).toBe("Civic Sport");
    expect(leftoverYearNote(null, 2026)).toBeNull();
    expect(leftoverYearNote(2025, null)).toBeNull();
  });
});

describe("lifespan row (task 031, part 3)", () => {
  it("says not yet rated with no number when there is no lifespan", () => {
    expect(lifespanRowText(null)).toBe("Not yet rated");
    expect(lifespanRowText(undefined)).toBe("Not yet rated");
    expect(lifespanRowText(null)).not.toMatch(/\d/);
  });

  it("keeps the rated label otherwise", () => {
    expect(lifespanRowText(13.9)).toBe("Lasts about 14 years");
  });
});

describe("trimLineText (task 029, part 1)", () => {
  it("shows the step-up cost over base with its monthly cost", () => {
    const line = trimLineText({
      baseTrim: "LE", stepUpTrim: "SE", recommendedTrim: "SE",
      trimIsStepUp: true, trimStepCost: 2440, aprPercent: 8,
    })!;
    expect(line).toContain("SE: +$2,440 over LE, about $");
    expect(line).toContain("a month");
  });

  it("says why when the retention guard drops to base", () => {
    const line = trimLineText({
      baseTrim: "LE", stepUpTrim: "SE", recommendedTrim: "LE",
      trimGuardHit: true, trimRetention5y: 0.6, modelRetentionRetail: 0.68,
    })!;
    expect(line).toContain("LE (base)");
    // Displayed percentages are after the 15% discount (retail x 0.85):
    // trim 0.60 -> 51%, model 0.68 -> 58%. The guard itself compares
    // the retail fits; only the shown numbers change (task 031).
    expect(line).toContain("keeps 51%");
    expect(line).toContain("model's 58%");
  });

  it("shows only after-discount percentages when retail and discounted differ", () => {
    // CR-V shape (task 031): retail fits trim 0.688 / model 0.741,
    // after-discount 0.585 / 0.629 -> "58%" and "63%" on the card.
    const line = trimLineText({
      baseTrim: "LX", stepUpTrim: "EX", recommendedTrim: "LX",
      trimGuardHit: true, trimRetention5y: 0.688, modelRetentionRetail: 0.741,
    })!;
    expect(line).toContain("the EX keeps 58%");
    expect(line).toContain("model's 63%");
    expect(line).not.toContain("69%");
    expect(line).not.toContain("74%");
  });

  it("says so when the step-up trim has no local stock", () => {
    const line = trimLineText({
      baseTrim: "LE", stepUpTrim: "SE", recommendedTrim: "SE",
      trimIsStepUp: true, trimStepCost: 2440, aprPercent: 8,
      fellBackToBase: true,
    })!;
    expect(line).toBe(
      "LE (base): no SE in stock within 150 miles, so the base trim is shown.",
    );
  });

  it("shows nothing when no trim was measured", () => {
    expect(trimLineText({})).toBeNull();
  });
});
