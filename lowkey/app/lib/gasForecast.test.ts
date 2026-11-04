import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isStale,
  latestEiaWeek,
  mergeGasSeries,
  requestRefreshIfStale,
  resetGasForecastState,
  withLiveGas,
} from "./gasForecast";
import type { GasSeriesEntry } from "./table";

const entry = (duoarea: string, latestDate: string, meanP50: number): GasSeriesEntry => ({
  duoarea,
  areaName: null,
  displayName: `${duoarea} regular`,
  seriesId: null,
  latestPrice: meanP50,
  latestDate,
  asOf: latestDate,
  forecast: { horizonWeeks: 52, p10: [], p50: [], p90: [], meanP10: meanP50 - 1, meanP50, meanP90: meanP50 + 1 },
});

// November 2026: America/New_York is UTC-5.
const ny = (d: number, hh: number, mm = 0) => new Date(Date.UTC(2026, 10, d, hh + 5, mm));

describe("latestEiaWeek", () => {
  it("is the last Monday whose 18:00 ET has passed", () => {
    expect(latestEiaWeek(ny(2, 17, 59))).toBe("2026-10-26");
    expect(latestEiaWeek(ny(2, 18, 0))).toBe("2026-11-02");
    expect(latestEiaWeek(ny(4, 9))).toBe("2026-11-02");
    expect(latestEiaWeek(ny(8, 23))).toBe("2026-11-02");
  });
});

describe("isStale", () => {
  it("compares against the latest EIA week", () => {
    expect(isStale("2026-10-26", ny(4, 9))).toBe(true);
    expect(isStale("2026-11-02", ny(4, 9))).toBe(false);
  });
});

describe("mergeGasSeries", () => {
  it("keeps the newer entry per series and adds new ones", () => {
    const base = { YORD: entry("YORD", "2026-10-26", 4.5), NUS: entry("NUS", "2026-11-02", 3.9) };
    const live = { YORD: entry("YORD", "2026-11-02", 4.6), NUS: entry("NUS", "2026-10-26", 3.0), R40: entry("R40", "2026-11-02", 4.2) };
    const m = mergeGasSeries(base, live);
    expect(m.YORD!.forecast!.meanP50).toBe(4.6);
    expect(m.NUS!.forecast!.meanP50).toBe(3.9);
    expect(m.R40).toBeDefined();
  });
  it("returns the base when live is null", () => {
    const base = { YORD: entry("YORD", "2026-10-26", 4.5) };
    expect(mergeGasSeries(base, null)).toBe(base);
  });
});

describe("live fetch and refresh", () => {
  beforeEach(() => {
    resetGasForecastState();
    vi.stubEnv("LOWKEY_GAS_URL", "https://gas.example/");
    vi.stubEnv("LOWKEY_GAS_TOKEN", "t");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("merges live series over the table", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ series: { YORD: entry("YORD", "2026-11-02", 4.6) } })));
    const t = await withLiveGas({ gasSeries: { YORD: entry("YORD", "2026-10-26", 4.5) } });
    expect(t.gasSeries.YORD!.latestDate).toBe("2026-11-02");
  });

  it("falls back to the table when the endpoint fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    const t = await withLiveGas({ gasSeries: { YORD: entry("YORD", "2026-10-26", 4.5) } });
    expect(t.gasSeries.YORD!.latestDate).toBe("2026-10-26");
  });

  it("falls back without config and never calls fetch", async () => {
    vi.unstubAllEnvs();
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const t = await withLiveGas({ gasSeries: {} });
    expect(t.gasSeries).toEqual({});
    expect(f).not.toHaveBeenCalled();
  });

  it("posts a refresh once when stale, never when fresh", async () => {
    const f = vi.fn(async (_url: string) => Response.json({ status: "started" }, { status: 202 }));
    vi.stubGlobal("fetch", f);
    requestRefreshIfStale("2026-11-02", ny(4, 9));
    requestRefreshIfStale("2026-10-26", ny(4, 9));
    requestRefreshIfStale("2026-10-26", ny(4, 9));
    await new Promise((r) => setTimeout(r, 0));
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0]![0]).toBe("https://gas.example/refresh");
  });
});
