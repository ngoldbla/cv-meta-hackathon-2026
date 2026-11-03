import { describe, expect, it } from "vitest";

import {
  fetchLocalUnits,
  fetchUnitsWithTrimFallback,
  listingsUrl,
  mapListingsResponse,
  type ListingsFetcher,
} from "./listings";

/** Fixture provider rows (no live calls). Shapes mirror P8 listings. */
function row(over: Record<string, unknown> = {}) {
  return {
    year: 2026,
    make: "Honda",
    model: "CR-V",
    trim: "LX",
    price: 35000,
    price_with_fees: 34500,
    selected_price: 34500,
    dealer_name: "Fixture Motors",
    distance_miles: 5.1,
    days_on_market: 12,
    vdp_url: "https://example.com/fixture/crv-1",
    ...over,
  };
}

function body(rows: unknown[], total?: number) {
  return {
    data: rows,
    pagination: { limit: 3, offset: 0, total: total ?? rows.length },
  };
}

function okJson(payload: unknown): ListingsFetcher {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => payload,
  });
}

describe("mapListingsResponse (task 027 part 3)", () => {
  it("maps only the fields the card needs, cheapest first", () => {
    const { units, total } = mapListingsResponse(
      body([
        row({ price_with_fees: 36000, vdp_url: "https://example.com/fixture/crv-2" }),
        row({ price_with_fees: 34500 }),
      ]),
      "60614",
    );
    expect(total).toBe(2);
    expect(units).toHaveLength(2);
    expect(units[0]).toEqual({
      price: 34500,
      dealer: "Fixture Motors",
      distanceMiles: 5.1,
      daysOnLot: 12,
      year: 2026,
      trim: "LX",
      url: "https://example.com/fixture/crv-1",
    });
    expect(units[0].price).toBeLessThan(units[1].price);
  });

  it("falls back to selected_price when price_with_fees is missing", () => {
    const { units } = mapListingsResponse(
      body([row({ price_with_fees: null, selected_price: 33900 })]),
      "60614",
    );
    expect(units[0].price).toBe(33900);
  });

  it("drops rows without a usable price or listing link and caps at 3", () => {
    const rows = [
      row({ price_with_fees: 30000, vdp_url: "https://example.com/fixture/a" }),
      row({ price_with_fees: null, selected_price: null, price: null }),
      row({ price_with_fees: 31000, vdp_url: "" }),
      row({ price_with_fees: 32000, vdp_url: "https://example.com/fixture/b" }),
      row({ price_with_fees: 33000, vdp_url: "https://example.com/fixture/c" }),
      row({ price_with_fees: 34000, vdp_url: "https://example.com/fixture/d" }),
    ];
    const { units } = mapListingsResponse(body(rows, 6), "60614");
    expect(units.map((u) => u.price)).toEqual([30000, 32000, 33000]);
  });
});

describe("fetchLocalUnits radius widening and failures", () => {
  it("widens 50 -> 150 when fewer than 3 are found and says so", async () => {
    const urls: string[] = [];
    const fetcher: ListingsFetcher = async (url) => {
      urls.push(url);
      if (url.includes("radius=50")) {
        return {
          ok: true,
          status: 200,
          json: async () => body([row()], 1),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () =>
          body(
            [
              row(),
              row({ price_with_fees: 35500, vdp_url: "https://example.com/fixture/crv-2" }),
              row({ price_with_fees: 36500, vdp_url: "https://example.com/fixture/crv-3" }),
            ],
            3,
          ),
      };
    };
    const r = await fetchLocalUnits({
      zip: "59001",
      providerModel: "CR-V",
      fetcher,
      baseUrl: "https://provider.example",
      apiKey: "test-key",
    });
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain("radius=50");
    expect(urls[1]).toContain("radius=150");
    expect(urls[0]).toContain("postal_code=59001");
    expect(urls[0]).toContain("fuel_type=Gas+only");
    expect(urls[0]).toContain("exclude_powertrain_type=MHEV%2CHEV");
    expect(r.widened).toBe(true);
    expect(r.radiusUsed).toBe(150);
    expect(r.unitsFound).toBe(3);
    expect(r.bestPrice).toBe(34500);
    expect(r.error).toBeUndefined();
  });

  it("does not widen when 3 or more are found at 50 miles", async () => {
    let calls = 0;
    const fetcher: ListingsFetcher = async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        json: async () =>
          body(
            [
              row(),
              row({ price_with_fees: 35500, vdp_url: "https://example.com/fixture/crv-2" }),
              row({ price_with_fees: 36500, vdp_url: "https://example.com/fixture/crv-3" }),
            ],
            9,
          ),
      };
    };
    const r = await fetchLocalUnits({
      zip: "60614",
      providerModel: "CR-V",
      fetcher,
      baseUrl: "https://provider.example",
      apiKey: "test-key",
    });
    expect(calls).toBe(1);
    expect(r.widened).toBe(false);
    expect(r.radiusUsed).toBe(50);
  });

  it("retries a 429 and recovers", async () => {
    let calls = 0;
    const fetcher: ListingsFetcher = async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: false, status: 429, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => body([row()], 4),
      };
    };
    const r = await fetchLocalUnits({
      zip: "60614",
      providerModel: "CR-V",
      fetcher,
      baseUrl: "https://provider.example",
      apiKey: "test-key",
      retryDelaysMs: [1],
    });
    expect(calls).toBe(2);
    expect(r.error).toBeUndefined();
    expect(r.bestPrice).toBe(34500);
  });

  it("returns the failure card state on HTTP 429, never sample units", async () => {
    const fetcher: ListingsFetcher = async () => ({
      ok: false,
      status: 429,
      json: async () => ({}),
    });
    const r = await fetchLocalUnits({
      zip: "60614",
      providerModel: "CR-V",
      fetcher,
      baseUrl: "https://provider.example",
      apiKey: "test-key",
      retryDelaysMs: [1, 1],
    });
    expect(r.error).toBe("Couldn't load local stock right now");
    expect(r.units).toEqual([]);
    expect(r.unitsFound).toBe(0);
    expect(r.bestPrice).toBeUndefined();
  });

  it("returns the failure card state when the fetch throws (timeout)", async () => {
    const fetcher: ListingsFetcher = async () => {
      throw new Error("The operation timed out");
    };
    const r = await fetchLocalUnits({
      zip: "60614",
      providerModel: "CR-V",
      fetcher,
      baseUrl: "https://provider.example",
      apiKey: "test-key",
    });
    expect(r.error).toBe("Couldn't load local stock right now");
    expect(r.units).toEqual([]);
  });

  it("uses the injected fetcher without any live call on the happy path", async () => {
    const r = await fetchLocalUnits({
      zip: "60614",
      providerModel: "CR-V",
      fetcher: okJson(body([row()])),
      baseUrl: "https://provider.example",
      apiKey: "test-key",
    });
    expect(r.unitsFound).toBe(1);
    expect(r.bestDealer).toBe("Fixture Motors");
  });
});

describe("trim filtering and the no-stock fallback (task 029, part 1)", () => {
  it("adds the trim filter to the search URL only when set", () => {
    expect(
      listingsUrl("https://provider.example", "Corolla", "60614", 50, "SE"),
    ).toContain("trim=SE");
    expect(
      listingsUrl("https://provider.example", "Corolla", "60614", 50),
    ).not.toContain("trim=");
  });

  it("falls back to base when the step-up trim has no stock in 150 miles", async () => {
    const urls: string[] = [];
    const fetcher: ListingsFetcher = async (url) => {
      urls.push(url);
      if (url.includes("trim=SE")) {
        return { ok: true, status: 200, json: async () => body([], 0) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => body([row({ trim: "LE" })], 1),
      };
    };
    const out = await fetchUnitsWithTrimFallback({
      zip: "60614",
      providerModel: "Corolla",
      recommendedTrim: "SE",
      baseTrim: "LE",
      fetcher,
      baseUrl: "https://provider.example",
      apiKey: "test-key",
    });
    expect(out.fellBackToBase).toBe(true);
    expect(out.trimUsed).toBe("LE");
    expect(out.result.units[0]?.trim).toBe("LE");
    // SE searched at 50 then 150 (zero found), then LE takes over.
    expect(urls.some((u) => u.includes("trim=SE") && u.includes("radius=150"))).toBe(true);
    expect(urls.some((u) => u.includes("trim=LE"))).toBe(true);
  });

  it("keeps the step-up trim when it is in stock", async () => {
    const fetcher: ListingsFetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => body([row({ trim: "SE" })], 2),
    });
    const out = await fetchUnitsWithTrimFallback({
      zip: "60614",
      providerModel: "Corolla",
      recommendedTrim: "SE",
      baseTrim: "LE",
      fetcher,
      baseUrl: "https://provider.example",
      apiKey: "test-key",
    });
    expect(out.fellBackToBase).toBe(false);
    expect(out.trimUsed).toBe("SE");
  });

  it("never falls back on a load error (stock unknown, not absent)", async () => {
    let calls = 0;
    const fetcher: ListingsFetcher = async () => {
      calls += 1;
      return { ok: false, status: 429, json: async () => ({}) };
    };
    const out = await fetchUnitsWithTrimFallback({
      zip: "60614",
      providerModel: "Corolla",
      recommendedTrim: "SE",
      baseTrim: "LE",
      fetcher,
      baseUrl: "https://provider.example",
      apiKey: "test-key",
      retryDelaysMs: [1, 1],
    });
    expect(out.fellBackToBase).toBe(false);
    expect(out.result.error).toBe("Couldn't load local stock right now");
    expect(calls).toBeGreaterThan(0);
  });
});
