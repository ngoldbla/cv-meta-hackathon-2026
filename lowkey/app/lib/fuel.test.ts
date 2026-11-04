import { describe, expect, it } from "vitest";

import {
  fuelForModel,
  fuelMonthly,
  seriesForZip,
  weekLabel,
  type FuelTable,
} from "./fuel";

const TABLE: FuelTable = {
  gasSeries: {
    YORD: {
      duoarea: "YORD",
      displayName: "Chicago regular",
      latestDate: "2026-10-26",
      forecast: { meanP10: 3.8, meanP50: 4.8, meanP90: 6.0 },
    },
    R1Z: {
      duoarea: "R1Z",
      displayName: "PADD 1C regular",
      latestDate: "2026-10-26",
      forecast: { meanP10: 3.4, meanP50: 3.8, meanP90: 4.4 },
    },
    R40: {
      duoarea: "R40",
      displayName: "PADD 4 regular",
      latestDate: "2026-10-26",
      forecast: { meanP10: 3.9, meanP50: 4.4, meanP90: 5.1 },
    },
    NUS: {
      duoarea: "NUS",
      displayName: "U.S. regular",
      latestDate: "2026-10-26",
      forecast: { meanP10: 3.7, meanP50: 4.2, meanP90: 4.9 },
    },
  },
  zipMap: {
    cityZip3: { YORD: [606] },
    zip3Ranges: [
      [600, 629, "IL"],
      [300, 319, "GA"],
      [590, 599, "MT"],
      [900, 961, "CA"],
    ],
    stateSeries: { CA: "SCA" },
    paddByState: { IL: "R20", GA: "R1Z", MT: "R40" },
    fallbackDuoarea: "NUS",
  },
};

describe("fuelMonthly (task 027 part 5 formula)", () => {
  it("is 1,000 miles / MPG x price", () => {
    expect(fuelMonthly(25, 4)).toBeCloseTo(160, 6);
    expect(fuelMonthly(29, 4.8)).toBeCloseTo((1000 / 29) * 4.8, 6);
  });
});

describe("seriesForZip (city, then state, then PADD, then US)", () => {
  it("maps a Chicago ZIP to the city series", () => {
    const s = seriesForZip("60614", TABLE);
    expect(s?.duoarea).toBe("YORD");
    expect(s?.level).toBe("city");
  });

  it("maps a Georgia ZIP to its PADD series", () => {
    expect(seriesForZip("30097", TABLE)?.duoarea).toBe("R1Z");
  });

  it("maps a Montana ZIP to PADD 4", () => {
    expect(seriesForZip("59001", TABLE)?.duoarea).toBe("R40");
  });

  it("returns null for a malformed ZIP", () => {
    expect(seriesForZip("abc", TABLE)).toBeNull();
    expect(seriesForZip("6061", TABLE)).toBeNull();
  });
});

describe("fuelForModel", () => {
  it("returns the median estimate with the 10th-90th range", () => {
    const f = fuelForModel({ mpg: 29, zip: "60614", table: TABLE });
    expect(f).not.toBeNull();
    expect(f!.perMonth).toBeCloseTo((1000 / 29) * 4.8, 6);
    expect(f!.low).toBeCloseTo((1000 / 29) * 3.8, 6);
    expect(f!.high).toBeCloseTo((1000 / 29) * 6.0, 6);
    expect(f!.seriesDisplay).toBe("Chicago regular");
    expect(f!.latestDate).toBe("2026-10-26");
    expect(f!.text).toContain("Chicago regular, EIA, week of Oct 26");
  });

  it("shows no fuel number when the model has no MPG", () => {
    expect(fuelForModel({ mpg: null, zip: "60614", table: TABLE })).toBeNull();
    expect(fuelForModel({ mpg: 0, zip: "60614", table: TABLE })).toBeNull();
    expect(
      fuelForModel({ mpg: undefined, zip: "60614", table: TABLE }),
    ).toBeNull();
  });

  it("shows no fuel number when the ZIP maps to a missing series", () => {
    // 900xx maps to state series SCA, which this fixture table lacks.
    expect(fuelForModel({ mpg: 30, zip: "90012", table: TABLE })).toBeNull();
    expect(seriesForZip("90012", TABLE)?.duoarea).toBe("SCA");
  });
});

describe("weekLabel", () => {
  it("formats the EIA week", () => {
    expect(weekLabel("2026-10-26")).toBe("week of Oct 26");
    expect(weekLabel("2026-01-05")).toBe("week of Jan 5");
  });
});
