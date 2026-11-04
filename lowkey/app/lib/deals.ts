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
    return parsed
      .flatMap((x) => {
        const r = savedSchema.safeParse(x);
        return r.success ? [r.data as SavedDeal] : [];
      })
      .slice(0, MAX_DEALS);
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
