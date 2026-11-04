// @vitest-environment node
import { describe, expect, it } from "vitest";

import { benchmark, DEALS_KEY, loadDeals, MAX_DEALS, removeDeal, saveDeal, starDeal, storageAvailable } from "./deals";
import { emptyQuote, type Quote } from "./quote/schema";

function memory(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) };
}
const throwing = {
  getItem: (): string | null => {
    throw new Error("blocked");
  },
  setItem: (): void => {
    throw new Error("blocked");
  },
};
const q = (dealerName: string, patch: Partial<Quote> = {}): Quote => ({ ...emptyQuote(), dealerName, sellingPrice: 30000, ...patch });

describe("saveDeal", () => {
  it("saves newest first", () => {
    const s = memory();
    saveDeal(q("A"), null, { store: s, now: 1, id: "a" });
    const r = saveDeal(q("B"), null, { store: s, now: 2, id: "b" });
    expect(r.ok && r.deals.map((d) => d.id)).toEqual(["b", "a"]);
    expect(loadDeals(s).map((d) => d.quote.dealerName)).toEqual(["B", "A"]);
  });
  it("refuses a quote with unconfirmed fields", () => {
    expect(saveDeal(q("A", { unconfirmed: ["apr"] }), null, { store: memory() })).toEqual({ ok: false, reason: "unconfirmed" });
  });
  it("refuses an invalid quote", () => {
    expect(saveDeal(q("A", { apr: 99 }), null, { store: memory() })).toEqual({ ok: false, reason: "invalid" });
  });
  it("reports unavailable storage", () => {
    expect(saveDeal(q("A"), null, { store: throwing })).toEqual({ ok: false, reason: "unavailable" });
    expect(saveDeal(q("A"), null, { store: null })).toEqual({ ok: false, reason: "unavailable" });
  });
  it(`keeps at most ${MAX_DEALS} and drops the oldest unstarred`, () => {
    const s = memory();
    for (const [i, id] of ["a", "b", "c"].entries()) saveDeal(q(id), null, { store: s, now: i, id });
    starDeal("a", s);
    const r = saveDeal(q("d"), null, { store: s, now: 9, id: "d" });
    expect(r.ok && r.deals.map((d) => d.id)).toEqual(["d", "c", "a"]);
  });
});

describe("star, remove, benchmark", () => {
  it("star is exclusive and toggles off", () => {
    const s = memory();
    saveDeal(q("A"), null, { store: s, now: 1, id: "a" });
    saveDeal(q("B"), null, { store: s, now: 2, id: "b" });
    expect(starDeal("a", s).filter((d) => d.starred).map((d) => d.id)).toEqual(["a"]);
    expect(starDeal("b", s).filter((d) => d.starred).map((d) => d.id)).toEqual(["b"]);
    expect(starDeal("b", s).some((d) => d.starred)).toBe(false);
  });
  it("benchmark is the starred deal, else the newest, else null", () => {
    const s = memory();
    expect(benchmark([])).toBeNull();
    saveDeal(q("A"), null, { store: s, now: 1, id: "a" });
    saveDeal(q("B"), null, { store: s, now: 2, id: "b" });
    expect(benchmark(loadDeals(s))?.id).toBe("b");
    expect(benchmark(starDeal("a", s))?.id).toBe("a");
  });
  it("removes a deal", () => {
    const s = memory();
    saveDeal(q("A"), null, { store: s, now: 1, id: "a" });
    expect(removeDeal("a", s)).toEqual([]);
  });
});

describe("loadDeals", () => {
  it("returns [] for corrupt, wrong-shaped or blocked storage", () => {
    expect(loadDeals(memory({ [DEALS_KEY]: "{nope" }))).toEqual([]);
    expect(loadDeals(memory({ [DEALS_KEY]: '{"a":1}' }))).toEqual([]);
    expect(loadDeals(throwing)).toEqual([]);
    expect(loadDeals(null)).toEqual([]);
  });
  it("skips entries that no longer validate", () => {
    const s = memory();
    saveDeal(q("A"), null, { store: s, now: 1, id: "a" });
    const raw = JSON.parse(s.data[DEALS_KEY]);
    s.data[DEALS_KEY] = JSON.stringify([...raw, { id: "x" }]);
    expect(loadDeals(s).map((d) => d.id)).toEqual(["a"]);
  });
  it("storageAvailable follows the store", () => {
    expect(storageAvailable(memory())).toBe(true);
    expect(storageAvailable(throwing)).toBe(false);
    expect(storageAvailable(null)).toBe(false);
  });
});
