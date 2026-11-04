import { describe, expect, it } from "vitest";

import {
  DEALER_QUESTIONS,
  dealSheetText,
  unitDeal,
  type DealInputs,
} from "./deal";
import { ownershipMath } from "./ownership";
import { checkListingSpec, collectSpecNumbers } from "./render/guard";
import { buildListingSpec, type SpecEntry } from "./render/specs";
import { isCatalogValid } from "./render/validate";
import type { TaxRule } from "./tax";

/** Fixture rules only (task 041): rates chosen for the tests. */
function rule(over: Partial<TaxRule> & Pick<TaxRule, "state">): TaxRule {
  return {
    name: over.state,
    kind: "sales",
    label: `${over.state} sales tax`,
    stateRate: 0.0625,
    avgLocalRate: 0.0273,
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

const IL = rule({ state: "IL", name: "Illinois", label: "Illinois sales tax" });

function inputs(over: Partial<DealInputs> = {}): DealInputs {
  return {
    downRule: { kind: "share", share: 0.1 },
    aprPercent: 7.1,
    termMonths: 60,
    retention5y: 0.62,
    taxStatus: "included",
    taxRule: IL,
    mpg: 30,
    ...over,
  };
}

describe("unitDeal: out-the-door maths (task 041)", () => {
  it("adds the state's estimated tax to the price with fees", () => {
    const d = unitDeal(inputs(), 34000, 140);
    // 34,000 x (6.25% + 2.73%) = 3,053.20
    expect(d.tax).toBeCloseTo(3053.2, 6);
    expect(d.outTheDoor).toBeCloseTo(37053.2, 6);
  });

  it("respects a capped rule", () => {
    const capped = rule({ state: "NC", kind: "sales", stateRate: 0.03, avgLocalRate: 0, cap: 2000 });
    const d = unitDeal(inputs({ taxRule: capped }), 80000, null);
    expect(d.tax).toBe(2000);
    expect(d.outTheDoor).toBe(82000);
  });

  it("charges nothing in a no-tax state and leaves an unknown state unknown", () => {
    const none = unitDeal(
      inputs({ taxStatus: "none", taxRule: rule({ state: "MT", kind: "none" }) }),
      34000,
      140,
    );
    expect(none.tax).toBe(0);
    expect(none.outTheDoor).toBe(34000);
    const unknown = unitDeal(inputs({ taxStatus: "unknown", taxRule: null }), 34000, 140);
    expect(unknown.tax).toBeNull();
    expect(unknown.outTheDoor).toBeNull();
  });

  it("matches ownership_math for the same price, so the face unit agrees with the card", () => {
    const price = 34000;
    const d = unitDeal(inputs(), price, 140);
    const own = ownershipMath({
      price,
      tax: d.tax!,
      down: price * 0.1,
      apr: 7.1,
      term: 60,
      retention5y: 0.62,
    });
    expect(d.loan).toBe(own.monthlyPayment);
    expect(d.down).toBe(own.downPayment);
    expect(d.positiveEquityMonth).toBe(own.positiveEquityMonth);
    expect(d.bills).toBeCloseTo(own.monthlyPayment + 140, 6);
  });

  it("keeps a fixed-dollar down payment fixed across units", () => {
    const fixed = inputs({ downRule: { kind: "amount", usd: 5000 } });
    expect(unitDeal(fixed, 30000, null).down).toBe(5000);
    expect(unitDeal(fixed, 40000, null).down).toBe(5000);
    expect(unitDeal(inputs(), 40000, null).down).toBe(4000);
  });

  it("prices a dearer unit higher with a later or equal equity month", () => {
    const cheap = unitDeal(inputs(), 32000, 140);
    const dear = unitDeal(inputs(), 36000, 140);
    expect(dear.loan).toBeGreaterThan(cheap.loan);
    expect(dear.positiveEquityMonth).toBe(cheap.positiveEquityMonth);
  });
});

/** Tool-output fixtures for one car with three local units. */
function entry(): SpecEntry {
  const di = inputs();
  const face = 33900;
  const faceDeal = unitDeal(di, face, 141.6);
  const own = ownershipMath({
    price: face,
    tax: faceDeal.tax!,
    down: face * 0.1,
    apr: di.aprPercent,
    term: 60,
    retention5y: di.retention5y,
  });
  return {
    pick: {
      rank: null,
      make: "Honda",
      model: "CR-V",
      price: face,
      depPerMonth: 200,
      retention5y: di.retention5y,
      recommendedTrim: "EX",
      currentYear: 2026,
    },
    ownership: {
      price: own.price,
      taxAmount: own.taxAmount,
      taxStatus: "included",
      taxNotice: "Includes about 9.0% Illinois sales tax (state + average local, est.).",
      downPayment: own.downPayment,
      loanAmount: own.loanAmount,
      monthlyPayment: own.monthlyPayment,
      aprPercent: own.aprPercent,
      termMonths: own.termMonths,
      positiveEquityMonth: own.positiveEquityMonth,
      curve: own.curve,
      dealInputs: di,
    },
    local: {
      model: "CR-V",
      fuel: { perMonth: 141.6 },
      units: [
        { dealer: "Fixture Honda", distanceMiles: 3.8, daysOnLot: 12, year: 2026, trim: "EX", price: 33900, url: "https://example.com/u/1", vin: "2HKRS4H7XTH000001" },
        { dealer: "Lakeside Fixture Motors", distanceMiles: 11.2, daysOnLot: 41, year: 2025, trim: "EX", price: 35250, url: "https://example.com/u/2", vin: null },
        { dealer: "North Fixture Auto", distanceMiles: 24, daysOnLot: null, year: 2026, trim: "EX", price: 36100, url: "https://example.com/u/3" },
      ],
      bestPrice: 33900,
      totalFound: 3,
      radiusUsed: 50,
    },
  };
}

describe("listing spec (task 041, part 1)", () => {
  it("builds a catalog-valid spec that passes the guard for every unit", () => {
    const e = entry();
    for (const u of e.local!.units) {
      const spec = buildListingSpec(e, u.url);
      expect(spec).not.toBeNull();
      expect(isCatalogValid(spec!)).toBe(true);
      expect(checkListingSpec(spec!, e)).toEqual({ ok: true, failures: [] });
    }
  });

  it("prices the face unit exactly as the card's ownership output", () => {
    const e = entry();
    const props = buildListingSpec(e, "https://example.com/u/1")!.elements.listing!.props as Record<string, unknown>;
    expect(props.loan).toBe(Math.round(e.ownership!.monthlyPayment));
    expect(props.positiveEquityMonth).toBe(e.ownership!.positiveEquityMonth);
    expect(props.title).toBe("2026 Honda CR-V EX");
    expect(props.vin).toBe("2HKRS4H7XTH000001");
    expect(props.daysOnLot).toBe(12);
  });

  it("returns null for a unit not in the tool results or an old ownership output", () => {
    const e = entry();
    expect(buildListingSpec(e, "https://example.com/elsewhere")).toBeNull();
    const old = { ...e, ownership: { ...e.ownership!, dealInputs: undefined } };
    expect(buildListingSpec(old, "https://example.com/u/1")).toBeNull();
  });

  it("fails the guard when any figure is tampered with", () => {
    const e = entry();
    const spec = buildListingSpec(e, "https://example.com/u/2")!;
    const numbers = [...collectSpecNumbers(spec).keys()].map((p) => p.split(".").pop()!);
    expect(numbers.length).toBeGreaterThan(8);
    for (const key of numbers) {
      const tampered = structuredClone(spec);
      const props = tampered.elements.listing!.props as Record<string, number>;
      props[key] = props[key]! + 7;
      expect(checkListingSpec(tampered, e).ok, key).toBe(false);
    }
    const swapped = structuredClone(spec);
    (swapped.elements.listing!.props as Record<string, unknown>).vin = "2HKRS4H7XTH000009";
    expect(checkListingSpec(swapped, e).ok).toBe(false);
    const extra = structuredClone(spec);
    (extra.elements.listing!.props as Record<string, unknown>).discount = 500;
    expect(checkListingSpec(extra, e).ok).toBe(false);
  });
});

describe("deal sheet text (task 041, part 2)", () => {
  const url = "https://low-key-murex.vercel.app/?zip=60614&type=suv";

  it("writes every figure from the guarded listing props", () => {
    const e = entry();
    const spec = buildListingSpec(e, "https://example.com/u/2")!;
    const props = spec.elements.listing!.props as unknown as Parameters<typeof dealSheetText>[0];
    const text = dealSheetText(props, url);
    const d = unitDeal(e.ownership!.dealInputs!, 35250, 141.6);
    const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
    expect(text).toBe(
      [
        "2025 Honda CR-V EX at Lakeside Fixture Motors",
        "",
        "Price with fees: $35,250",
        `Estimated out the door: ${fmt(d.outTheDoor!)} (with about ${fmt(d.tax!)} sales tax, est.)`,
        `Monthly at 10% down, 60 months, 7.1% APR: ${fmt(d.loan)} loan + $142 gas = ${fmt(d.bills)}/mo`,
        `Positive equity by month ${d.positiveEquityMonth}.`,
        "",
        "Questions to ask:",
        `1. ${DEALER_QUESTIONS[0]}`,
        `2. ${DEALER_QUESTIONS[1]}`,
        `3. ${DEALER_QUESTIONS[2]}`,
        "",
        `My Low Key results: ${url}`,
      ].join("\n"),
    );
    // Every number in the text is one of the props (or the link's ZIP).
    const allowed = new Set(
      [
        props.price, props.outTheDoor, props.tax, props.loan, props.gas, props.bills,
        props.positiveEquityMonth, props.aprPercent, props.termMonths, 10, 2025, 1, 2, 3, 60614,
      ].map((n) => String(n)),
    );
    const numbers = text.replace(/https?:\/\/\S+/g, "").match(/\d[\d,.]*/g) ?? [];
    for (const n of numbers) {
      expect(allowed.has(n.replace(/,/g, "").replace(/\.$/, "")), n).toBe(true);
    }
  });

  it("includes the VIN when the provider gives one, and no contact details", () => {
    const e = entry();
    const props = buildListingSpec(e, "https://example.com/u/1")!.elements.listing!.props as unknown as Parameters<typeof dealSheetText>[0];
    const text = dealSheetText(props, url);
    expect(text).toContain("VIN 2HKRS4H7XTH000001");
    expect(text).not.toMatch(/phone|@|example\.com\/u/i);
  });

  it("says so when the state is unknown, and names a fixed down payment", () => {
    const e = entry();
    e.ownership!.dealInputs = inputs({
      taxStatus: "unknown",
      taxRule: null,
      downRule: { kind: "amount", usd: 5000 },
    });
    const props = buildListingSpec(e, "https://example.com/u/3")!.elements.listing!.props as unknown as Parameters<typeof dealSheetText>[0];
    const text = dealSheetText(props, url);
    expect(text).toContain("Sales tax not included: unknown state");
    expect(text).toContain("Monthly at $5,000 down, 60 months");
    expect(text).not.toContain("VIN");
  });
});
