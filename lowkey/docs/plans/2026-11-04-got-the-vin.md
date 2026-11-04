# Got the VIN? Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename "Check a quote" to "Got the VIN?", make the VIN the first step (live scanner, photo or PDF, typed), and let a confirmed deal be saved on the device as a benchmark ("Your deal") shown on results and car pages and shareable as a link.

**Architecture:** Three pure, unit-tested libs (`lib/deals.ts` store, `lib/quote/shareLink.ts` codec, `lib/quote/benchmark.ts` resale/heads-up helpers) carry the logic. New small components (`VinScanner`, `VinStep`, `SavedDeals`, `DealActions`, `YourDealRow`, `useDeals`) carry the UI. `QuoteCheck.tsx` gains a `step` state and delegates to them.

**Tech Stack:** Next.js (app router), React client components, zod, vitest (node env, no jsdom), zxing-wasm 3.1.6, localStorage, Playwright (scratch only) for the visual check.

**Spec:** `lowkey/docs/specs/2026-11-04-got-the-vin-design.md`

## Global Constraints

- Work from `lowkey/app` unless a path says otherwise. Branch `task/059-got-the-vin` (already cut from `main`); PR into `main`; never push to `main`.
- Commits: by path, trailer `Assisted-by: agent` only; never name an assistant or vendor in commits, code, docs or UI.
- Copy is calm: no ranking words, no "#1", no alarm. Never name the listings provider in app UI or copy.
- localStorage keys: `lowkey-deals-v1` (new), `lowkey-quote-draft-v1` (existing, keeps working). Every storage read and write is in try/catch; pages render correctly without storage.
- Saved deals: at most 3; a quote with any `unconfirmed` field can't be saved; star is exclusive (one starred deal).
- Share link: `/quote#d=<base64url JSON>`, payload ≤ 4096 characters, validated by `quoteSchema` and the VIN check digit on open; the fragment never reaches the server.
- Tests use invented values only (VIN `1HGCV2FA9SB601815`); never commit real paperwork. Vitest runs in the node environment (no `window`), so lib code takes an injectable storage.
- Interactive targets are at least `min-h-11`. Layout works at 390 px with no horizontal scroll, in light and dark.
- Gates before any push: `npm ci && npm run build`, `npm test` (in `lowkey/app`), `.venv/bin/python -m pytest -q`, `scripts/name_guard.py`, `scripts/secret_guard.py --all` (repo root).

## File Structure

| File | Responsibility |
|---|---|
| `lib/quote/benchmark.ts` (new) | `VinRetention` type, `resaleFor`, `estTaxFor`, `dealTitle`, `dealRowOf`, `vsDealLine` |
| `lib/deals.ts` (new) | saved-deals store: load/save/star/remove/benchmark, injectable storage |
| `lib/quote/shareLink.ts` (new) | `encodeDeal`, `shareUrl`, `decodeDeal` |
| `lib/quote/barcode.ts` | add `decodeVinFrame(ImageData)` for live frames |
| `components/quote/useDeals.ts` (new) | React hook over the store (`{ deals, ready }`) |
| `components/quote/VinScanner.tsx` (new) | live camera scan |
| `components/quote/VinStep.tsx` (new) | step 1 UI |
| `components/quote/SavedDeals.tsx` (new) | "Your deals" list |
| `components/quote/DealActions.tsx` (new) | Save as my deal / Share |
| `components/quote/YourDealRow.tsx` (new) | the benchmark row on results |
| `components/QuoteCheck.tsx` | `step` state, listing prefill, wiring, rename |
| `app/quote/QuoteClient.tsx`, `app/quote/page.tsx`, `components/screens/Chrome.tsx`, `app/[type]/ResultsClient.tsx` | rename; `?deal=` param; row on results |
| `app/[type]/[car]/CarClient.tsx` | the "vs your deal" line; button text |

---

### Task 1: Benchmark helpers

**Files:**
- Create: `lib/quote/benchmark.ts`
- Test: `lib/quote/benchmark.test.ts`

**Interfaces:**
- Consumes: `analyzeQuote`, `headsUp`, `SameTerms`, `PickDeal` from `./compare`; `usedRetention` from `@/lib/used`; `taxAmountFor` from `@/lib/tax`; `QuotePick` (type) from `@/components/QuoteCheck`; `fmtUsd` from `@/components/render/format`.
- Produces:
  - `type VinRetention = { retention5y: number; byAge: Record<string, number> | null; slopePerYear: number | null }`
  - `type CarInfo = { year: number | null; miles: number | null; retention: VinRetention | null }`
  - `type Resale = Parameters<typeof analyzeQuote>[2]`
  - `resaleFor(q: Quote, info: CarInfo | null, picks: QuotePick[], nowYear: number): Resale`
  - `estTaxFor(q: Quote, pick: QuotePick | null): number | null`
  - `dealTitle(q: Quote): string`
  - `dealRowOf(q: Quote, terms: SameTerms, resale: Resale): { monthly: number | null; outTheDoor: number | null; equityMonth: number | null; basis: "model" | "typical" | null }`
  - `vsDealLine(hu: ReturnType<typeof headsUp>): string | null`

- [ ] **Step 1: Write the failing test**

```ts
// lib/quote/benchmark.test.ts
// @vitest-environment node
import { describe, expect, it } from "vitest";

import { dealRowOf, dealTitle, resaleFor, vsDealLine } from "./benchmark";
import type { headsUp } from "./compare";
import { emptyQuote, type Quote } from "./schema";

const terms = { downRule: { kind: "share", share: 0.1 } as const, aprPercent: 7, termMonths: 60 };

function quote(patch: Partial<Quote> = {}): Quote {
  return { ...emptyQuote(), sellingPrice: 30000, outTheDoor: 32000, apr: 6, termMonths: 60, down: 3000, ...patch };
}

describe("dealTitle", () => {
  it("prefers the VIN lookup's car", () => {
    const q = quote({ car: { year: 2026, make: "Honda", model: "Civic", trim: "Sport", miles: 12, status: "active" } });
    expect(dealTitle(q)).toBe("2026 Honda Civic Sport");
  });
  it("falls back to the typed year and vehicle", () => {
    expect(dealTitle(quote({ year: 2025, vehicle: "Toyota Camry" }))).toBe("2025 Toyota Camry");
  });
  it("has a plain default", () => expect(dealTitle(quote())).toBe("Your deal"));
});

describe("resaleFor", () => {
  const picks = [
    { key: "honda|civic", label: "Honda Civic", retention5y: 0.62, dealInputs: null, deal: {} as never },
  ];
  it("uses the pick whose name the vehicle contains", () => {
    expect(resaleFor(quote({ vehicle: "honda civic ex" }), null, picks, 2026)).toEqual({ retention5y: 0.62 });
  });
  it("is null for an unknown car", () => {
    expect(resaleFor(quote({ vehicle: "Some Truck" }), null, picks, 2026)).toBeNull();
  });
  it("prices a VIN car on its model's history when it has one", () => {
    const r = resaleFor(quote(), { year: 2026, miles: 10, retention: { retention5y: 0.7, byAge: null, slopePerYear: null } }, [], 2026);
    expect(r?.retention5y).toBe(0.7);
  });
});

describe("dealRowOf", () => {
  it("shows the quote's own loan", () => {
    const r = dealRowOf(quote(), terms, null);
    expect(r.outTheDoor).toBe(32000);
    expect(r.monthly).toBeGreaterThan(500);
    expect(r.monthly).toBeLessThan(600);
    expect(r.basis).toBe("typical");
  });
  it("prefers the stated payment", () => {
    expect(dealRowOf(quote({ statedMonthly: 555 }), terms, null).monthly).toBe(555);
  });
  it("keeps the numbers it has when the quote is incomplete", () => {
    const r = dealRowOf(emptyQuote(), terms, null);
    expect(r).toEqual({ monthly: null, outTheDoor: null, equityMonth: null, basis: null });
  });
});

describe("vsDealLine", () => {
  const ok = (m: number | null, e: number | null) =>
    ({
      ok: true,
      addedTax: null,
      rows: [
        { label: "Monthly payment", quote: 0, pick: 0, difference: m },
        { label: "Out the door (est.)", quote: 0, pick: 0, difference: 0 },
        { label: "Positive equity by month", quote: 0, pick: 0, difference: e },
      ],
    }) as ReturnType<typeof headsUp>;
  it("says less and sooner when the pick is cheaper and builds equity earlier", () => {
    expect(vsDealLine(ok(42.4, 6))).toBe("vs your deal, on the same terms: $42/mo less · equity 6 months sooner");
  });
  it("says more and later the other way", () => {
    expect(vsDealLine(ok(-100, -1))).toBe("vs your deal, on the same terms: $100/mo more · equity 1 month later");
  });
  it("says nothing when fields are missing", () => {
    expect(vsDealLine({ ok: false, missing: ["the APR"] })).toBeNull();
    expect(vsDealLine(ok(null, null))).toBeNull();
  });
  it("calls an even month the same", () => {
    expect(vsDealLine(ok(0.2, 0))).toBe("vs your deal, on the same terms: same monthly · equity at the same time");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd lowkey/app && npx vitest run lib/quote/benchmark.test.ts`
Expected: FAIL, cannot resolve `./benchmark`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/quote/benchmark.ts
/**
 * Task 059: the maths behind "Your deal" as a benchmark. Pure functions
 * shared by the Got the VIN? screen, the results row and the car page,
 * so a saved deal is priced one way everywhere.
 */

import type { QuotePick } from "@/components/QuoteCheck";
import { fmtUsd } from "@/components/render/format";
import { taxAmountFor } from "@/lib/tax";
import { usedRetention } from "@/lib/used";

import { analyzeQuote, type headsUp, type SameTerms } from "./compare";
import type { Quote } from "./schema";

/** A model's resale history from /api/vin (null when Low Key has none). */
export type VinRetention = { retention5y: number; byAge: Record<string, number> | null; slopePerYear: number | null };
export type CarInfo = { year: number | null; miles: number | null; retention: VinRetention | null };
export type Resale = Parameters<typeof analyzeQuote>[2];

/**
 * A model's resale history applies only to that model: a car from its
 * VIN is priced on its own curve by age and miles; otherwise the quote's
 * vehicle text picks one of the Low Key picks; otherwise a typical curve.
 */
export function resaleFor(q: Quote, info: CarInfo | null, picks: QuotePick[], nowYear: number): Resale {
  if (info) {
    const r = usedRetention({
      buildYear: info.year,
      odometer: q.mileage ?? info.miles,
      nowYear,
      retention: info.retention,
    });
    if (info.retention || r.basis !== "new") return r;
  }
  const v = (q.vehicle ?? "").toLowerCase();
  const p = v ? picks.find((pk) => v.includes(pk.deal.model?.toLowerCase?.() ?? "\u0000") || v.includes(pk.label.toLowerCase())) : undefined;
  return p && p.retention5y !== null ? { retention5y: p.retention5y } : null;
}

/** The pick's state sales tax applied to this quote's price (used only when the quote lists none). */
export function estTaxFor(q: Quote, pick: QuotePick | null): number | null {
  const di = pick?.dealInputs;
  if (!pick || !di || di.taxStatus !== "included" || !di.taxRule || q.sellingPrice === null) return null;
  return taxAmountFor(
    di.taxRule,
    q.sellingPrice + q.fees.filter((f) => f.kind !== "government").reduce((t, f) => t + (f.amount ?? 0), 0),
    di.mpg,
  );
}

/** "2026 Honda Civic Sport" from the VIN lookup, else the typed year and vehicle. */
export function dealTitle(q: Quote): string {
  const fromCar = q.car ? [q.car.year, q.car.make, q.car.model, q.car.trim].filter(Boolean).join(" ") : "";
  if (fromCar) return fromCar;
  const typed = [q.year, q.vehicle].filter(Boolean).join(" ").trim();
  return typed || "Your deal";
}

/** What the "Your deal" row shows: the monthly as quoted, the total, and the equity month. */
export function dealRowOf(
  q: Quote,
  terms: SameTerms,
  resale: Resale,
): { monthly: number | null; outTheDoor: number | null; equityMonth: number | null; basis: "model" | "typical" | null } {
  const r = analyzeQuote(q, terms, resale);
  if (!r.ok) return { monthly: q.statedMonthly, outTheDoor: q.outTheDoor, equityMonth: null, basis: null };
  const a = r.analysis;
  return {
    monthly: q.statedMonthly ?? a.asQuoted?.monthly ?? null,
    outTheDoor: a.outTheDoor,
    equityMonth: a.asQuoted ? a.asQuoted.positiveEquityMonth : a.sameTerms.positiveEquityMonth,
    basis: a.retentionSource,
  };
}

/** The car page's one line: this car against the saved deal, both on the car's terms. */
export function vsDealLine(hu: ReturnType<typeof headsUp>): string | null {
  if (!hu.ok) return null;
  const monthly = hu.rows.find((r) => r.label === "Monthly payment");
  const equity = hu.rows.find((r) => r.label.startsWith("Positive equity"));
  const parts: string[] = [];
  // difference = deal − car, so a positive difference means the car is cheaper or sooner.
  if (monthly && monthly.difference !== null) {
    const d = Math.round(Math.abs(monthly.difference));
    parts.push(d === 0 ? "same monthly" : `${fmtUsd(d)}/mo ${monthly.difference > 0 ? "less" : "more"}`);
  }
  if (equity && equity.difference !== null) {
    const d = Math.round(Math.abs(equity.difference));
    parts.push(
      d === 0 ? "equity at the same time" : `equity ${d} ${d === 1 ? "month" : "months"} ${equity.difference > 0 ? "sooner" : "later"}`,
    );
  }
  return parts.length ? `vs your deal, on the same terms: ${parts.join(" · ")}` : null;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/quote/benchmark.test.ts`
Expected: PASS. If the `resaleFor` pick-name test fails because `deal.model` is undefined in the fixture, the `?.` guards in the implementation cover it; do not change the test.

- [ ] **Step 5: Commit**

```bash
git add lowkey/app/lib/quote/benchmark.ts lowkey/app/lib/quote/benchmark.test.ts
git commit -m "059: benchmark helpers for a saved deal

Assisted-by: agent"
```

---

### Task 2: Saved-deals store

**Files:**
- Create: `lib/deals.ts`, `components/quote/useDeals.ts`
- Test: `lib/deals.test.ts`

**Interfaces:**
- Consumes: `quoteSchema`, `Quote` from `@/lib/quote/schema`; `VinRetention` from `@/lib/quote/benchmark`.
- Produces:
  - `type SavedDeal = { id: string; savedAt: number; starred: boolean; quote: Quote; retention: VinRetention | null }`
  - `type DealStorage = Pick<Storage, "getItem" | "setItem">`
  - `DEALS_KEY`, `MAX_DEALS = 3`, `DEALS_EVENT`
  - `loadDeals(store?: DealStorage | null): SavedDeal[]`
  - `saveDeal(q: Quote, retention?: VinRetention | null, opts?: { store?: DealStorage | null; now?: number; id?: string }): { ok: true; deals: SavedDeal[]; id: string } | { ok: false; reason: "unconfirmed" | "invalid" | "unavailable" }`
  - `starDeal(id: string, store?): SavedDeal[]` (exclusive; starring the starred one clears it)
  - `removeDeal(id: string, store?): SavedDeal[]`
  - `benchmark(deals: SavedDeal[]): SavedDeal | null`
  - `storageAvailable(store?): boolean`
  - `useDeals(): { deals: SavedDeal[]; ready: boolean }`

- [ ] **Step 1: Write the failing test**

```ts
// lib/deals.test.ts
// @vitest-environment node
import { describe, expect, it } from "vitest";

import { benchmark, DEALS_KEY, loadDeals, MAX_DEALS, removeDeal, saveDeal, starDeal, storageAvailable } from "./deals";
import { emptyQuote, type Quote } from "./quote/schema";

function memory(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) };
}
const throwing = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/deals.test.ts`
Expected: FAIL, cannot resolve `./deals`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/deals.ts
/**
 * Task 059: deals the shopper saved on this device. Only the confirmed
 * quote is stored (plus its model's resale history from the VIN lookup);
 * what a deal costs is recomputed each time it is shown. Storage is
 * best-effort: every access is guarded and the app works without it.
 */

import { z } from "zod";

import type { VinRetention } from "@/lib/quote/benchmark";
import { quoteSchema, type Quote } from "@/lib/quote/schema";

export const DEALS_KEY = "lowkey-deals-v1";
export const DEALS_EVENT = "lowkey-deals";
export const MAX_DEALS = 3;

const retentionSchema = z
  .object({
    retention5y: z.number(),
    byAge: z.record(z.string(), z.number()).nullable(),
    slopePerYear: z.number().nullable(),
  })
  .nullable();

const savedSchema = z.object({
  id: z.string().min(1).max(40),
  savedAt: z.number(),
  starred: z.boolean(),
  quote: quoteSchema,
  retention: retentionSchema,
});
export type SavedDeal = { id: string; savedAt: number; starred: boolean; quote: Quote; retention: VinRetention | null };

export type DealStorage = Pick<Storage, "getItem" | "setItem">;

function defaultStore(): DealStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadDeals(store: DealStorage | null = defaultStore()): SavedDeal[] {
  if (!store) return [];
  try {
    const raw = store.getItem(DEALS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((x) => {
      const r = savedSchema.safeParse(x);
      return r.success ? [r.data as SavedDeal] : [];
    }).slice(0, MAX_DEALS);
  } catch {
    return [];
  }
}

function write(deals: SavedDeal[], store: DealStorage | null): boolean {
  if (!store) return false;
  try {
    store.setItem(DEALS_KEY, JSON.stringify(deals));
  } catch {
    return false;
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DEALS_EVENT));
  return true;
}

export function storageAvailable(store: DealStorage | null = defaultStore()): boolean {
  if (!store) return false;
  try {
    store.getItem(DEALS_KEY);
    store.setItem("lowkey-probe", "1");
    return true;
  } catch {
    return false;
  }
}

function newId(): string {
  try {
    return globalThis.crypto.randomUUID().slice(0, 12);
  } catch {
    return Math.random().toString(36).slice(2, 14);
  }
}

export function saveDeal(
  q: Quote,
  retention: VinRetention | null = null,
  opts: { store?: DealStorage | null; now?: number; id?: string } = {},
): { ok: true; deals: SavedDeal[]; id: string } | { ok: false; reason: "unconfirmed" | "invalid" | "unavailable" } {
  const store = opts.store === undefined ? defaultStore() : opts.store;
  if (q.unconfirmed.length) return { ok: false, reason: "unconfirmed" };
  const parsed = quoteSchema.safeParse(q);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  if (!store) return { ok: false, reason: "unavailable" };
  const id = opts.id ?? newId();
  const fresh: SavedDeal = { id, savedAt: opts.now ?? Date.now(), starred: false, quote: parsed.data, retention };
  const all = [fresh, ...loadDeals(store)];
  while (all.length > MAX_DEALS) {
    // The oldest unstarred goes first; if everything else is starred, the oldest.
    let drop = -1;
    for (let i = all.length - 1; i > 0; i -= 1) {
      if (!all[i].starred) {
        drop = i;
        break;
      }
    }
    all.splice(drop === -1 ? all.length - 1 : drop, 1);
  }
  return write(all, store) ? { ok: true, deals: all, id } : { ok: false, reason: "unavailable" };
}

export function starDeal(id: string, store: DealStorage | null = defaultStore()): SavedDeal[] {
  const all = loadDeals(store);
  const was = all.find((d) => d.id === id)?.starred ?? false;
  const next = all.map((d) => ({ ...d, starred: d.id === id ? !was : false }));
  write(next, store);
  return next;
}

export function removeDeal(id: string, store: DealStorage | null = defaultStore()): SavedDeal[] {
  const next = loadDeals(store).filter((d) => d.id !== id);
  write(next, store);
  return next;
}

/** The deal everything is compared against: the starred one, else the newest. */
export function benchmark(deals: SavedDeal[]): SavedDeal | null {
  return deals.find((d) => d.starred) ?? deals[0] ?? null;
}
```

```ts
// components/quote/useDeals.ts
"use client";

import { useEffect, useState } from "react";

import { DEALS_EVENT, loadDeals, type SavedDeal } from "@/lib/deals";

/** The saved deals, empty until the browser has been read (no hydration mismatch). */
export function useDeals(): { deals: SavedDeal[]; ready: boolean } {
  const [state, setState] = useState<{ deals: SavedDeal[]; ready: boolean }>({ deals: [], ready: false });
  useEffect(() => {
    const read = () => setState({ deals: loadDeals(), ready: true });
    read();
    window.addEventListener(DEALS_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(DEALS_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return state;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/deals.test.ts lib/quote/benchmark.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lowkey/app/lib/deals.ts lowkey/app/lib/deals.test.ts lowkey/app/components/quote/useDeals.ts
git commit -m "059: saved deals on the device

Assisted-by: agent"
```

---

### Task 3: Share links

**Files:**
- Create: `lib/quote/shareLink.ts`
- Test: `lib/quote/shareLink.test.ts`

**Interfaces:**
- Consumes: `quoteSchema`, `Quote`, `vinCheckOk` from `./schema`.
- Produces:
  - `MAX_PAYLOAD = 4096`
  - `encodeDeal(q: Quote): string | null` (the base64url payload; null when over the limit)
  - `shareUrl(origin: string, q: Quote): string | null` (`${origin}/quote#d=${payload}`)
  - `decodeDeal(hash: string): Quote | null` (accepts `#d=…` or `d=…`; returns a `Quote` with `source: "manual"` and `unconfirmed: []`)

- [ ] **Step 1: Write the failing test**

```ts
// lib/quote/shareLink.test.ts
// @vitest-environment node
import { describe, expect, it } from "vitest";

import { decodeDeal, encodeDeal, MAX_PAYLOAD, shareUrl } from "./shareLink";
import { emptyQuote, type Quote } from "./schema";

const VIN = "1HGCV2FA9SB601815";
const deal: Quote = {
  ...emptyQuote(),
  vin: VIN,
  year: 2026,
  vehicle: "Honda Civic Sport",
  dealerName: "Lakeside Honda — Café",
  sellingPrice: 29500,
  outTheDoor: 32100,
  apr: 6.9,
  termMonths: 60,
  down: 3000,
  fees: [{ label: "Doc fee", amount: 599, kind: "dealer" }],
  car: { year: 2026, make: "Honda", model: "Civic", trim: "Sport", miles: 12, status: "active" },
};

describe("share link", () => {
  it("round-trips a deal, non-ASCII text included", () => {
    const back = decodeDeal(`#d=${encodeDeal(deal)}`);
    expect(back).toEqual({ ...deal, source: "manual", unconfirmed: [] });
  });
  it("builds the url with a fragment", () => {
    expect(shareUrl("https://lowkey.autos", deal)).toMatch(/^https:\/\/lowkey\.autos\/quote#d=[A-Za-z0-9_-]+$/);
  });
  it("never carries unconfirmed fields", () => {
    const back = decodeDeal(encodeDeal({ ...deal, unconfirmed: ["apr"], source: "photo" })!);
    expect(back?.unconfirmed).toEqual([]);
    expect(back?.source).toBe("manual");
  });
  it("accepts the hash with or without the #d= prefix", () => {
    const p = encodeDeal(deal)!;
    expect(decodeDeal(`d=${p}`)).not.toBeNull();
    expect(decodeDeal(`#d=${p}`)).not.toBeNull();
  });
  it("rejects garbage, a tampered payload and a wrong version", () => {
    expect(decodeDeal("")).toBeNull();
    expect(decodeDeal("#d=%%%")).toBeNull();
    expect(decodeDeal("#d=bm90IGpzb24")).toBeNull();
    const p = encodeDeal(deal)!;
    expect(decodeDeal(`#d=${p.slice(0, -6)}AAAAAA`)).toBeNull();
    const v2 = Buffer.from(JSON.stringify({ v: 2, q: deal })).toString("base64url");
    expect(decodeDeal(`#d=${v2}`)).toBeNull();
  });
  it("rejects a schema violation and a VIN that fails its check digit", () => {
    const bad = Buffer.from(JSON.stringify({ v: 1, q: { ...deal, apr: 99 } })).toString("base64url");
    expect(decodeDeal(`#d=${bad}`)).toBeNull();
    const badVin = Buffer.from(JSON.stringify({ v: 1, q: { ...deal, vin: "1HGCV2FA0SB601815" } })).toString("base64url");
    expect(decodeDeal(`#d=${badVin}`)).toBeNull();
  });
  it("refuses to encode or decode an oversize deal", () => {
    const big: Quote = { ...deal, fees: Array.from({ length: 30 }, (_, i) => ({ label: "x".repeat(120) + i, amount: 1, kind: "dealer" as const })) };
    expect(encodeDeal(big)).toBeNull();
    expect(decodeDeal(`#d=${"A".repeat(MAX_PAYLOAD + 1)}`)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/quote/shareLink.test.ts`
Expected: FAIL, cannot resolve `./shareLink`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/quote/shareLink.ts
/**
 * Task 059: a deal as a link. The confirmed quote is packed after the
 * `#`, so it never reaches the server, a log or analytics. It holds the
 * car, VIN, dealer and money fields; the schema has no name or phone.
 */

import { quoteSchema, vinCheckOk, type Quote } from "./schema";

export const MAX_PAYLOAD = 4096;
const VERSION = 1;

function toB64url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): string {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** The payload for a deal, or null when it would be too long for a link. */
export function encodeDeal(q: Quote): string | null {
  const { unconfirmed: _u, source: _s, ...rest } = q;
  void _u;
  void _s;
  const payload = toB64url(JSON.stringify({ v: VERSION, q: rest }));
  return payload.length <= MAX_PAYLOAD ? payload : null;
}

export function shareUrl(origin: string, q: Quote): string | null {
  const payload = encodeDeal(q);
  return payload ? `${origin}/quote#d=${payload}` : null;
}

/** The deal in a `#d=…` fragment, or null when it is missing, damaged, oversize or invalid. */
export function decodeDeal(hash: string): Quote | null {
  const m = /^#?d=([A-Za-z0-9_-]*)$/.exec(hash);
  if (!m || !m[1] || m[1].length > MAX_PAYLOAD) return null;
  try {
    const body = JSON.parse(fromB64url(m[1])) as { v?: unknown; q?: unknown };
    if (body.v !== VERSION || typeof body.q !== "object" || body.q === null) return null;
    const parsed = quoteSchema.safeParse({ ...body.q, source: "manual", unconfirmed: [] });
    if (!parsed.success) return null;
    if (parsed.data.vin !== null && !vinCheckOk(parsed.data.vin)) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/quote/shareLink.test.ts`
Expected: PASS. (`Buffer` is available in the node test environment.)

- [ ] **Step 5: Commit**

```bash
git add lowkey/app/lib/quote/shareLink.ts lowkey/app/lib/quote/shareLink.test.ts
git commit -m "059: deal share links in the URL fragment

Assisted-by: agent"
```

---

### Task 4: The VIN step (scanner, step 1) and the rename

**Files:**
- Modify: `lib/quote/barcode.ts` (add `decodeVinFrame`)
- Create: `components/quote/VinScanner.tsx`, `components/quote/VinStep.tsx`
- Modify: `components/screens/Chrome.tsx:42,63`, `app/[type]/ResultsClient.tsx:111`, `app/quote/QuoteClient.tsx:13,52`, `app/quote/page.tsx:5`, `app/[type]/[car]/CarClient.tsx:157`
- Test: `lib/quote/barcode.test.ts` (extend)

**Interfaces:**
- Consumes: `vinCheckOk` from `@/lib/quote/schema`; `vinFromBarcodeText` from `@/lib/quote/barcode`.
- Produces:
  - `decodeVinFrame(frame: ImageData): Promise<string | null>` (never throws)
  - `<VinScanner onVin={(vin: string) => void} onUnavailable={() => void} onCancel={() => void} />`
  - `<VinStep ... />` with props:
    `{ vin: string; onTypeVin: (v: string) => void; onVin: (vin: string) => void; onChooseFile: () => void; onTakePhoto: () => void; onSkip: () => void; busy: boolean; message: string; canScan: boolean }`

- [ ] **Step 1: Write the failing test** (a frame test for `decodeVinFrame`)

Append to `lib/quote/barcode.test.ts`:

```ts
describe("decodeVinFrame", () => {
  it("reads a VIN from raw pixels", async () => {
    const { writeBarcode } = await import("zxing-wasm/full");
    const { decodeVinFrame } = await import("./barcode");
    const written = await writeBarcode(VIN, { format: "Code39", scale: 3 });
    // writeBarcode returns an encoded image; read pixels through the wasm reader's own ImageData input.
    const { readBarcodes } = await import("zxing-wasm/full");
    const decoded = await readBarcodes(written.image as Blob, { formats: ["Code39"] });
    expect(vinFromBarcodeText(decoded[0]?.text ?? "")).toBe(VIN);
    expect(await decodeVinFrame({ data: new Uint8ClampedArray(16), width: 2, height: 2, colorSpace: "srgb" } as ImageData)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/quote/barcode.test.ts`
Expected: FAIL, `decodeVinFrame` is not exported.

- [ ] **Step 3: Implement `decodeVinFrame`** — refactor `barcode.ts` so both decoders share the wasm setup. Replace the body of `decodeVin` and add:

```ts
// lib/quote/barcode.ts (replace from `let prepared` to the end)
let prepared = false;

async function reader() {
  const zx = await import("zxing-wasm/reader");
  if (!prepared) {
    // Served from our own origin (copied at build time), not a CDN.
    zx.prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? "/zxing_reader.wasm" : prefix + path),
      },
    });
    prepared = true;
  }
  return zx;
}

const FORMATS = ["Code39", "Code128", "DataMatrix", "QRCode"] as const;

function firstVin(results: { text?: string }[]): string | null {
  for (const r of results) {
    const vin = vinFromBarcodeText(r.text ?? "");
    if (vin) return vin;
  }
  return null;
}

/** The VIN in a photo's barcode, or null (no barcode, unreadable, or no wasm). Never throws. */
export async function decodeVin(file: Blob): Promise<string | null> {
  try {
    const zx = await reader();
    return firstVin(await zx.readBarcodes(file, { formats: [...FORMATS], tryHarder: true, maxNumberOfSymbols: 4 }));
  } catch {
    return null; // no barcode path: the read's VIN or a typed one takes over
  }
}

/** The VIN in one live camera frame, or null. Fast settings: a scanner calls this several times a second. */
export async function decodeVinFrame(frame: ImageData): Promise<string | null> {
  try {
    const zx = await reader();
    return firstVin(await zx.readBarcodes(frame, { formats: [...FORMATS], tryHarder: false, maxNumberOfSymbols: 4 }));
  } catch {
    return null;
  }
}
```

(Delete the old `let prepared`, `decodeVin` body. Keep `vinFromBarcodeText` and the file header.)

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/quote/barcode.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `VinScanner`**

```tsx
// components/quote/VinScanner.tsx
"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/b-button";
import { Typography } from "@/components/ui/typography";
import { decodeVinFrame, vinFromBarcodeText } from "@/lib/quote/barcode";

const HINT_AFTER_MS = 20_000;
const FRAME_MS = 250;
const MAX_WIDTH = 1280;

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue?: string }[]> };
type DetectorCtor = new (o: { formats: string[] }) => Detector;

/**
 * A live camera view that looks for a VIN barcode (task 059). Frames are
 * decoded on the device (the browser's own detector when it has one,
 * else the bundled reader) and are never sent anywhere. The first VIN
 * whose check digit holds ends the scan; the camera is stopped on every
 * exit.
 */
export function VinScanner({
  onVin,
  onUnavailable,
  onCancel,
}: {
  onVin: (vin: string) => void;
  onUnavailable: () => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hint, setHint] = useState(false);
  const cb = useRef({ onVin, onUnavailable });
  cb.current = { onVin, onUnavailable };

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hintTimer = setTimeout(() => setHint(true), HINT_AFTER_MS);
    const canvas = document.createElement("canvas");
    const Native = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    const native = Native ? new Native({ formats: ["code_39", "code_128", "data_matrix", "qr_code"] }) : null;

    const stop = () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(hintTimer);
      stream?.getTracks().forEach((t) => t.stop());
    };

    const tick = async () => {
      const video = videoRef.current;
      if (stopped || !video || video.readyState < 2 || !video.videoWidth) {
        if (!stopped) timer = setTimeout(tick, FRAME_MS);
        return;
      }
      const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      let vin: string | null = null;
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          if (native) {
            for (const r of await native.detect(canvas)) {
              vin = vinFromBarcodeText(r.rawValue ?? "");
              if (vin) break;
            }
          }
          if (!vin) vin = await decodeVinFrame(ctx.getImageData(0, 0, canvas.width, canvas.height));
        } catch {
          vin = null;
        }
      }
      if (stopped) return;
      if (vin) {
        stop();
        cb.current.onVin(vin);
        return;
      }
      timer = setTimeout(tick, FRAME_MS);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        timer = setTimeout(tick, FRAME_MS);
      } catch {
        if (!stopped) cb.current.onUnavailable();
      }
    })();

    return stop;
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-lg bg-black">
        <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" aria-label="Camera view" />
        <div className="pointer-events-none absolute inset-x-6 top-1/2 h-16 -translate-y-1/2 rounded-md border-2 border-white/80" aria-hidden="true" />
      </div>
      <Typography variant="paragraph-sm" aria-live="polite">
        {hint
          ? "Can't find the barcode. It's on the windshield corner or the driver's door jamb."
          : "Hold the VIN barcode inside the frame."}
      </Typography>
      <Button type="button" variant="outline" className="min-h-11 self-start" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
```

- [ ] **Step 6: Write `VinStep`**

```tsx
// components/quote/VinStep.tsx
"use client";

import { useState } from "react";

import { Button } from "@/components/ui/b-button";
import { Input } from "@/components/ui/input";
import { Typography } from "@/components/ui/typography";
import { vinCheckOk } from "@/lib/quote/schema";

import { VinScanner } from "./VinScanner";

/**
 * Step 1 of Got the VIN? (task 059): get the VIN by scanning its
 * barcode, from a photo or PDF, or by typing it. Everything that comes
 * back is check-digit validated before it is used.
 */
export function VinStep({
  vin,
  onTypeVin,
  onVin,
  onChooseFile,
  onTakePhoto,
  onSkip,
  busy,
  message,
  canScan,
}: {
  vin: string;
  onTypeVin: (v: string) => void;
  onVin: (vin: string) => void;
  onChooseFile: () => void;
  onTakePhoto: () => void;
  onSkip: () => void;
  busy: boolean;
  message: string;
  canScan: boolean;
}) {
  const [scanning, setScanning] = useState(false);
  const [scanOff, setScanOff] = useState(false);
  const full = vin.length === 17;
  const bad = full && !vinCheckOk(vin);
  const scanAvailable = canScan && !scanOff;

  return (
    <section className="flex flex-col gap-4" aria-label="Find the car by its VIN">
      <div className="flex flex-col gap-1">
        <Typography variant="paragraph-md" className="font-medium">
          Snap or type the VIN
        </Typography>
        <Typography variant="paragraph-sm" className="text-muted-foreground">
          It&apos;s on the windshield corner, the driver&apos;s door jamb, the window sticker or the buyer&apos;s order. We
          fill in the car from it.
        </Typography>
      </div>

      {scanning ? (
        <VinScanner
          onVin={(v) => {
            setScanning(false);
            onVin(v);
          }}
          onUnavailable={() => {
            setScanning(false);
            setScanOff(true);
          }}
          onCancel={() => setScanning(false)}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {scanAvailable ? (
            <Button type="button" className="min-h-11" disabled={busy} onClick={() => setScanning(true)}>
              Scan the barcode
            </Button>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={scanAvailable ? "outline" : "default"} className="min-h-11" disabled={busy} onClick={onChooseFile}>
              Choose a photo or PDF
            </Button>
            <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={onTakePhoto}>
              Take a photo
            </Button>
          </div>
          {scanOff ? (
            <Typography variant="paragraph-xs" className="text-muted-foreground">
              The camera isn&apos;t available here. A photo or typing the VIN works too.
            </Typography>
          ) : null}
        </div>
      )}

      <Typography variant="paragraph-xs" className="text-muted-foreground" aria-live="polite">
        {message}
      </Typography>

      <label className="flex flex-col gap-1">
        <Typography variant="paragraph-xs" className="text-muted-foreground">
          Or type the 17 characters
          {bad ? " · this VIN doesn't check out; please look again" : ""}
        </Typography>
        <Input
          type="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={17}
          value={vin}
          onChange={(e) => {
            const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
            onTypeVin(v);
            if (vinCheckOk(v)) onVin(v);
          }}
          className="min-h-11 font-mono tracking-wide"
        />
      </label>

      <Button type="button" variant="link" linkUnderline="static" className="min-h-11 self-start underline underline-offset-2" onClick={onSkip}>
        No VIN? Enter the deal anyway
      </Button>
    </section>
  );
}
```

- [ ] **Step 7: Rename the entry points**

Apply these exact edits:
- `components/screens/Chrome.tsx:42` comment → `The start screen's header: the wordmark, About, Got the VIN? and the code.`; line 63 `Check a quote` → `Got the VIN?`
- `app/[type]/ResultsClient.tsx:111` `Check a quote` → `Got the VIN?`
- `app/quote/QuoteClient.tsx:13` comment `Check a quote on its own screen` → `Got the VIN? on its own screen`; line 52 `title="Check a quote"` → `title="Got the VIN?"`
- `app/quote/page.tsx:5` → `title: "Got the VIN? · lowkey.autos"`
- `app/[type]/[car]/CarClient.tsx:157` `Compare my quote with this car` → `Compare a deal with this car`

- [ ] **Step 8: Typecheck and commit** (the components are wired in Task 5; here only compile them)

Run: `npx tsc --noEmit -p . 2>&1 | head -20`
Expected: no errors.

```bash
git add lowkey/app/lib/quote/barcode.ts lowkey/app/lib/quote/barcode.test.ts lowkey/app/components/quote/VinScanner.tsx lowkey/app/components/quote/VinStep.tsx lowkey/app/components/screens/Chrome.tsx "lowkey/app/app/[type]/ResultsClient.tsx" lowkey/app/app/quote/QuoteClient.tsx lowkey/app/app/quote/page.tsx "lowkey/app/app/[type]/[car]/CarClient.tsx"
git commit -m "059: VIN step and live scanner; rename Check a quote to Got the VIN?

Assisted-by: agent"
```

---

### Task 5: Wire the flow into `QuoteCheck`; saved list, save and share

**Files:**
- Create: `components/quote/SavedDeals.tsx`, `components/quote/DealActions.tsx`
- Modify: `components/QuoteCheck.tsx`, `app/quote/QuoteClient.tsx`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - `<SavedDeals deals={SavedDeal[]} activeId={string | null} onOpen={(d: SavedDeal) => void} />` (Star and Remove call the store directly)
  - `<DealActions quote={Quote} retention={VinRetention | null} />`
  - `QuoteCheck` props gain `openDealId?: string | null`.

- [ ] **Step 1: Write `SavedDeals`**

```tsx
// components/quote/SavedDeals.tsx
"use client";

import { Button } from "@/components/ui/b-button";
import { Typography } from "@/components/ui/typography";
import { removeDeal, starDeal, type SavedDeal } from "@/lib/deals";
import { dealTitle } from "@/lib/quote/benchmark";

/** The shopper's saved deals (task 059): open one, star the one to compare against, or remove it. */
export function SavedDeals({
  deals,
  activeId,
  onOpen,
}: {
  deals: SavedDeal[];
  activeId: string | null;
  onOpen: (d: SavedDeal) => void;
}) {
  if (!deals.length) return null;
  return (
    <section className="flex flex-col gap-2" aria-label="Your deals">
      <Typography variant="label-md">Your deals</Typography>
      <Typography variant="paragraph-xs" className="text-muted-foreground">
        The starred deal (or the newest) is the one results and car pages compare against. Saved on this device only.
      </Typography>
      <ul className="flex flex-col">
        {deals.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-x-2 border-t border-border py-1">
            <div className="min-w-0 flex-1">
              <Typography variant="paragraph-sm" className="font-medium">
                {dealTitle(d.quote)}
                {d.starred ? " ★" : ""}
              </Typography>
              <Typography variant="paragraph-xs" className="text-muted-foreground">
                {[d.quote.dealerName, d.quote.statedMonthly !== null ? `$${Math.round(d.quote.statedMonthly)}/mo` : null].filter(Boolean).join(" · ") || "No dealer name"}
              </Typography>
            </div>
            <Button type="button" variant={d.id === activeId ? "secondary" : "ghost"} className="min-h-11" onClick={() => onOpen(d)}>
              Open
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" aria-pressed={d.starred} onClick={() => starDeal(d.id)}>
              {d.starred ? "Unstar" : "Star"}
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => removeDeal(d.id)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Write `DealActions`**

```tsx
// components/quote/DealActions.tsx
"use client";

import { useState } from "react";

import { Button } from "@/components/ui/b-button";
import { Typography } from "@/components/ui/typography";
import { saveDeal, storageAvailable } from "@/lib/deals";
import type { VinRetention } from "@/lib/quote/benchmark";
import type { Quote } from "@/lib/quote/schema";
import { shareUrl } from "@/lib/quote/shareLink";

/** Save as my deal / Share (task 059). A deal with unchecked photo fields can't be saved or shared. */
export function DealActions({
  quote,
  retention,
  canSave,
}: {
  quote: Quote;
  retention: VinRetention | null;
  /** True once the quote has enough to compare (a price). */
  canSave: boolean;
}) {
  const [status, setStatus] = useState("");
  const pending = quote.unconfirmed.length > 0;
  const storage = storageAvailable();

  const save = () => {
    const r = saveDeal(quote, retention);
    setStatus(r.ok ? "Saved as your deal. Results and car pages now compare against it." : r.reason === "unavailable" ? "Saving isn't available in this browser." : "Check the highlighted fields first.");
  };

  const share = async () => {
    const url = shareUrl(window.location.origin, quote);
    if (!url) return setStatus("This deal is too long to share as a link.");
    try {
      if (navigator.share) {
        await navigator.share({ url, title: "A deal to look at" });
        return setStatus("");
      }
      await navigator.clipboard.writeText(url);
      setStatus("Link copied.");
    } catch {
      setStatus("");
    }
  };

  return (
    <section className="flex flex-col gap-2" aria-label="Save or share this deal">
      <div className="grid grid-cols-2 gap-2">
        {storage ? (
          <Button type="button" className="min-h-11" disabled={!canSave || pending} onClick={save}>
            Save as my deal
          </Button>
        ) : null}
        <Button type="button" variant="outline" className={`min-h-11 ${storage ? "" : "col-span-2"}`} disabled={!canSave || pending} onClick={() => void share()}>
          Share
        </Button>
      </div>
      <Typography variant="paragraph-xs" className="text-muted-foreground" aria-live="polite">
        {status ||
          (pending
            ? "Check the highlighted fields first."
            : storage
              ? "Saved on this device. A shared link holds the car and the numbers, nothing else."
              : "Saving isn't available in this browser. You can still share a link.")}
      </Typography>
    </section>
  );
}
```

- [ ] **Step 3: Rework `QuoteCheck.tsx`** (these are the exact edits, in file order)

1. Imports: add
```tsx
import { DealActions } from "@/components/quote/DealActions";
import { SavedDeals } from "@/components/quote/SavedDeals";
import { useDeals } from "@/components/quote/useDeals";
import { VinStep } from "@/components/quote/VinStep";
import { loadDeals, type SavedDeal } from "@/lib/deals";
import { estTaxFor, resaleFor, type CarInfo, type VinRetention } from "@/lib/quote/benchmark";
import { decodeDeal } from "@/lib/quote/shareLink";
```
Remove the `taxAmountFor` and `usedRetention` imports if now unused, and delete the local `type VinRetention = …` line (it now comes from `benchmark.ts`).

2. Prop `openDealId?: string | null`. State: 
```tsx
const [step, setStep] = useState<"pending" | "vin" | "deal">("pending");
const [shared, setShared] = useState(false);
const [listingPrice, setListingPrice] = useState<Record<number, number>>({});
const [canScan, setCanScan] = useState(false);
const { deals } = useDeals();
const [activeDeal, setActiveDeal] = useState<string | null>(null);
```

3. In the mount effect (the one that loads the draft), replace the draft block with:
```tsx
setCanScan(Boolean(navigator.mediaDevices?.getUserMedia));
const fromLink = decodeDeal(window.location.hash);
const saved = openDealId ? loadDeals().find((d) => d.id === openDealId) : undefined;
if (fromLink) {
  setQuotes([fromLink]);
  setShared(true);
  setStep("deal");
  if (fromLink.vin) void lookupCar(0, fromLink.vin);
} else if (saved) {
  openSaved(saved);
} else {
  const draft = loadDraft();
  if (draft) setQuotes(draft);
  setStep(draft && draft.some(hasContent) ? "deal" : "vin");
}
```
with, above the component, `const hasContent = (x: Quote) => Boolean(x.vin) || x.sellingPrice !== null || x.outTheDoor !== null || x.statedMonthly !== null || x.apr !== null;`, and inside the component:
```tsx
const openSaved = (d: SavedDeal) => {
  setQuotes([d.quote]);
  setActive(0);
  setActiveDeal(d.id);
  setShared(false);
  setStep("deal");
  const c = d.quote.car;
  if (c) {
    setCarInfo({ 0: { facts: { vin: d.quote.vin ?? "", status: c.status, year: c.year, make: c.make, model: c.model, trim: c.trim, msrp: null, listedPrice: null, miles: c.miles, dealerName: null }, retention: d.retention } });
  } else setCarInfo({});
};
```
(`openSaved` is defined before the mount effect; add `openDealId` to nothing else — the effect keeps `[]`.)

4. Draft saving: `useEffect(() => { if (!shared && step !== "pending") saveDraft(quotes); }, [quotes, shared, step]);`

5. `own` becomes:
```tsx
const infoOf = (i: number): CarInfo | null => {
  const c = carInfo[i];
  return c && c !== "none" ? { year: c.facts.year, miles: c.facts.miles, retention: c.retention } : null;
};
const own = (x: Quote, i: number) => resaleFor(x, infoOf(i), picks, new Date().getFullYear());
```
and `estTax` becomes `const estTax = estTaxFor(q, pick);` (delete the inline computation).

6. `lookupCar`: after setting `carInfo`, also prefill:
```tsx
if (f.listedPrice !== null) setListingPrice((p) => ({ ...p, [index]: f.listedPrice as number }));
```
and in the `setQuotes` patch add `sellingPrice: x.sellingPrice ?? f.listedPrice, dealerName: x.dealerName ?? f.dealerName,`.

7. `onPhoto`: in the barcode `.then`, after `void lookupCar(index, vin)` add `setStep("deal")`. In the read-merge object add `sellingPrice: read.sellingPrice ?? x.sellingPrice,`. After the quotes update and before `return setReadState("idle")` add `setStep("deal");`.

8. Message text: lift the `readState` ternary into `const readMessage = …` (same strings) used by both `VinStep` and the existing caption.

9. Rendering. Rename the sheet `title="Got the VIN?"`, `subtitle="Start with the VIN. It fills in the car; then add the deal you were offered."`. Move the two hidden `<input>`s out of the photo `<section>` to the top of the root `<div className="flex flex-col gap-5 pb-6">`. Then:
```tsx
{step === "pending" ? <div className="min-h-40" aria-busy="true" /> : null}
{step === "vin" ? (
  <>
    <VinStep
      vin={q.vin ?? ""}
      onTypeVin={(v) => update({ vin: v || null }, ["vin"])}
      onVin={(v) => { update({ vin: v }, ["vin"]); void lookupCar(active, v); setStep("deal"); }}
      onChooseFile={() => fileRef.current?.click()}
      onTakePhoto={() => cameraRef.current?.click()}
      onSkip={() => setStep("deal")}
      busy={readState === "reading" || readState === "off"}
      message={readMessage}
      canScan={canScan}
    />
    <SavedDeals deals={deals} activeId={activeDeal} onOpen={openSaved} />
  </>
) : null}
{step === "deal" ? ( … everything that was inside the root div after the inputs: quote tabs, the photo section (heading changed to "Have the offer sheet? Add a photo"), unconfirmed box, fields, fees, analysis, compare table, pick table, then <DealActions> and <SavedDeals>, then Start over … ) : null}
```
- When `shared` is true, show above the quote tabs: a bordered note "Someone shared this deal with you." with buttons **Save as my deal** (calls `saveDeal(q, retentionOf(0))` then `setShared(false)`) and **Check my own** (`setQuotes([emptyQuote()]); setShared(false); setStep("vin"); history.replaceState(null, "", window.location.pathname + window.location.search)`).
- Listing price label: in `numberField`, when `f === "sellingPrice" && q.sellingPrice !== null && q.sellingPrice === listingPrice[active]` append ` · from the listing; change it if they quoted different`.
- `<DealActions quote={q} retention={infoOf(active)?.retention ?? null} canSave={q.sellingPrice !== null || q.outTheDoor !== null} />` placed right after the "What this quote really says" section.
- "Start over": also `setStep("vin")`, `setCarInfo({})`, `setListingPrice({})`, `setActiveDeal(null)`.
- Typed VIN in the deal form keeps its existing field; no change.

10. `app/quote/QuoteClient.tsx`: `const openDealId = params.get("deal");` and pass `openDealId={openDealId}` to `QuoteCheck`; add `openDealId ?? ""` to its `key` so a different deal remounts.

- [ ] **Step 4: Typecheck, test, build**

Run: `npx tsc --noEmit -p . && npm test 2>&1 | tail -8`
Expected: no type errors; all tests pass.

- [ ] **Step 5: Smoke it locally**

Run: `set -a; . ~/.config/low-key/env; set +a; LOWKEY_TABLE_FILE=~/.cache/low-key/table.json npm run build >/tmp/b.log 2>&1; tail -3 /tmp/b.log; LOWKEY_TABLE_FILE=~/.cache/low-key/table.json npx next start -p 3059 >/tmp/s.log 2>&1 &`
Then: `curl -s localhost:3059/quote | grep -o "Got the VIN?" | head -1`
Expected: `Got the VIN?` (the page title and header render).

- [ ] **Step 6: Commit**

```bash
git add lowkey/app/components/QuoteCheck.tsx lowkey/app/components/quote/SavedDeals.tsx lowkey/app/components/quote/DealActions.tsx lowkey/app/app/quote/QuoteClient.tsx
git commit -m "059: VIN first on the quote screen, with saved deals, save and share

Assisted-by: agent"
```

---

### Task 6: "Your deal" on results and car pages

**Files:**
- Create: `components/quote/YourDealRow.tsx`
- Modify: `app/[type]/ResultsClient.tsx`, `app/[type]/[car]/CarClient.tsx`

**Interfaces:**
- Consumes: `useDeals`, `benchmark` (Task 2); `resaleFor`, `dealRowOf`, `dealTitle`, `estTaxFor`, `vsDealLine` (Task 1); `quotePicksOf`, `modelKey` from `@/lib/resultView`; `headsUp`.
- Produces: `<YourDealRow deal={SavedDeal} picks={QuotePick[]} terms={SameTerms} />`.

- [ ] **Step 1: Write `YourDealRow`**

```tsx
// components/quote/YourDealRow.tsx
"use client";

import Link from "next/link";

import type { QuotePick } from "@/components/QuoteCheck";
import { fmtUsd } from "@/components/render/format";
import { Typography } from "@/components/ui/typography";
import type { SavedDeal } from "@/lib/deals";
import { dealRowOf, dealTitle, resaleFor } from "@/lib/quote/benchmark";
import type { SameTerms } from "@/lib/quote/compare";

/** The saved deal as the benchmark above the picks (task 059). Tapping it opens the deal. */
export function YourDealRow({ deal, picks, terms }: { deal: SavedDeal; picks: QuotePick[]; terms: SameTerms }) {
  const q = deal.quote;
  const info = q.car ? { year: q.car.year, miles: q.car.miles, retention: deal.retention } : null;
  const row = dealRowOf(q, terms, resaleFor(q, info, picks, new Date().getFullYear()));
  return (
    <Link
      href={`/quote?deal=${encodeURIComponent(deal.id)}`}
      className="mt-2 flex min-h-11 flex-col gap-0.5 rounded-[10px] border border-border px-3 py-2 text-foreground no-underline hover:bg-muted"
      aria-label={`Your deal: ${dealTitle(q)}`}
    >
      <Typography variant="label-sm" className="text-muted-foreground">
        Your deal
      </Typography>
      <Typography variant="paragraph-md" className="font-medium">
        {dealTitle(q)}
        {q.dealerName ? <span className="font-normal text-muted-foreground"> · {q.dealerName}</span> : null}
      </Typography>
      <Typography variant="paragraph-sm" className="tabular-nums">
        {[row.monthly !== null ? `${fmtUsd(row.monthly)}/mo as quoted` : null, row.outTheDoor !== null ? `${fmtUsd(row.outTheDoor)} out the door` : null]
          .filter(Boolean)
          .join(" · ") || "Add the numbers to compare"}
      </Typography>
      {row.equityMonth !== null ? (
        <Typography variant="paragraph-xs" className="text-muted-foreground">
          Positive equity by month {row.equityMonth}
          {row.basis === "typical" ? " (typical resale)" : ""}
        </Typography>
      ) : null}
    </Link>
  );
}
```

- [ ] **Step 2: Results page**

In `app/[type]/ResultsClient.tsx`: import `YourDealRow`, `useDeals`, `benchmark`, `quotePicksOf`. After `const cars = useMemo(…)` add:
```tsx
const { deals } = useDeals();
const mine = benchmark(deals);
const picks = useMemo(() => (data ? quotePicksOf(data) : []), [data]);
```
(Place the hooks before the `if (!view) return null;` line.) Then render, directly above `<section aria-label={resumeHeading(...)}`:
```tsx
{mine && data ? (
  <YourDealRow
    deal={mine}
    picks={picks}
    terms={{ downRule: data.downRule ?? { kind: "share", share: 0.1 }, aprPercent: data.aprPercent, termMonths: data.termMonths ?? 60 }}
  />
) : null}
```
Check `SearchResult` has `downRule`, `aprPercent`, `termMonths` (the quote screen already reads them: `data?.downRule`, `data?.aprPercent`, `data?.termMonths`); if `downRule` can be undefined the `??` covers it.

- [ ] **Step 3: Car page**

In `app/[type]/[car]/CarClient.tsx`: import `useDeals`, `benchmark`, `headsUp`, `quotePicksOf`, `modelKey`, `estTaxFor`, `resaleFor`, `vsDealLine`. Before `if (!view) return null;` add `const { deals } = useDeals(); const mine = benchmark(deals);`. After the `<div className={updating …}>` card block, add:
```tsx
{mine && data && car ? <VsDeal /> : null}
```
where, inside the component body after `car`/`data` exist, compute:
```tsx
const pickFor = mine && data && car ? quotePicksOf(data).find((p) => p.key === modelKey(car.pick.model, car.pick.make)) ?? null : null;
const vsLine =
  mine && data && pickFor
    ? vsDealLine(
        headsUp(
          mine.quote,
          pickFor.deal,
          data.downRule ?? { kind: "share", share: 0.1 },
          resaleFor(mine.quote, mine.quote.car ? { year: mine.quote.car.year, miles: mine.quote.car.miles, retention: mine.retention } : null, quotePicksOf(data), new Date().getFullYear()),
          estTaxFor(mine.quote, pickFor),
        ),
      )
    : null;
```
and render (instead of `<VsDeal />`):
```tsx
{vsLine && mine ? (
  <p className="mt-3 rounded-[10px] bg-muted px-3 py-2 text-sm">
    {vsLine}.{" "}
    <Link href={`/quote?deal=${encodeURIComponent(mine.id)}`} className="inline-flex min-h-11 items-center underline underline-offset-2">
      See your deal
    </Link>
  </p>
) : null}
```

- [ ] **Step 4: Typecheck and test**

Run: `npx tsc --noEmit -p . && npm test 2>&1 | tail -6`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add lowkey/app/components/quote/YourDealRow.tsx "lowkey/app/app/[type]/ResultsClient.tsx" "lowkey/app/app/[type]/[car]/CarClient.tsx"
git commit -m "059: Your deal row on results and a vs-your-deal line on car pages

Assisted-by: agent"
```

---

### Task 7: Verify, document, open the PR

**Files:**
- Create: `ops/reports/059-lowkey-got-the-vin.md`
- Modify: `lowkey/app/README.md` (route line: `/quote` is Got the VIN?), `ops/tasks/059-lowkey-got-the-vin.md` (status done), `lowkey/docs/specs/2026-11-04-got-the-vin-design.md` (shared link opens as an editable copy)

- [ ] **Step 1: Run the full gates**

```bash
cd ~/cv-meta-hackathon-2026/lowkey/app && npm ci && npm run build && npm test
cd ~/cv-meta-hackathon-2026 && .venv/bin/python -m pytest -q && .venv/bin/python scripts/name_guard.py && .venv/bin/python scripts/secret_guard.py --all
```
Expected: all pass.

- [ ] **Step 2: Browser check at 390 px, light and dark** (scratch Playwright with `executablePath: "/usr/bin/google-chrome"`, local `next start -p 3059` with `LOWKEY_TABLE_FILE`). Steps, each with a screenshot saved to the scratchpad:
  1. `/` header shows "Got the VIN?"; open it → only step 1 shows.
  2. Type the invented VIN `1HGCV2FA9SB601815` with `/api/vin` mocked (route fulfil: `{ok:true,facts:{vin,status:"active",year:2026,make:"Honda",model:"Civic",trim:"Sport",msrp:30000,listedPrice:29500,miles:12,dealerName:"Lakeside Honda"},retention:null}`) → car card, price prefilled "from the listing".
  3. Enter APR 6.9, term 60, down 3000 → analysis shows; **Save as my deal**.
  4. `/sedan?zip=30263` (mock `/api/search` is not needed; real data from the local table) → "Your deal" row above the lineup; same on `/suv`.
  5. A car page → the "vs your deal" line.
  6. Share: read the link from `navigator.clipboard` stub, open it in a fresh context → banner and the deal; "Save as my deal" works.
  7. Scanner: a second launch with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream --use-file-for-fake-video-capture=<y4m of a Code 39 barcode of the invented VIN>`; tap **Scan the barcode** → lands on step 2 with the VIN set. Generate the y4m from a PNG made with `zxing-wasm` `writeBarcode` and converted with `ffmpeg -i code.png -pix_fmt yuv420p code.y4m`.
  8. Camera denied (no fake device flags): scanner button hides after tap with the note.
  Expected: no horizontal scroll at 390, no console errors, rows and buttons ≥ 44 px.

- [ ] **Step 3: impeccable detect**

Run: `detect --viewport 390x844 http://localhost:3059/quote http://localhost:3059/sedan?zip=30263` and again at `--viewport 1280x800`.
Expected: 0 findings. Fix any before continuing.

- [ ] **Step 4: Write the report and update the docs**

Report `ops/reports/059-lowkey-got-the-vin.md`: what shipped, the test counts, screenshots checked, the real preview VIN lookup result (one call), open questions. Set task 059 `status: done`. Spec: change "read-only" in the Share links section to "opens as a copy you can edit, with a banner". README line: `/quote` (Got the VIN?).

- [ ] **Step 5: Push, PR, preview**

```bash
git add ops/reports/059-lowkey-got-the-vin.md ops/tasks/059-lowkey-got-the-vin.md lowkey/docs lowkey/app/README.md
git commit -m "059: report and docs

Assisted-by: agent"
git push -u origin task/059-got-the-vin
gh pr create --base main --title "059: Got the VIN?" --body-file <body>   # body ends with: Assisted-by: agent
vercel inspect <preview-url> --scope meta-cv-hackathon                  # wait for Ready
```
Then verify on the preview server-side: `vercel curl /quote --deployment <preview> --scope meta-cv-hackathon` contains "Got the VIN?", and make **one** real `/api/vin?vin=<a currently listed VIN>` call. Put the preview URL and results in the PR body.

---

## Self-review

**Spec coverage:** rename (T4 step 7); VIN step with scan / photo / type / skip (T4, T5 step 9); car card and fallback (existing, kept); prefilled price, dealer, offer-sheet photo (T5 steps 6–9); Save / Share (T5); stored deals, cap, star, benchmark (T2); results row on every category (T6 step 2); car-page line (T6 step 3); share codec with size and VIN checks (T3); errors table: camera denied (T4 scanner + VinStep `scanOff`), 20 s hint (VinScanner), lookup failure (existing note), storage unavailable (DealActions), bad link (`decodeDeal` null → falls through to the normal flow; the spec's "This link didn't open" message is added in T5 step 3 below); tests and gates (T1–T3, T7).

**Gap fixed:** a bad share link must say so. In T5 step 3 (mount effect), when `window.location.hash` starts with `#d=` and `decodeDeal` returns null, also `setLinkError(true)` and show "This link didn't open; ask for a new one." above step 1. Implement with `const [linkError, setLinkError] = useState(false)`.

**Placeholders:** none; every code step has code. **Types:** `VinRetention` and `CarInfo` are defined once in `lib/quote/benchmark.ts` and imported everywhere; `SavedDeal.retention` uses it; `decodeVinFrame` name is the same in barcode.ts, its test and `VinScanner`.
