// @vitest-environment node
import { describe, expect, it } from "vitest";

import { dealRowOf, dealTitle, resaleFor, vsDealLine } from "./benchmark";
import type { headsUp } from "./compare";
import { emptyQuote, type Quote } from "./schema";

const terms = { downRule: { kind: "share", share: 0.1 } as const, aprPercent: 7, termMonths: 60 };

function quote(patch: Partial<Quote> = {}): Quote {
  return { ...emptyQuote(), sellingPrice: 30000, outTheDoor: 32000, apr: 6, termMonths: 60, down: 3000, ...patch };
}

describe("dealTitle", () => {
  it("prefers the VIN lookup's car", () => {
    const q = quote({ car: { year: 2026, make: "Honda", model: "Civic", trim: "Sport", miles: 12, status: "active" } });
    expect(dealTitle(q)).toBe("2026 Honda Civic Sport");
  });
  it("falls back to the typed year and vehicle", () => {
    expect(dealTitle(quote({ year: 2025, vehicle: "Toyota Camry" }))).toBe("2025 Toyota Camry");
  });
  it("has a plain default", () => expect(dealTitle(quote())).toBe("Your deal"));
});

describe("resaleFor", () => {
  const picks = [{ key: "honda|civic", label: "Honda Civic", retention5y: 0.62, dealInputs: null, deal: {} as never }];
  it("uses the pick whose name the vehicle contains", () => {
    expect(resaleFor(quote({ vehicle: "honda civic ex" }), null, picks, 2026)).toEqual({ retention5y: 0.62 });
  });
  it("is null for an unknown car", () => {
    expect(resaleFor(quote({ vehicle: "Some Truck" }), null, picks, 2026)).toBeNull();
  });
  it("prices a VIN car on its model's history when it has one", () => {
    const r = resaleFor(quote(), { year: 2026, miles: 10, retention: { retention5y: 0.7, byAge: null, slopePerYear: null } }, [], 2026);
    expect(r?.retention5y).toBe(0.7);
  });
});

describe("dealRowOf", () => {
  it("shows the quote's own loan", () => {
    const r = dealRowOf(quote(), terms, null);
    expect(r.outTheDoor).toBe(32000);
    expect(r.monthly).toBeGreaterThan(500);
    expect(r.monthly).toBeLessThan(600);
    expect(r.basis).toBe("typical");
  });
  it("prefers the stated payment", () => {
    expect(dealRowOf(quote({ statedMonthly: 555 }), terms, null).monthly).toBe(555);
  });
  it("keeps the numbers it has when the quote is incomplete", () => {
    expect(dealRowOf(emptyQuote(), terms, null)).toEqual({ monthly: null, outTheDoor: null, equityMonth: null, basis: null });
  });
});

describe("vsDealLine", () => {
  const ok = (m: number | null, e: number | null) =>
    ({
      ok: true,
      addedTax: null,
      rows: [
        { label: "Monthly payment", quote: 0, pick: 0, difference: m },
        { label: "Out the door (est.)", quote: 0, pick: 0, difference: 0 },
        { label: "Positive equity by month", quote: 0, pick: 0, difference: e },
      ],
    }) as ReturnType<typeof headsUp>;
  it("says less and sooner when the pick is cheaper and builds equity earlier", () => {
    expect(vsDealLine(ok(42.4, 6))).toBe("vs your deal, on the same terms: $42/mo less · equity 6 months sooner");
  });
  it("says more and later the other way", () => {
    expect(vsDealLine(ok(-100, -1))).toBe("vs your deal, on the same terms: $100/mo more · equity 1 month later");
  });
  it("says nothing when fields are missing", () => {
    expect(vsDealLine({ ok: false, missing: ["the APR"] })).toBeNull();
    expect(vsDealLine(ok(null, null))).toBeNull();
  });
  it("calls an even month the same", () => {
    expect(vsDealLine(ok(0.2, 0))).toBe("vs your deal, on the same terms: same monthly · equity at the same time");
  });
});
