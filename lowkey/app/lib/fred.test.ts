import { describe, expect, it } from "vitest";

import {
  aprLabel,
  formatAprPercent,
  getDefaultApr,
  monthYearLabel,
  parseFredCsv,
} from "./fred";

const SAMPLE_CSV = [
  "DATE,RIFLPBCIANM60NM",
  "2026-05-01,7.61",
  "2026-06-01,",
  "2026-07-01,7.58",
  "2026-08-01,7.54",
  "",
].join("\n");

describe("parseFredCsv", () => {
  it("returns the latest non-empty observation", () => {
    const r = parseFredCsv(SAMPLE_CSV);
    expect(r).toEqual({ aprPercent: 7.54, dateIso: "2026-08-01", assumed: false });
  });

  it("skips blank rows, dot-missing values and the header", () => {
    const csv = [
      "DATE,RIFLPBCIANM60NM",
      "2026-06-01,7.61",
      "2026-07-01,.",
      "2026-08-01,",
      "",
      "   ",
    ].join("\n");
    expect(parseFredCsv(csv)?.aprPercent).toBe(7.61);
    expect(parseFredCsv(csv)?.dateIso).toBe("2026-06-01");
  });

  it("returns null when there is no usable row", () => {
    expect(parseFredCsv("DATE,RIFLPBCIANM60NM\n2026-08-01,\n")).toBeNull();
    expect(parseFredCsv("")).toBeNull();
    expect(parseFredCsv("not a csv")).toBeNull();
  });

  it("handles CRLF line endings", () => {
    const csv = "DATE,RIFLPBCIANM60NM\r\n2026-08-01,7.54\r\n";
    expect(parseFredCsv(csv)?.aprPercent).toBe(7.54);
  });
});

describe("aprLabel", () => {
  it("matches the required on-screen wording", () => {
    expect(
      aprLabel({ aprPercent: 7.54, dateIso: "2026-08-01", assumed: false }),
    ).toBe(
      "7.54% APR: the national average for 60-month new-car loans (Federal Reserve, Aug 2026)",
    );
  });

  it("labels the fallback as assumed", () => {
    const label = aprLabel({ aprPercent: 8, dateIso: null, assumed: true });
    expect(label).toContain("assumed");
    expect(label).toContain("8.0% APR");
  });

  it("formats month-year and percents", () => {
    expect(monthYearLabel("2026-08-01")).toBe("Aug 2026");
    expect(monthYearLabel("2025-12-01")).toBe("Dec 2025");
    expect(formatAprPercent(7.54)).toBe("7.54");
    expect(formatAprPercent(8)).toBe("8.0");
  });
});

describe("getDefaultApr fallback", () => {
  it("falls back to 8.0% assumed when the fetch throws", async () => {
    const r = await getDefaultApr(async () => {
      throw new Error("offline");
    });
    expect(r).toEqual({ aprPercent: 8, dateIso: null, assumed: true });
  });

  it("falls back when the response is not ok", async () => {
    const r = await getDefaultApr(async () => ({
      ok: false,
      text: async () => "",
    }));
    expect(r.assumed).toBe(true);
    expect(r.aprPercent).toBe(8);
  });

  it("falls back when the CSV has no usable value", async () => {
    const r = await getDefaultApr(async () => ({
      ok: true,
      text: async () => "DATE,RIFLPBCIANM60NM\n2026-08-01,\n",
    }));
    expect(r.assumed).toBe(true);
  });

  it("returns the parsed FRED value on success", async () => {
    const r = await getDefaultApr(async () => ({
      ok: true,
      text: async () => SAMPLE_CSV,
    }));
    expect(r).toEqual({ aprPercent: 7.54, dateIso: "2026-08-01", assumed: false });
  });
});
