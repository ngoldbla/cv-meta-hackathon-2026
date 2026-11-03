import { describe, expect, it } from "vitest";

import { RANK_FIXTURES, sampleUnitsFor, type Category } from "../fixtures";
import { ownershipMath } from "../ownership";
import { checkCostCompareSpec, checkPickCardSpec, collectSpecNumbers } from "./guard";
import { isCatalogValid } from "./validate";
import {
  buildCostCompareSpec,
  buildPickCardSpec,
  buildTurnSpecs,
  costBreakdown,
  type SpecEntry,
} from "./specs";

/** Tool-output fixtures: rank fixtures + real ownership maths. */
function entriesFor(category: Category, opts?: { fuel?: number | null }): SpecEntry[] {
  const fixture = RANK_FIXTURES[category];
  const picks = [...fixture.picks];
  if (!picks.some((p) => p.model === fixture.commodity.model)) {
    picks.push({ ...fixture.commodity });
  }
  return picks.map((pick, i) => {
    // Task 037 fixture: Illinois-style 8.98% tax financed in the loan.
    const own = ownershipMath({
      price: pick.price,
      tax: pick.price * 0.0898,
      down: pick.price * 0.1,
      apr: 8,
      term: 60,
      retention5y: pick.retention5y,
    });
    return {
      pick: {
        ...pick,
        // CR-V rated (mockup), Venue unrated, others rated.
        lifespanYears: pick.model === "Venue" ? null : 10 + i,
        lifespanMiles: pick.model === "Venue" ? null : (10 + i) * 12000,
        lifespanSource: pick.model === "Venue" ? null : "iSeeCars 2026",
        lifespanAsOf: pick.model === "Venue" ? null : "2026",
        recommendedTrim: "LX",
        baseTrim: "LX",
        currentYear: 2026,
      },
      ownership: {
        price: own.price,
        taxAmount: own.taxAmount,
        taxStatus: "included" as const,
        taxNotice:
          "Includes about 9.0% Illinois sales tax (state + average local, est.).",
        downPayment: own.downPayment,
        loanAmount: own.loanAmount,
        monthlyPayment: own.monthlyPayment,
        aprPercent: own.aprPercent,
        termMonths: own.termMonths,
        evenMonth: own.evenMonth,
        curve: own.curve,
      },
      local: {
        model: pick.model,
        fuel: opts?.fuel === null ? null : { perMonth: opts?.fuel ?? 150 },
        units: sampleUnitsFor(pick.model, pick.price).map((u) => ({
          ...u,
          year: 2026,
          trim: "LX",
        })),
      },
    };
  });
}

const CATEGORIES: Category[] = ["Sedan", "SUV", "Pickup"];

type CompareRow = {
  label: string;
  total: number;
  highlighted: boolean;
  cheapest: boolean;
};

function compareRows(spec: ReturnType<typeof buildCostCompareSpec>): CompareRow[] {
  return (spec!.elements[spec!.root]!.props as { rows: CompareRow[] }).rows;
}

describe("spec builders + number guard (task 034)", () => {
  for (const category of CATEGORIES) {
    it(`builds guarded specs for ${category}`, () => {
      const entries = entriesFor(category);
      const { compare, cards } = buildTurnSpecs(entries, category);
      expect(compare).not.toBeNull();
      expect(isCatalogValid(compare!)).toBe(true);
      const compareCheck = checkCostCompareSpec(compare!, entries);
      expect(compareCheck.failures).toEqual([]);
      expect(compareCheck.ok).toBe(true);
      for (const entry of entries) {
        const spec = cards.get(entry.pick.model)!;
        expect(spec.elements[spec.root]?.type).toBe("PickCard");
        expect(isCatalogValid(spec)).toBe(true);
        const check = checkPickCardSpec(spec, entry);
        expect(check.failures).toEqual([]);
        expect(check.ok).toBe(true);
      }
    });

    it(`orders the ${category} comparison cheapest first with one highlight`, () => {
      const entries = entriesFor(category);
      const compare = buildCostCompareSpec(entries, category)!;
      const rows = (
        compare.elements[compare.root]!.props as {
          rows: { label: string; total: number; highlighted: boolean }[];
        }
      ).rows;
      const totals = rows.map((r) => r.total);
      expect(totals).toEqual([...totals].sort((a, b) => a - b));
      expect(rows.filter((r) => r.highlighted)).toHaveLength(1);
      expect(rows.find((r) => r.highlighted)?.label).toContain(
        entries.find((e) => e.pick.rank === 1)!.pick.model,
      );
    });
  }

  it("tags exactly the cheapest rows in the comparison (task 035)", () => {
    const entries = entriesFor("SUV");
    const spec = buildCostCompareSpec(entries, "SUV")!;
    const rows = compareRows(spec);
    const min = Math.min(...rows.map((r) => r.total));
    expect(rows.length).toBeGreaterThan(1);
    // The tag goes on every row at the lowest real cost, and no other.
    expect(
      rows
        .filter((r) => r.cheapest)
        .map((r) => r.label)
        .sort(),
    ).toEqual(
      rows
        .filter((r) => r.total === min)
        .map((r) => r.label)
        .sort(),
    );
    // Rows are ordered cheapest first, so the first row is tagged.
    expect(rows[0]!.cheapest).toBe(true);
    // The tag is a boolean, not a number: catalog and guard still pass.
    expect(isCatalogValid(spec)).toBe(true);
    expect(checkCostCompareSpec(spec, entries).ok).toBe(true);
  });

  it("tags both rows on a tie, Pick #1 bold plus tag (task 035)", () => {
    const base = entriesFor("SUV")[0]!;
    const tied: SpecEntry[] = [
      { ...base, pick: { ...base.pick, make: "Alpha", model: "One", rank: 1 } },
      { ...base, pick: { ...base.pick, make: "Beta", model: "Two", rank: 2 } },
      {
        ...base,
        pick: { ...base.pick, make: "Gamma", model: "Three", rank: 3 },
        local: {
          model: base.pick.model,
          fuel: { perMonth: (base.local?.fuel?.perMonth ?? 150) + 200 },
          units: base.local?.units ?? [],
        },
      },
    ];
    const rows = compareRows(buildCostCompareSpec(tied, "SUV"));
    const byLabel = new Map(rows.map((r) => [r.label, r]));
    expect(byLabel.get("Alpha One")!.cheapest).toBe(true);
    expect(byLabel.get("Beta Two")!.cheapest).toBe(true);
    expect(byLabel.get("Gamma Three")!.cheapest).toBe(false);
    // Alpha is Pick #1: bold and tagged on the same row.
    expect(byLabel.get("Alpha One")!.highlighted).toBe(true);
    expect(byLabel.get("Beta Two")!.highlighted).toBe(false);
    expect(byLabel.get("Gamma Three")!.highlighted).toBe(false);
  });

  it("keeps the tag off a Pick #1 that is not cheapest (task 035)", () => {
    const base = entriesFor("SUV")[0]!;
    const entries: SpecEntry[] = [
      { ...base, pick: { ...base.pick, make: "Alpha", model: "One", rank: 2 } },
      {
        ...base,
        pick: { ...base.pick, make: "Beta", model: "Two", rank: 1 },
        local: {
          model: base.pick.model,
          fuel: { perMonth: (base.local?.fuel?.perMonth ?? 150) + 200 },
          units: base.local?.units ?? [],
        },
      },
    ];
    const rows = compareRows(buildCostCompareSpec(entries, "SUV"));
    const byLabel = new Map(rows.map((r) => [r.label, r]));
    expect(byLabel.get("Alpha One")!.cheapest).toBe(true);
    expect(byLabel.get("Alpha One")!.highlighted).toBe(false);
    expect(byLabel.get("Beta Two")!.cheapest).toBe(false);
    expect(byLabel.get("Beta Two")!.highlighted).toBe(true);
  });

  it("checks the CR-V 'back to you' figure against resale at 60", () => {
    const entries = entriesFor("SUV");
    const crv = entries.find((e) => e.pick.model === "CR-V")!;
    const costs = costBreakdown(crv)!;
    const at60 = crv.ownership!.curve.find((p) => p.month === 60)!;
    const viaResale = (at60.resale - crv.ownership!.downPayment) / 60;
    // Task 034 hand check: bills - real cost vs (resale - down) / 60.
    expect(Math.abs(costs.back - viaResale)).toBeLessThanOrEqual(1);
    expect(costs.back).toBe(costs.bills - costs.real);
  });

  it("renders an unrated lifespan as null years with no miles", () => {
    const entries = entriesFor("SUV");
    const venue = entries.find((e) => e.pick.model === "Venue")!;
    const spec = buildPickCardSpec(venue, entries.map((e) => e.pick), "SUV");
    const life = Object.values(spec.elements).find((e) => e.type === "LifespanTrack")!;
    expect((life.props as { years: unknown }).years).toBeNull();
    expect((life.props as { miles: unknown }).miles).toBeNull();
    expect(checkPickCardSpec(spec, venue).ok).toBe(true);
  });

  it("omits gas segments when there is no fuel estimate", () => {
    const entries = entriesFor("Sedan", { fuel: null });
    const entry = entries[0]!;
    const spec = buildPickCardSpec(entry, entries.map((e) => e.pick), "Sedan");
    const bars = Object.values(spec.elements).find((e) => e.type === "CostBars")!;
    const props = bars.props as { pay: { part: string }[]; real: { part: string }[] };
    expect(props.pay.map((s) => s.part)).toEqual(["loan"]);
    expect(props.real.map((s) => s.part)).toEqual(["valueLost", "interest", "tax"]);
    expect(checkPickCardSpec(spec, entry).ok).toBe(true);
  });

  it("shows the sales-tax segment and tax line (task 037)", () => {
    const entries = entriesFor("SUV");
    const crv = entries.find((e) => e.pick.model === "CR-V")!;
    const costs = costBreakdown(crv)!;
    expect(costs.tax).toBe(Math.round(crv.ownership!.taxAmount! / 60));
    expect(costs.real).toBeGreaterThan(costs.valueLost + costs.interest);
    const spec = buildPickCardSpec(crv, entries.map((e) => e.pick), "SUV");
    const bars = Object.values(spec.elements).find((e) => e.type === "CostBars")!;
    const props = bars.props as { real: { part: string; usd: number }[] };
    expect(props.real.map((s) => s.part)).toContain("tax");
    const root = spec.elements[spec.root]!.props as { taxLine: string };
    expect(root.taxLine).toContain("Illinois sales tax");
    expect(checkPickCardSpec(spec, crv).ok).toBe(true);
    const compare = buildCostCompareSpec(entries, "SUV")!;
    const rows = (
      compare.elements[compare.root]!.props as {
        rows: { tax: number; total: number }[];
      }
    ).rows;
    expect(rows.every((r) => r.tax > 0)).toBe(true);
    expect(checkCostCompareSpec(compare, entries).ok).toBe(true);
  });

  it("shows no tax segment in a no-tax state and the unknown line without a mapping", () => {
    const base = entriesFor("SUV")[0]!;
    // Genuinely untaxed ownership, so the guard's back-to-you check
    // still ties to resale (a taxed loan with taxAmount 0 must fail).
    const untaxed = ownershipMath({
      price: base.pick.price,
      down: base.pick.price * 0.1,
      apr: 8,
      term: 60,
      retention5y: base.pick.retention5y,
    });
    const untaxedOwnership = {
      price: untaxed.price,
      taxAmount: 0,
      downPayment: untaxed.downPayment,
      loanAmount: untaxed.loanAmount,
      monthlyPayment: untaxed.monthlyPayment,
      aprPercent: untaxed.aprPercent,
      termMonths: untaxed.termMonths,
      evenMonth: untaxed.evenMonth,
      curve: untaxed.curve,
    };
    const noTax: SpecEntry = {
      ...base,
      ownership: {
        ...untaxedOwnership,
        taxStatus: "none" as const,
        taxNotice: "No state sales tax on cars in Montana.",
      },
    };
    const spec = buildPickCardSpec(noTax, [noTax.pick], "SUV");
    const bars = Object.values(spec.elements).find((e) => e.type === "CostBars")!;
    const props = bars.props as { real: { part: string }[] };
    expect(props.real.map((s) => s.part)).not.toContain("tax");
    expect((spec.elements[spec.root]!.props as { taxLine: string }).taxLine).toBe(
      "No state sales tax on cars in Montana.",
    );
    expect(checkPickCardSpec(spec, noTax).ok).toBe(true);

    const unknown: SpecEntry = {
      ...base,
      ownership: {
        ...untaxedOwnership,
        taxStatus: "unknown" as const,
        taxNotice: "Tax not included: unknown state",
      },
    };
    const unknownSpec = buildPickCardSpec(unknown, [unknown.pick], "SUV");
    expect(
      (unknownSpec.elements[unknownSpec.root]!.props as { taxLine: string }).taxLine,
    ).toBe("Tax not included: unknown state");
    expect(checkPickCardSpec(unknownSpec, unknown).ok).toBe(true);
  });

  it("fails the guard when a spec number is tampered with", () => {
    const entries = entriesFor("SUV");
    const entry = entries[0]!;
    const spec = buildPickCardSpec(entry, entries.map((e) => e.pick), "SUV");
    const bars = Object.values(spec.elements).find((e) => e.type === "CostBars")!;
    (bars.props as { backWhenSold: number }).backWhenSold += 25;
    const check = checkPickCardSpec(spec, entry);
    expect(check.ok).toBe(false);
    expect(check.failures.map((f) => f.check)).toContain("back-identity");
    // Failures never carry a value (safe to log without data).
    expect(JSON.stringify(check.failures)).not.toMatch(/\d{2,}/);
  });

  it("fails the guard on a number the guard does not know", () => {
    const entries = entriesFor("SUV");
    const entry = entries[0]!;
    const spec = buildPickCardSpec(entry, entries.map((e) => e.pick), "SUV");
    const bars = Object.values(spec.elements).find((e) => e.type === "CostBars")!;
    (bars.props as Record<string, unknown>).extraCharge = 42;
    const check = checkPickCardSpec(spec, entry);
    expect(check.ok).toBe(false);
    expect(check.failures.map((f) => f.check)).toContain("unchecked-number");
    expect(collectSpecNumbers(spec).size).toBeGreaterThan(0);
  });
});
