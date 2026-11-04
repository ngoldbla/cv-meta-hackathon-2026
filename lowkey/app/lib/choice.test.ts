import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RANK_FIXTURES } from "./fixtures";
import { ownershipMath } from "./ownership";

// Task 054: price context per pick, the provider-call budget, and the
// unit the shopper is going for. Invented stock and stats throughout.
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
  return { ...real, executeRankCategory: vi.fn(), executeLocalUnits: vi.fn(), executeFarther: vi.fn() };
});

const tools = await import("./tools");
const { requestFromParams, runSearch } = await import("./searchRun");
const { checkCostCompareSpec, checkPickCardSpec, checkPriceStripSpec } = await import("./render/guard");
const { buildPriceStripSpec, pickSlug, pricedUnitOf, stripUnitOf } = await import("./render/specs");
const { carsOf } = await import("./resultView");

const sedan = RANK_FIXTURES.Sedan;
const pick = (p: (typeof sedan.picks)[number]) => ({ ...p, typicalNewPrice: p.price, mpg: 32, tradeInFactor: 0.85 });
const rank = { category: "Sedan", picks: sedan.picks.map(pick), commodity: { ...pick(sedan.commodity), flag: sedan.commodity.flag } };

const vin = (n: number) => `1HGTEST0${String(n).padStart(9, "0")}`;

function unit(model: string, price: number, n: number, extra: Record<string, unknown> = {}) {
  return {
    dealer: "Invented Motors",
    distanceMiles: 12.4,
    price,
    listedPrice: price,
    msrp: price + 1500,
    year: 2026,
    trim: "Sport",
    vin: vin(n),
    url: `https://example.test/${encodeURIComponent(model)}/${n}`,
    city: "Newnan",
    state: "GA",
    ...extra,
  };
}

function local(model: string, price: number) {
  const units = [unit(model, price, 1), unit(model, price + 400, 2), unit(model, price + 900, 3)];
  return {
    zip: "30263",
    model,
    providerModel: model,
    make: null,
    category: "Sedan",
    recommendedTrim: "Sport",
    baseTrim: "LX",
    trimUsed: "Sport",
    fellBackToBase: false,
    units,
    unitsFound: 3,
    totalFound: 9,
    bestPrice: price,
    bestDealer: "Invented Motors",
    radiusUsed: 50,
    widened: false,
    error: null,
    fuel: null,
  };
}

const priceOf = (model: string) => rank.picks.find((x) => x.model === model)!.price - 500;
const civic = rank.picks.find((p) => p.model === "Civic Sedan")!;
const civicSlug = pickSlug(civic);

/** Invented market stats; the national market has a lower median. */
function statsBody(url: URL) {
  const local = url.searchParams.has("postal_code");
  const base = priceOf(url.searchParams.get("model")!);
  const m = (d: number) => ({ value: base + d + (local ? 0 : -300.4) });
  return {
    data: {
      total: local ? 40 : 2000,
      facets: {
        year: [
          {
            value: url.searchParams.get("year"),
            count: local ? 40 : 2000,
            metrics: {
              "price.p5": m(-200),
              "price.p25": m(400),
              "price.median": m(1200),
              "price.p75": m(1800),
              "price.p95": m(2600),
              "msrp.median": { value: base + 1500 },
            },
          },
        ],
      },
      range_facets: {},
      stats: {},
    },
  };
}

let calls: URL[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  calls = [];
  vi.stubEnv("LOWKEY_PROVIDER_BASE_URL", "https://provider.test/v1");
  vi.stubEnv("LOWKEY_PROVIDER_KEY", "test-key-not-real");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (raw: string) => {
      const url = new URL(raw);
      calls.push(url);
      if (url.pathname.endsWith("/facets")) return { ok: true, status: 200, json: async () => statsBody(url) };
      return { ok: false, status: 500, json: async () => ({}) };
    }),
  );
  vi.mocked(tools.executeRankCategory).mockResolvedValue(rank as never);
  vi.mocked(tools.executeLocalUnits).mockImplementation(async ({ model }) => local(model!, priceOf(model!)) as never);
  vi.mocked(tools.executeFarther).mockImplementation(async ({ model }) => {
    const best = priceOf(model);
    const lead = { ...unit(model, best - 2000, 7, { distanceMiles: 690, city: "Katy", state: "TX" }), saves: 2000 };
    return { bestLocal: best, margin: 840, radius: 50, year: 2026, trim: "Sport", leads: [lead], searched: 20, error: null, calls: 1 } as never;
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const facetCalls = () => calls.filter((u) => u.pathname.endsWith("/facets"));

describe("provider-call budget per search (task 054)", () => {
  it("makes at most two stats calls per pick (local and national) and no far-away call", async () => {
    const out = await runSearch(requestFromParams({ zip: "30263", type: "sedan" }));
    const perModel = new Map<string, URL[]>();
    for (const u of facetCalls()) perModel.set(u.searchParams.get("model")!, [...(perModel.get(u.searchParams.get("model")!) ?? []), u]);
    expect([...perModel.keys()].sort()).toEqual(out.shown.map((p) => p.model).sort());
    for (const [, urls] of perModel) {
      expect(urls).toHaveLength(2);
      const [a, b] = urls;
      expect(a!.searchParams.get("postal_code")).toBe("30263");
      expect(a!.searchParams.get("radius")).toBe("50");
      expect(b!.searchParams.has("postal_code")).toBe(false);
      expect(b!.searchParams.has("radius")).toBe(false);
      // Same model, trim and year as the priced unit.
      for (const u of urls) {
        expect(u.searchParams.get("trim")).toBe("Sport");
        expect(u.searchParams.get("year")).toBe("2026");
      }
    }
    expect(out.calls).toEqual({ stats: 2 * out.shown.length, far: 0 });
    expect(tools.executeFarther).not.toHaveBeenCalled();
  });

  it("spends the one far-away call only for a chosen far-away unit, and still two stats calls for that pick", async () => {
    const out = await runSearch(requestFromParams({ zip: "30263", type: "sedan", car: civicSlug, unit: vin(7) }));
    expect(tools.executeFarther).toHaveBeenCalledTimes(1);
    expect(out.calls).toEqual({ stats: 2 * out.shown.length, far: 1 });
    expect(facetCalls().filter((u) => u.searchParams.get("model") === "Civic Sedan")).toHaveLength(2);
  });

  it("makes no far-away call for a chosen local unit", async () => {
    const out = await runSearch(requestFromParams({ zip: "30263", type: "sedan", car: civicSlug, unit: vin(2) }));
    expect(tools.executeFarther).not.toHaveBeenCalled();
    expect(out.calls.far).toBe(0);
  });
});

describe("price context in the search (task 054)", () => {
  it("rounds the stats to whole dollars and places the cheapest unit", async () => {
    const out = await runSearch(requestFromParams({ zip: "30263", type: "sedan" }));
    const i = out.shown.findIndex((p) => p.model === "Civic Sedan");
    const ctx = out.contexts[i]!;
    const base = priceOf("Civic Sedan");
    expect(ctx.local!.median).toBe(base + 1200);
    expect(ctx.national!.median).toBe(Math.round(base + 1200 - 300.4));
    expect(ctx.unit).toEqual({ vin: vin(1), listedPrice: base, msrp: base + 1500 });
    const row = (out.compare!.elements.compare!.props as { rows: { model: string; vsLocalMedian: number }[] }).rows.find(
      (r) => r.model === "Civic Sedan",
    )!;
    expect(row.vsLocalMedian).toBe(-1200);
    expect(checkCostCompareSpec(out.compare!, carsOf(out).map((c) => c.entry)).ok).toBe(true);
  });

  it("keeps a figure out when its stats are missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })),
    );
    const out = await runSearch(requestFromParams({ zip: "30263", type: "sedan" }));
    expect(out.contexts.every((c) => c && c.local === null && c.national === null)).toBe(true);
    const rows = (out.compare!.elements.compare!.props as { rows: { vsLocalMedian: number | null }[] }).rows;
    expect(rows.every((r) => r.vsLocalMedian === null)).toBe(true);
  });
});

describe("choosing the unit you're going for (task 054)", () => {
  it("re-prices that car from the unit's own price on the same terms, and only that car", async () => {
    const terms = { zip: "30263", type: "sedan" as const, downPct: 20, apr: 5.9, term: 72 as const };
    const base = await runSearch(requestFromParams(terms));
    const mine = await runSearch(requestFromParams({ ...terms, car: civicSlug, unit: vin(3) }));
    const i = mine.shown.findIndex((p) => p.model === "Civic Sedan");
    const price = priceOf("Civic Sedan") + 900;
    const want = ownershipMath({ price, tax: 0, down: price * 0.2, apr: 5.9, term: 72, retention5y: civic.retention5y });
    const own = mine.ownerships[i]!;
    expect(own.price).toBe(price);
    expect(own.priceSource).toBe("chosen");
    expect(own.downPayment).toBeCloseTo(price * 0.2, 6);
    expect(own.aprPercent).toBe(5.9);
    expect(own.termMonths).toBe(72);
    expect(own.monthlyPayment).toBeCloseTo(want.monthlyPayment, 6);
    expect(own.positiveEquityMonth).toBe(want.positiveEquityMonth);
    expect(own.curve).toEqual(want.curve);
    // Every other car is unchanged.
    mine.ownerships.forEach((o, j) => {
      if (j !== i) expect(o.monthlyPayment).toBe(base.ownerships[j]!.monthlyPayment);
    });
    expect(mine.choice).toMatchObject({ model: "Civic Sedan", vin: vin(3), source: "local" });
    // Guard-checked: every card and the chooser pass on the re-priced entries.
    const entries = carsOf(mine).map((c) => c.entry);
    expect(mine.cards).toHaveLength(mine.shown.length);
    for (const e of entries) expect(checkPickCardSpec(mine.cards.find((c) => c.model === e.pick.model)!.spec, e).ok).toBe(true);
    expect(checkCostCompareSpec(mine.compare!, entries).ok).toBe(true);
    const rows = (mine.compare!.elements.compare!.props as { rows: { model: string; chosen: boolean }[] }).rows;
    expect(rows.find((r) => r.model === "Civic Sedan")!.chosen).toBe(true);
    expect(rows.filter((r) => r.chosen)).toHaveLength(1);
  });

  it("prices on a far-away unit and marks the strip at its price", async () => {
    const out = await runSearch(requestFromParams({ zip: "30263", type: "sedan", car: civicSlug, unit: vin(7) }));
    const car = carsOf(out).find((c) => c.slug === civicSlug)!;
    expect(car.ownership!.price).toBe(priceOf("Civic Sedan") - 2000);
    expect(out.choice!.source).toBe("far");
    const priced = pricedUnitOf(car.entry)!;
    expect(priced.vin).toBe(vin(7));
    const spec = buildPriceStripSpec(car.entry, stripUnitOf(priced))!;
    expect(checkPriceStripSpec(spec, car.entry, stripUnitOf(priced)).ok).toBe(true);
    expect((spec.elements.strip!.props as { listed: number }).listed).toBe(priceOf("Civic Sedan") - 2000);
  });

  it("falls back to the cheapest local unit when the chosen one is gone, and says so", async () => {
    const out = await runSearch(requestFromParams({ zip: "30263", type: "sedan", car: civicSlug, unit: "1HGTEST0999999999" }));
    expect(out.choice).toBeNull();
    expect(out.choiceMissing).toBe(true);
    const i = out.shown.findIndex((p) => p.model === "Civic Sedan");
    expect(out.ownerships[i]!.price).toBe(priceOf("Civic Sedan"));
    expect(out.ownerships[i]!.priceSource).toBe("local");
  });

  it("takes car and unit only together", async () => {
    const { searchParamsSchema } = await import("./searchRun");
    expect(searchParamsSchema.safeParse({ zip: "30263", type: "sedan", unit: vin(1) }).success).toBe(false);
    expect(searchParamsSchema.safeParse({ zip: "30263", type: "sedan", car: civicSlug }).success).toBe(false);
    expect(searchParamsSchema.safeParse({ zip: "30263", type: "sedan", car: civicSlug, unit: "NOT-A-VIN" }).success).toBe(false);
    expect(searchParamsSchema.safeParse({ zip: "30263", type: "sedan", car: civicSlug, unit: vin(1) }).success).toBe(true);
  });
});
