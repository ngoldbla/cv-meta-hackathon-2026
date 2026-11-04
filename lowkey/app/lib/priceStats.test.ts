import { describe, expect, it } from "vitest";

import { checkFarLeads, checkPriceStripSpec } from "./render/guard";
import { buildPriceStripSpec, type SpecEntry } from "./render/specs";
import {
  farLeads,
  farMargin,
  mapStatsResponse,
  positionOf,
  priceFacts,
  priceSentence,
  rowPriceLine,
  statsUrl,
  type MarketStats,
  type PriceContext,
} from "./priceStats";
import { parseView, carPath, listingPath, quotePath, resultsPath, searchApiQuery, viewQuery, withChoice, type View } from "./routes";

// Task 054. Invented figures only.
const market: MarketStats = { count: 79, p5: 27_800, p25: 28_400, median: 29_000, p75: 29_400, p95: 30_100, msrpMedian: 27_900 };

const ctx = (over: Partial<PriceContext> = {}): PriceContext => ({
  make: "Honda",
  model: "Civic Sedan",
  trim: "Sport",
  year: 2026,
  radius: 50,
  local: market,
  national: { ...market, count: 4_450, median: 28_500 },
  unit: { vin: "2HGTEST0000000001", listedPrice: 27_820, msrp: 29_870 },
  ...over,
});

describe("stats responses", () => {
  it("reads the year's percentiles and median MSRP, rounded to whole dollars", () => {
    const body = {
      data: {
        total: 4450,
        facets: {
          year: [
            {
              value: "2026",
              count: 4450,
              metrics: {
                "price.p5": { value: 27164.113 },
                "price.p25": { value: 28020.5 },
                "price.median": { value: 28498.451 },
                "price.p75": { value: 29092.83 },
                "price.p95": { value: 30911.62 },
                "msrp.median": { value: 27890 },
              },
            },
          ],
        },
      },
    };
    expect(mapStatsResponse(body, 2026)).toEqual({
      count: 4450,
      p5: 27164,
      p25: 28021,
      median: 28498,
      p75: 29093,
      p95: 30912,
      msrpMedian: 27890,
    });
  });

  it("keeps nulls below ten listings, and zero for a year with none", () => {
    const thin = { data: { facets: { year: [{ value: "2026", count: 6, metrics: { "price.median": { value: null, null_reason: "insufficient_sample" } } }] } } };
    expect(mapStatsResponse(thin, 2026)).toEqual({ count: 6, p5: null, p25: null, median: null, p75: null, p95: null, msrpMedian: null });
    expect(mapStatsResponse({ data: { facets: { year: [] } } }, 2026).count).toBe(0);
  });

  it("asks for one year bucket, local with a ZIP and radius, national with neither", () => {
    const q = { providerModel: "Civic Sedan", trim: "Sport", year: 2026, category: "Sedan" as const };
    const local = new URL(statsUrl("https://p.test/v1", { ...q, zip: "30263", radius: 50 }));
    const national = new URL(statsUrl("https://p.test/v1", q));
    expect(local.searchParams.get("facets")).toBe("year");
    expect(local.searchParams.get("metrics")).toBe("price.p5,price.p25,price.median,price.p75,price.p95,msrp.median");
    expect(local.searchParams.get("postal_code")).toBe("30263");
    expect(local.searchParams.get("radius")).toBe("50");
    expect(national.searchParams.has("postal_code")).toBe(false);
    expect(national.searchParams.has("radius")).toBe(false);
    for (const u of [local, national]) {
      expect(u.searchParams.get("model")).toBe("Civic Sedan");
      expect(u.searchParams.get("trim")).toBe("Sport");
      expect(u.searchParams.get("year")).toBe("2026");
      expect(u.searchParams.get("inventory_type")).toBe("new");
    }
  });
});

describe("percentile position", () => {
  it.each([
    [27_700, { side: "lower", share: 0.9 }],
    [28_000, { side: "lower", share: 0.75 }],
    [28_900, { side: "lower", share: 0.5 }],
    [29_000, { side: "at", share: null }],
    [29_200, { side: "higher", share: 0.5 }],
    [29_500, { side: "higher", share: 0.75 }],
    [30_200, { side: "higher", share: 0.9 }],
  ])("places %d", (price, want) => {
    expect(positionOf(price, market)).toEqual(want);
  });

  it("claims only what the percentiles prove", () => {
    // At p5 exactly, it is not below p5: only "lower than 3 in 4".
    expect(positionOf(27_800, market)).toEqual({ side: "lower", share: 0.75 });
    // Without p5, a very low price is still only "lower than 3 in 4".
    expect(positionOf(20_000, { ...market, p5: null })).toEqual({ side: "lower", share: 0.75 });
    expect(positionOf(28_000, { ...market, median: null })).toBeNull();
  });
});

describe("under or over the median and MSRP", () => {
  it("computes every difference from the listed price", () => {
    expect(priceFacts(ctx())).toEqual({
      listed: 27_820,
      vsLocalMedian: -1_180,
      vsNationalMedian: -680,
      msrp: 29_870,
      msrpOwn: true,
      vsMsrp: -2_050,
      position: { side: "lower", share: 0.75 },
    });
  });

  it("uses the trim's median MSRP when the listing has none, and says over when over", () => {
    const f = priceFacts(ctx({ unit: { vin: null, listedPrice: 29_300, msrp: null } }));
    expect(f.msrp).toBe(27_900);
    expect(f.msrpOwn).toBe(false);
    expect(f.vsLocalMedian).toBe(300);
    expect(f.vsMsrp).toBe(1_400);
  });

  it("leaves a figure out when its stats are missing", () => {
    const none = priceFacts(ctx({ local: null, national: null, unit: { vin: null, listedPrice: 27_820, msrp: null } }));
    expect(none).toEqual({ listed: 27_820, vsLocalMedian: null, vsNationalMedian: null, msrp: null, msrpOwn: false, vsMsrp: null, position: null });
    const unpriced = priceFacts(ctx({ unit: { vin: null, listedPrice: null, msrp: 29_870 } }));
    expect(unpriced.vsLocalMedian).toBeNull();
    expect(unpriced.vsMsrp).toBeNull();
  });
});

describe("the plain sentence and the row line", () => {
  const sentence = (c: PriceContext) =>
    priceSentence({
      title: "2026 Civic Sedan Sport",
      radius: c.radius,
      localLoaded: c.local !== null,
      localCount: c.local?.count ?? null,
      facts: priceFacts(c),
    });

  it("says where the price sits, in figures from code", () => {
    expect(sentence(ctx())).toBe(
      "$1,180 under the local median for a 2026 Civic Sedan Sport, and $2,050 under its MSRP. Lower than 3 in 4 listed within 50 miles.",
    );
    expect(rowPriceLine(-1180)).toBe("$1,180 under the local median");
    expect(rowPriceLine(300)).toBe("$300 over the local median");
    expect(rowPriceLine(0)).toBe("at the local median");
    expect(rowPriceLine(null)).toBeNull();
  });

  it("says what is missing instead of a figure", () => {
    const thin = ctx({ local: { count: 6, p5: null, p25: null, median: null, p75: null, p95: null, msrpMedian: null } });
    expect(sentence(thin)).toBe("Too few listed within 50 miles for a local median (6 listed). $2,050 under its MSRP.");
    expect(sentence(ctx({ local: null, national: null, unit: { vin: null, listedPrice: 27_820, msrp: null } }))).toBe(
      "Local prices couldn't be loaded just now. No MSRP on record for this car.",
    );
    expect(sentence(ctx({ unit: { vin: null, listedPrice: null, msrp: null } }))).toMatch(/no listed price/);
  });

  it("stays calm: no urgency, exclamation marks or ranking words", () => {
    const all = [sentence(ctx()), sentence(ctx({ unit: { vin: null, listedPrice: 31_000, msrp: null } }))].join(" ");
    expect(all).not.toMatch(/!|great|deal|best|top|#1|hurry|now only/i);
  });
});

describe("far-away margin rule", () => {
  it("needs the larger of $750 and 3% below the best local price", () => {
    expect(farMargin(20_000)).toBe(750);
    expect(farMargin(27_829)).toBe(835);
    expect(farMargin(40_000)).toBe(1_200);
  });

  it("keeps up to three units beyond the radius that beat the margin, cheapest first", () => {
    const u = (price: number, distanceMiles: number, vin: string) => ({ price, distanceMiles, vin });
    const leads = farLeads(
      [
        u(26_995, 400, "A"), // saves 834: one dollar short of 835
        u(26_994, 400, "B"), // saves 835: in
        u(25_660, 690, "C"),
        u(25_000, 40, "D"), // inside the radius: local, not far away
        u(25_100, 300, "E"), // already in local stock
        u(25_900, 380, "F"),
        u(26_100, 470, "G"),
      ],
      27_829,
      50,
      ["E"],
    );
    expect(leads.map((l) => l.vin)).toEqual(["C", "F", "G"]);
    expect(leads.map((l) => l.saves)).toEqual([2_169, 1_929, 1_729]);
    expect(farLeads([u(26_994, 400, "B")], 27_829, 50)[0]!.saves).toBe(835);
    expect(farLeads([u(26_995, 400, "A")], 27_829, 50)).toEqual([]);
  });

  it("guard: drops a lead whose saving or margin doesn't recompute", () => {
    const good = { price: 25_660, distanceMiles: 690, saves: 2_169 };
    expect(checkFarLeads([good], 27_829, 50, 835)).toEqual([good]);
    expect(checkFarLeads([{ ...good, saves: 2_500 }], 27_829, 50, 835)).toEqual([]);
    expect(checkFarLeads([{ ...good, distanceMiles: 20 }], 27_829, 50, 835)).toEqual([]);
    expect(checkFarLeads([good], 27_829, 50, 500)).toEqual([]);
  });
});

describe("price strip spec and guard", () => {
  const entry = (c: PriceContext): SpecEntry => ({
    pick: { rank: 2, make: "Honda", model: "Civic Sedan", price: 28_180, depPerMonth: 163, retention5y: 0.65 },
    context: c,
  });
  const unit = { vin: "2HGTEST0000000001", year: 2026, listedPrice: 27_820, msrp: 29_870 };

  it("passes the guard as built, and copies every stat exactly", () => {
    const e = entry(ctx());
    const spec = buildPriceStripSpec(e, unit)!;
    expect(checkPriceStripSpec(spec, e, unit)).toEqual({ ok: true, failures: [] });
    expect(spec.elements.strip!.props).toMatchObject({
      low: 27_800,
      p25: 28_400,
      localMedian: 29_000,
      p75: 29_400,
      high: 30_100,
      nationalMedian: 28_500,
      msrp: 29_870,
      listed: 27_820,
      vsLocalMedian: -1_180,
      vsMsrp: -2_050,
      positionSide: "lower",
      positionShare: 0.75,
    });
  });

  it("fails on any changed figure", () => {
    const e = entry(ctx());
    for (const key of ["low", "localMedian", "nationalMedian", "msrp", "listed", "vsLocalMedian", "vsMsrp", "positionShare"]) {
      const spec = buildPriceStripSpec(e, unit)!;
      (spec.elements.strip!.props as Record<string, number>)[key] += 1;
      expect(checkPriceStripSpec(spec, e, unit).ok, key).toBe(false);
    }
  });

  it("makes no comparison for a unit of another model year", () => {
    const e = entry(ctx());
    const other = { ...unit, year: 2025 };
    const spec = buildPriceStripSpec(e, other)!;
    expect(spec.elements.strip!.props).toMatchObject({ sameYear: false, listed: null, vsLocalMedian: null, positionSide: null });
    expect(checkPriceStripSpec(spec, e, other).ok).toBe(true);
  });

  it("is absent without a context", () => {
    expect(buildPriceStripSpec({ pick: entry(ctx()).pick }, unit)).toBeNull();
  });
});

describe("URL round trips with unit (task 054)", () => {
  const base: View = { zip: "30263", terms: { down: null, downPct: null, apr: null, term: null }, sort: "real" };
  const vin = "2HGFE2F51TH583089";
  const chosen = withChoice(base, { car: "honda-civic-sedan", unit: vin });

  it("is a bare unit on the car's own screens and car plus unit elsewhere", () => {
    expect(carPath("sedan", "honda-civic-sedan", chosen)).toBe(`/sedan/honda-civic-sedan?zip=30263&unit=${vin}`);
    expect(listingPath("sedan", "honda-civic-sedan", 2, chosen)).toBe(`/sedan/honda-civic-sedan/listing/2?zip=30263&unit=${vin}`);
    expect(listingPath("sedan", "honda-civic-sedan", vin, chosen)).toBe(`/sedan/honda-civic-sedan/listing/${vin}?zip=30263&unit=${vin}`);
    expect(resultsPath("sedan", chosen)).toBe(`/sedan?zip=30263&car=honda-civic-sedan&unit=${vin}`);
    expect(carPath("sedan", "honda-accord-sedan", chosen)).toBe(`/sedan/honda-accord-sedan?zip=30263&car=honda-civic-sedan&unit=${vin}`);
    expect(searchApiQuery("sedan", chosen)).toBe(`/api/search?zip=30263&type=sedan&car=honda-civic-sedan&unit=${vin}`);
  });

  it("parses back to the same view on every screen", () => {
    expect(parseView(`?zip=30263&unit=${vin}`, "honda-civic-sedan")).toEqual(chosen);
    expect(parseView(`?zip=30263&car=honda-civic-sedan&unit=${vin}`)).toEqual(chosen);
    // Another car's screen keeps the choice for the car it belongs to.
    expect(parseView(`?zip=30263&car=honda-civic-sedan&unit=${vin}`, "honda-accord-sedan")).toEqual(chosen);
    expect(parseView(viewQuery(chosen, {}, "honda-civic-sedan"), "honda-civic-sedan")).toEqual(chosen);
  });

  it("ignores a bad VIN, and clearing the choice goes back to the plain view", () => {
    expect(parseView("?zip=30263&unit=NOTAVIN", "honda-civic-sedan")).toEqual(base);
    expect(parseView(`?zip=30263&unit=${vin}`)).toEqual(base); // no car to belong to
    expect(withChoice(chosen, null)).toEqual(base);
    expect(carPath("sedan", "honda-civic-sedan", withChoice(chosen, null))).toBe("/sedan/honda-civic-sedan?zip=30263");
  });

  it("carries the choice into Check a quote for that car only", () => {
    expect(quotePath({ type: "sedan", view: chosen, car: "honda-civic-sedan" })).toBe(
      `/quote?zip=30263&type=sedan&car=honda-civic-sedan&unit=${vin}`,
    );
    expect(quotePath({ type: "sedan", view: chosen, car: "honda-accord-sedan" })).toBe(
      "/quote?zip=30263&type=sedan&car=honda-accord-sedan",
    );
    expect(quotePath({ type: "sedan", view: chosen })).toBe(`/quote?zip=30263&type=sedan&car=honda-civic-sedan&unit=${vin}`);
    expect(parseView(`?zip=30263&type=sedan&car=honda-civic-sedan&unit=${vin}`)?.choice).toEqual({ car: "honda-civic-sedan", unit: vin });
  });
});

describe("URL round trips with years (task 054)", () => {
  const base: View = { zip: "30263", terms: { down: null, downPct: null, apr: null, term: null }, sort: "real" };
  it("keeps each car's newest year by default and carries years=all everywhere", async () => {
    const { withYears, fartherApiQuery } = await import("./routes");
    const all = withYears(base, true);
    expect(resultsPath("sedan", base)).toBe("/sedan?zip=30263");
    expect(resultsPath("sedan", all)).toBe("/sedan?zip=30263&years=all");
    expect(carPath("sedan", "toyota-corolla", all)).toBe("/sedan/toyota-corolla?zip=30263&years=all");
    expect(searchApiQuery("sedan", all)).toBe("/api/search?zip=30263&type=sedan&years=all");
    expect(fartherApiQuery("sedan", "toyota-corolla", "30263", true)).toBe("/api/farther?zip=30263&type=sedan&car=toyota-corolla&years=all");
    expect(parseView("?zip=30263&years=all")).toEqual(all);
    expect(parseView("?zip=30263&years=old")).toEqual(base);
    expect(withYears(all, false)).toEqual(base);
  });
});
