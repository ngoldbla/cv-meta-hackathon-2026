import { describe, expect, it } from "vitest";

import {
  resolveTax,
  stateForZip,
  taxAmountFor,
  taxNoticeText,
  type TaxRule,
  type TaxSection,
} from "./tax";

/** Fixture rules only (task 037): rates chosen for the tests. */
function rule(over: Partial<TaxRule> & Pick<TaxRule, "state">): TaxRule {
  return {
    name: over.state,
    kind: "sales",
    label: `${over.state} sales tax`,
    stateRate: 0.05,
    avgLocalRate: 0,
    cap: null,
    localBaseCap: null,
    flatAdd: 0,
    vehicleAddRate: 0,
    base: "price_with_fees",
    note: "",
    sourceUrl: "https://example.com/state",
    sourceDate: "2026-11-03",
    ...over,
  };
}

const RANGES: [number, number, string][] = [
  [600, 629, "IL"],
  [300, 319, "GA"],
  [270, 289, "NC"],
  [590, 599, "MT"],
];

const TAX: TaxSection = {
  version: 1,
  asOf: "2026-11-03",
  taxFoundation: null,
  states: {
    IL: rule({
      state: "IL",
      name: "Illinois",
      label: "Illinois sales tax",
      stateRate: 0.0625,
      avgLocalRate: 0.0273,
    }),
    GA: rule({
      state: "GA",
      name: "Georgia",
      kind: "tavt",
      label: "Georgia title ad valorem tax (TAVT)",
      stateRate: 0.07,
    }),
    NC: rule({
      state: "NC",
      name: "North Carolina",
      kind: "hut",
      label: "North Carolina highway use tax",
      stateRate: 0.03,
    }),
    MT: rule({ state: "MT", name: "Montana", kind: "none", stateRate: 0 }),
  },
};

describe("stateForZip (task-027 ZIP3 rules)", () => {
  it("maps the task ZIPs to their states", () => {
    expect(stateForZip("60614", RANGES)).toBe("IL");
    expect(stateForZip("30097", RANGES)).toBe("GA");
    expect(stateForZip("59001", RANGES)).toBe("MT");
  });

  it("returns null for a ZIP with no mapping", () => {
    expect(stateForZip("99999", RANGES)).toBeNull();
    expect(stateForZip("1234", RANGES)).toBeNull();
  });
});

describe("resolveTax fixtures (task 037, part 3)", () => {
  it("taxes a percentage state on the price with fees", () => {
    const res = resolveTax({
      zip: "60614",
      priceWithFees: 31950,
      zip3Ranges: RANGES,
      tax: TAX,
    });
    expect(res.status).toBe("included");
    if (res.status !== "included") throw new Error("expected included");
    expect(res.tax).toBeCloseTo(31950 * 0.0898, 2);
    expect(taxNoticeText(res)).toBe(
      "Includes about 9.0% Illinois sales tax (state + average local, est.).",
    );
  });

  it("applies Georgia TAVT as its own kind", () => {
    const res = resolveTax({
      zip: "30097",
      priceWithFees: 25000,
      zip3Ranges: RANGES,
      tax: TAX,
    });
    expect(res.status).toBe("included");
    if (res.status !== "included") throw new Error("expected included");
    expect(res.rule.kind).toBe("tavt");
    expect(res.tax).toBeCloseTo(1750, 2);
    expect(taxNoticeText(res)).toContain("Georgia title ad valorem tax (TAVT)");
  });

  it("applies the North Carolina highway use tax", () => {
    const res = resolveTax({
      zip: "27601",
      priceWithFees: 40000,
      zip3Ranges: RANGES,
      tax: TAX,
    });
    expect(res.status).toBe("included");
    if (res.status !== "included") throw new Error("expected included");
    expect(res.rule.kind).toBe("hut");
    expect(res.tax).toBe(1200);
  });

  it("charges nothing in a no-tax state and says so", () => {
    const res = resolveTax({
      zip: "59001",
      priceWithFees: 40000,
      zip3Ranges: RANGES,
      tax: TAX,
    });
    expect(res.status).toBe("none");
    expect(res.tax).toBe(0);
    expect(taxNoticeText(res)).toBe("No state sales tax on cars in Montana.");
  });

  it("reports unknown for a ZIP with no mapping instead of guessing", () => {
    const res = resolveTax({
      zip: "99999",
      priceWithFees: 40000,
      zip3Ranges: RANGES,
      tax: TAX,
    });
    expect(res.status).toBe("unknown");
    expect(res.tax).toBeNull();
    expect(taxNoticeText(res)).toBe("Tax not included: unknown state");
  });

  it("reports unknown when the table has no tax section", () => {
    const res = resolveTax({
      zip: "60614",
      priceWithFees: 40000,
      zip3Ranges: RANGES,
      tax: null,
    });
    expect(res.status).toBe("unknown");
  });
});

describe("taxAmountFor caps (task 037)", () => {
  it("caps the South Carolina-style fee", () => {
    const sc = rule({
      state: "SC",
      kind: "imf",
      label: "South Carolina infrastructure maintenance fee",
      stateRate: 0.05,
      cap: 500,
    });
    expect(taxAmountFor(sc, 40000)).toBe(500);
    expect(taxAmountFor(sc, 8000)).toBe(400);
    const res: TaxSection = {
      version: 1,
      asOf: "2026-11-03",
      taxFoundation: null,
      states: { SC: sc },
    };
    const resolved = resolveTax({
      zip: "29001",
      priceWithFees: 40000,
      zip3Ranges: [[290, 299, "SC"]],
      tax: res,
    });
    expect(taxNoticeText(resolved)).toContain("capped at $500");
  });
});
