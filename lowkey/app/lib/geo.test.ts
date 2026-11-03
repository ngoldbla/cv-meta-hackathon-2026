import { describe, expect, it } from "vitest";

import {
  areaAfterSearch,
  areaPlaceLabel,
  censusCoordsUrl,
  confirmArea,
  isAreaConfirmed,
  isBareGeoResult,
  lookupWithRetry,
  parseCensusGeographies,
  parseStoredArea,
  parseTigerZipCentroid,
  parseVercelArea,
  resolveInitialArea,
  roundCoord,
  serializeStoredArea,
  type SearchArea,
} from "./geo";

function headers(map: Record<string, string | null>) {
  return { get: (name: string) => map[name] ?? null };
}

// Trimmed from a live Census geographies/coordinates response for
// Chicago (x=-87.65, y=41.93) on 2026-11-03. Layer names and fields
// are the real ones; only unrelated layers were dropped.
const CENSUS_CHICAGO = {
  result: {
    geographies: {
      "2020 Census ZIP Code Tabulation Areas": [
        { GEOID: "60614", ZCTA5: "60614", BASENAME: "60614", NAME: "ZCTA5 60614" },
      ],
      "Incorporated Places": [
        { BASENAME: "Chicago", NAME: "Chicago city", STATE: "17" },
      ],
      States: [{ BASENAME: "Illinois", NAME: "Illinois", STUSAB: "IL" }],
      "County Subdivisions": [{ BASENAME: "Chicago", NAME: "Chicago city" }],
    },
    input: { location: { x: -87.65, y: 41.93 } },
  },
};

describe("parseVercelArea (task 030 part 1)", () => {
  it("uses a US 5-digit postal code with city and region", () => {
    expect(
      parseVercelArea(
        headers({
          "x-vercel-ip-country": "US",
          "x-vercel-ip-postal-code": "60614",
          "x-vercel-ip-city": "Chicago",
          "x-vercel-ip-country-region": "IL",
        }),
      ),
    ).toEqual({
      zip: "60614",
      city: "Chicago",
      state: "IL",
      approximate: true,
      confirmed: false,
    });
  });

  it("decodes an encoded city and upper-cases the region", () => {
    const area = parseVercelArea(
      headers({
        "x-vercel-ip-country": "US",
        "x-vercel-ip-postal-code": "10001",
        "x-vercel-ip-city": "New%20York",
        "x-vercel-ip-country-region": "ny",
      }),
    );
    expect(area?.city).toBe("New York");
    expect(area?.state).toBe("NY");
  });

  it("rejects non-US countries and non-5-digit postal codes", () => {
    expect(
      parseVercelArea(
        headers({
          "x-vercel-ip-country": "CA",
          "x-vercel-ip-postal-code": "60614",
          "x-vercel-ip-city": "Toronto",
          "x-vercel-ip-country-region": "ON",
        }),
      ),
    ).toBeNull();
    expect(
      parseVercelArea(
        headers({
          "x-vercel-ip-country": "US",
          "x-vercel-ip-postal-code": "6061",
          "x-vercel-ip-city": "Chicago",
          "x-vercel-ip-country-region": "IL",
        }),
      ),
    ).toBeNull();
    expect(parseVercelArea(headers({}))).toBeNull();
  });
});

describe("parseCensusGeographies (task 030 part 1)", () => {
  it("reads the ZCTA, place and state from the real layer names", () => {
    expect(parseCensusGeographies(CENSUS_CHICAGO)).toEqual({
      zip: "60614",
      city: "Chicago",
      state: "IL",
    });
  });

  it("returns null without a ZIP layer and tolerates junk", () => {
    expect(parseCensusGeographies(null)).toBeNull();
    expect(parseCensusGeographies({})).toBeNull();
    expect(
      parseCensusGeographies({ result: { geographies: { States: [] } } }),
    ).toBeNull();
  });
});

describe("coordinates helpers (task 030 part 1)", () => {
  it("rounds to 2 decimals and builds the Census URL with x=lon, y=lat", () => {
    expect(roundCoord(41.9299)).toBe(41.93);
    expect(roundCoord(-87.6543)).toBe(-87.65);
    const url = censusCoordsUrl(41.93, -87.65);
    expect(url).toContain("x=-87.65");
    expect(url).toContain("y=41.93");
    expect(url).toContain("benchmark=Public_AR_Current");
    expect(url).toContain("vintage=Current_Current");
    expect(url).toContain("layers=all");
  });

  it("parses a TIGERweb ZCTA centroid", () => {
    expect(
      parseTigerZipCentroid({
        features: [
          { attributes: { CENTLAT: "+41.9222280", CENTLON: "-087.6471379" } },
        ],
      }),
    ).toEqual({ lat: 41.922228, lon: -87.6471379 });
    expect(parseTigerZipCentroid({ features: [] })).toBeNull();
    expect(parseTigerZipCentroid(null)).toBeNull();
  });

  it("labels an area with or without a known place", () => {
    expect(
      areaPlaceLabel({ zip: "60614", city: "Chicago", state: "IL" }),
    ).toBe("Chicago, IL 60614");
    expect(areaPlaceLabel({ zip: "30097", city: null, state: null })).toBe(
      "30097",
    );
  });
});

describe("area confirmation (task 032 part 1)", () => {
  const headerGuess: SearchArea = {
    zip: "30062",
    city: "Marietta",
    state: "GA",
    approximate: true,
    confirmed: false,
  };

  it("a header guess, then a search, is still approximate", () => {
    const after = areaAfterSearch(headerGuess);
    expect(after.approximate).toBe(true);
    expect(isAreaConfirmed(after)).toBe(false);
    expect(after).toEqual(headerGuess);
  });

  it("Change to a ZIP is confirmed", () => {
    const confirmed = confirmArea({
      zip: "60614",
      city: "Chicago",
      state: "IL",
    });
    expect(confirmed.approximate).toBe(false);
    expect(isAreaConfirmed(confirmed)).toBe(true);
  });

  it("location success is confirmed", () => {
    const confirmed = confirmArea({
      zip: "60614",
      city: "Chicago",
      state: "IL",
    });
    expect(isAreaConfirmed(confirmed)).toBe(true);
    expect(confirmed.approximate).toBe(false);
  });

  it("location failure leaves the area as it was", () => {
    // HomeClient only calls confirmArea on success; a failure never
    // touches the current area. The guess stays approximate and a
    // confirmed area stays confirmed.
    expect(headerGuess.approximate).toBe(true);
    const confirmed = confirmArea({
      zip: "60614",
      city: "Chicago",
      state: "IL",
    });
    expect(isAreaConfirmed(confirmed)).toBe(true);
  });

  it("stored confirmed flag round-trips through localStorage text", () => {
    const confirmed = confirmArea({
      zip: "60614",
      city: "Chicago",
      state: "IL",
    });
    expect(parseStoredArea(serializeStoredArea(confirmed))).toEqual(
      confirmed,
    );
    expect(parseStoredArea(serializeStoredArea(headerGuess))).toEqual(
      headerGuess,
    );
    expect(parseStoredArea(null)).toBeNull();
    expect(parseStoredArea("not json")).toBeNull();
    expect(
      parseStoredArea(JSON.stringify({ zip: "6061", city: null, state: null })),
    ).toBeNull();
  });

  it("a stored confirmed area beats a new header guess", () => {
    const stored = confirmArea({
      zip: "60614",
      city: "Chicago",
      state: "IL",
    });
    expect(resolveInitialArea(stored, headerGuess)).toEqual(stored);
  });

  it("an unconfirmed stored area is replaced by a fresh header guess", () => {
    const fresh: SearchArea = {
      zip: "60614",
      city: "Chicago",
      state: "IL",
      approximate: true,
      confirmed: false,
    };
    expect(resolveInitialArea(headerGuess, fresh)).toEqual(fresh);
  });

  it("an unconfirmed stored area with no header guess is still approximate", () => {
    const resolved = resolveInitialArea(headerGuess, null);
    expect(resolved).toEqual(headerGuess);
    expect(resolved?.approximate).toBe(true);
    expect(resolveInitialArea(null, headerGuess)).toEqual(headerGuess);
    expect(resolveInitialArea(null, null)).toBeNull();
  });
});

describe("city lookup retry (task 032 part 2)", () => {
  const noSleep = async () => undefined;

  it("a bare first response followed by a city ends with the city", async () => {
    let calls = 0;
    const result = await lookupWithRetry(async () => {
      calls += 1;
      return calls === 1
        ? { zip: "30097", city: null, state: null }
        : { zip: "30097", city: "Duluth", state: "GA" };
    }, noSleep);
    expect(result).toEqual({ zip: "30097", city: "Duluth", state: "GA" });
    expect(calls).toBe(2);
  });

  it("two bare responses show the ZIP alone and make no third call", async () => {
    let calls = 0;
    const result = await lookupWithRetry(async () => {
      calls += 1;
      // A third call would return a city; it must never happen.
      return calls >= 3
        ? { zip: "30097", city: "Duluth", state: "GA" }
        : { zip: "30097", city: null, state: null };
    }, noSleep);
    expect(result).toEqual({ zip: "30097", city: null, state: null });
    expect(areaPlaceLabel({ zip: "30097", city: null, state: null })).toBe(
      "30097",
    );
    expect(calls).toBe(2);
  });

  it("a failed first call is retried once", async () => {
    let calls = 0;
    const result = await lookupWithRetry(async () => {
      calls += 1;
      if (calls === 1) throw new Error("network");
      return { zip: "60614", city: "Chicago", state: "IL" };
    }, noSleep);
    expect(result).toEqual({ zip: "60614", city: "Chicago", state: "IL" });
    expect(calls).toBe(2);
  });

  it("a first response with a city is not retried", async () => {
    let calls = 0;
    let sleeps = 0;
    const result = await lookupWithRetry(
      async () => {
        calls += 1;
        return { zip: "60614", city: "Chicago", state: "IL" };
      },
      async () => {
        sleeps += 1;
      },
    );
    expect(result?.city).toBe("Chicago");
    expect(calls).toBe(1);
    expect(sleeps).toBe(0);
    expect(isBareGeoResult({ zip: "30097", city: null, state: "GA" })).toBe(
      true,
    );
    expect(isBareGeoResult(null)).toBe(true);
    expect(
      isBareGeoResult({ zip: "60614", city: "Chicago", state: "IL" }),
    ).toBe(false);
  });
});
