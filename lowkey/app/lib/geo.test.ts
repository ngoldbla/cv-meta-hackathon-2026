import { describe, expect, it } from "vitest";

import {
  areaPlaceLabel,
  censusCoordsUrl,
  parseCensusGeographies,
  parseTigerZipCentroid,
  parseVercelArea,
  roundCoord,
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
    ).toEqual({ zip: "60614", city: "Chicago", state: "IL", approximate: true });
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
