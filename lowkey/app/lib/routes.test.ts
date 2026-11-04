import { describe, expect, it } from "vitest";

import {
  carPath,
  listingPath,
  parseView,
  quotePath,
  resultsPath,
  searchApiQuery,
  termsSummary,
  viewQuery,
  type View,
} from "./routes";

const base: View = { zip: "30263", terms: { down: null, downPct: null, apr: null, term: null }, sort: "real" };

describe("URL state (task 049)", () => {
  it("keeps a default view to the ZIP alone", () => {
    expect(resultsPath("sedan", base)).toBe("/sedan?zip=30263");
    expect(parseView("?zip=30263")).toEqual(base);
  });

  it("round-trips every setting and the sort", () => {
    const v: View = { zip: "60614", terms: { down: 5000, downPct: null, apr: 5.9, term: 72 }, sort: "nearest" };
    const q = viewQuery(v);
    expect(q).toBe("?zip=60614&down=5000&apr=5.9&term=72&sort=nearest");
    expect(parseView(q)).toEqual(v);
    const pct: View = { ...v, terms: { down: null, downPct: 20, apr: null, term: 48 } };
    expect(parseView(viewQuery(pct))).toEqual(pct);
  });

  it("drops bad settings back to the defaults and refuses a bad ZIP", () => {
    expect(parseView("?zip=30263&term=61&apr=99&downPct=-5&sort=best")).toEqual(base);
    expect(parseView("?zip=3026")).toBeNull();
    expect(parseView("?type=sedan")).toBeNull();
    // A dollar down payment wins over a percent.
    expect(parseView("?zip=30263&down=3000&downPct=20")?.terms).toEqual({ down: 3000, downPct: null, apr: null, term: null });
  });

  it("builds every screen's path with the same view", () => {
    const v: View = { ...base, terms: { ...base.terms, apr: 6.5 } };
    expect(carPath("suv", "honda-cr-v", v)).toBe("/suv/honda-cr-v?zip=30263&apr=6.5");
    expect(listingPath("suv", "honda-cr-v", 2, v)).toBe("/suv/honda-cr-v/listing/2?zip=30263&apr=6.5");
    expect(quotePath({ type: "suv", view: v, car: "honda-cr-v" })).toBe("/quote?zip=30263&apr=6.5&type=suv&car=honda-cr-v");
    expect(quotePath()).toBe("/quote");
  });

  it("asks the search route for exactly the settings in the view, never the sort", () => {
    const v: View = { zip: "30263", terms: { down: null, downPct: 25, apr: null, term: 36 }, sort: "monthly" };
    expect(searchApiQuery("hybrid", v)).toBe("/api/search?zip=30263&type=hybrid&downPct=25&term=36");
  });

  it("summarises the terms on one line", () => {
    expect(termsSummary(base.terms, 7.54)).toBe("10% down · 60 mo · 7.54% APR");
    expect(termsSummary({ down: 5000, downPct: null, apr: 5.9, term: 72 }, 7.54)).toBe("$5,000 down · 72 mo · 5.9% APR");
  });
});
