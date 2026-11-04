import { beforeEach, describe, expect, it, vi } from "vitest";

import { RANK_FIXTURES } from "./fixtures";
import { ownershipMath } from "./ownership";

// Task 049: the search route replaces the chat fast path. These tests port
// the fast path's cases (same inputs, same numbers) with invented stock.
vi.mock("./fred", async (orig) => ({
  ...(await orig<typeof import("./fred")>()),
  getDefaultApr: vi.fn(async () => ({ aprPercent: 7.54, dateIso: "2026-08-01", assumed: false })),
}));
vi.mock("./table", async (orig) => ({
  ...(await orig<typeof import("./table")>()),
  getTable: vi.fn(async () => {
    throw new Error("no table in tests");
  }),
}));
vi.mock("./tools", async (orig) => {
  const real = await orig<typeof import("./tools")>();
  return { ...real, executeRankCategory: vi.fn(), executeLocalUnits: vi.fn() };
});

const tools = await import("./tools");
const { downForPrice, requestFromParams, runSearch, searchParamsSchema } = await import("./searchRun");

const sedan = RANK_FIXTURES.Sedan;
const pick = (p: (typeof sedan.picks)[number]) => ({ ...p, typicalNewPrice: p.price, mpg: 32, tradeInFactor: 0.85 });
const rank = {
  category: "Sedan",
  picks: sedan.picks.map(pick),
  commodity: { ...pick(sedan.commodity), flag: sedan.commodity.flag },
};

function local(model: string, price: number) {
  return {
    zip: "30263",
    model,
    providerModel: model,
    make: null,
    category: "Sedan",
    recommendedTrim: null,
    baseTrim: null,
    trimUsed: null,
    fellBackToBase: false,
    units: [{ dealer: "Invented Motors", distanceMiles: 12.4, price, url: `https://example.test/${encodeURIComponent(model)}` }],
    unitsFound: 1,
    totalFound: 9,
    bestPrice: price,
    bestDealer: "Invented Motors",
    radiusUsed: 50,
    widened: false,
    error: null,
    fuel: null,
  };
}

beforeEach(() => {
  vi.mocked(tools.executeRankCategory).mockResolvedValue(rank as never);
  vi.mocked(tools.executeLocalUnits).mockImplementation(async ({ model }) => {
    const p = rank.picks.find((x) => x.model === model)!;
    return local(model!, p.price - 500) as never;
  });
});

describe("search parameters", () => {
  it("accepts a ZIP and a type, with every setting optional", () => {
    const ok = searchParamsSchema.safeParse({ zip: "30263", type: "sedan" });
    expect(ok.success).toBe(true);
    const full = searchParamsSchema.safeParse({ zip: "30263", type: "suv", downPct: "20", apr: "5.9", term: "72" });
    expect(full.success && full.data).toEqual({ zip: "30263", type: "suv", downPct: 20, apr: 5.9, term: 72 });
  });

  it.each([
    [{ zip: "3026", type: "sedan" }],
    [{ zip: "30263", type: "electric" }],
    [{ zip: "30263", type: "sedan", term: "61" }],
    [{ zip: "30263", type: "sedan", apr: "31" }],
    [{ zip: "30263", type: "sedan", downPct: "101" }],
    [{ zip: "30263", type: "sedan", down: "-1" }],
    [{ zip: "30263", type: "sedan", down: "5000", downPct: "10" }],
  ])("rejects %j", (params) => {
    expect(searchParamsSchema.safeParse(params).success).toBe(false);
  });

  it("maps a type to its lineup and defaults to 10% down over 60 months", () => {
    const req = requestFromParams({ zip: "30263", type: "hybrid" });
    expect(req).toEqual({ zip: "30263", category: "Hybrid", userApr: null, downFixed: null, downPercent: null, termMonths: 60 });
    expect(downForPrice(req, 27_000)).toBeCloseTo(2_700);
    expect(downForPrice({ downFixed: 5000, downPercent: null }, 27_000)).toBe(5000);
    expect(downForPrice({ downFixed: null, downPercent: 25 }, 27_000)).toBe(6750);
  });
});

describe("runSearch (the fast path, without chat)", () => {
  it("prices every pick on the cheapest local unit, as the fast path did", async () => {
    const out = await runSearch(requestFromParams({ zip: "30263", type: "sedan" }));
    // The commodity pick is already in the four, so it is badged, not added.
    expect(out.shown.map((p) => p.model)).toEqual(sedan.picks.map((p) => p.model));
    for (let i = 0; i < out.shown.length; i += 1) {
      const p = out.shown[i]!;
      const price = p.price - 500;
      const want = ownershipMath({ price, tax: 0, down: price * 0.1, apr: 7.54, term: 60, retention5y: p.retention5y });
      expect(out.ownerships[i]!.price).toBe(price);
      expect(out.ownerships[i]!.monthlyPayment).toBeCloseTo(want.monthlyPayment, 6);
    }
    expect(out.aprPercent).toBe(7.54);
    expect(out.aprLabel).toMatch(/^7\.54% APR/);
    // Every card spec passed the number guard.
    expect(out.cards.map((c) => c.model)).toEqual(out.shown.map((p) => p.model));
    expect(out.compare).not.toBeNull();
  });

  it("re-prices with the shopper's down payment, rate and term", async () => {
    const base = await runSearch(requestFromParams({ zip: "30263", type: "sedan" }));
    const mine = await runSearch(requestFromParams({ zip: "30263", type: "sedan", down: 5000, apr: 5.9, term: 72 }));
    expect(tools.executeLocalUnits).toHaveBeenCalled();
    const p = mine.shown[0]!;
    const price = p.price - 500;
    const want = ownershipMath({ price, tax: 0, down: 5000, apr: 5.9, term: 72, retention5y: p.retention5y });
    expect(mine.ownerships[0]!.monthlyPayment).toBeCloseTo(want.monthlyPayment, 6);
    expect(mine.ownerships[0]!.termMonths).toBe(72);
    expect(mine.downRule).toEqual({ kind: "amount", usd: 5000 });
    expect(mine.aprLabel).toBeNull();
    expect(mine.ownerships[0]!.monthlyPayment).not.toBeCloseTo(base.ownerships[0]!.monthlyPayment, 0);
  });

  it("adds the commodity pick as an extra card when it is not among the four", async () => {
    const extra = { ...pick({ ...sedan.picks[3]!, model: "Invented Saver", make: "Invented" }), flag: "extra" as const };
    vi.mocked(tools.executeRankCategory).mockResolvedValue({ ...rank, commodity: extra } as never);
    vi.mocked(tools.executeLocalUnits).mockImplementation(async ({ model }) => local(model!, 22_000) as never);
    const out = await runSearch(requestFromParams({ zip: "30263", type: "sedan", downPct: 20 }));
    expect(out.shown.map((p) => p.model).at(-1)).toBe("Invented Saver");
    expect(out.downRule).toEqual({ kind: "share", share: 0.2 });
    expect(out.ownerships.at(-1)!.downPayment).toBeCloseTo(4_400);
  });
});
