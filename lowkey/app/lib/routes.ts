/**
 * Screens and their URLs (task 049, concept B). Every search and setting
 * lives in the URL, so a shared or reopened link shows the same view and
 * the browser's back and forward move between screens:
 *
 *   /                                  start
 *   /sedan?zip=30263                   results (plus down, downPct, apr, term, sort)
 *   /sedan/honda-civic-sedan?zip=…     one car, with its walk-away
 *   /sedan/honda-civic-sedan/listing/1?zip=…   one local unit
 *   /quote?type=sedan&car=honda-civic-sedan&zip=…   check a quote
 *
 * Only the search and the settings are kept; results are always re-run,
 * never restored from storage (task 041).
 */

import { DEFAULT_SORT, isSortKey, type SortKey } from "./chooser";
import type { SearchType } from "./search";

export const TYPES: readonly SearchType[] = ["sedan", "suv", "pickup", "minivan", "hybrid"];
export const TERM_CHOICES = [36, 48, 60, 72] as const;

export function isSearchType(v: unknown): v is SearchType {
  return typeof v === "string" && (TYPES as readonly string[]).includes(v);
}

/** The shopper's terms. Null fields mean the defaults (10% down, 60 months, the Federal Reserve rate). */
export interface Terms {
  down: number | null;
  downPct: number | null;
  apr: number | null;
  term: number | null;
}

export const DEFAULT_TERMS: Terms = { down: null, downPct: null, apr: null, term: null };

export interface View {
  zip: string;
  terms: Terms;
  sort: SortKey;
}

function num(params: URLSearchParams, key: string, min: number, max: number): number | null {
  const raw = params.get(key);
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/** A page's query -> its view, or null without a valid ZIP. Bad settings fall back to the defaults. */
export function parseView(query: string | URLSearchParams): View | null {
  const params = typeof query === "string" ? new URLSearchParams(query.replace(/^\?/, "")) : query;
  const zip = params.get("zip")?.trim() ?? "";
  if (!/^\d{5}$/.test(zip)) return null;
  const down = num(params, "down", 0, 500_000);
  const downPct = down === null ? num(params, "downPct", 0, 100) : null;
  const termRaw = num(params, "term", 36, 72);
  const term = termRaw !== null && (TERM_CHOICES as readonly number[]).includes(termRaw) ? termRaw : null;
  const sort = params.get("sort");
  return {
    zip,
    terms: { down, downPct, apr: num(params, "apr", 0, 30), term: term === 60 ? null : term },
    sort: isSortKey(sort) ? sort : DEFAULT_SORT,
  };
}

/** "?zip=30263&downPct=20&term=72" — only what differs from the defaults. */
export function viewQuery(v: View, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams({ zip: v.zip });
  if (v.terms.down !== null) p.set("down", String(v.terms.down));
  else if (v.terms.downPct !== null && v.terms.downPct !== 10) p.set("downPct", String(v.terms.downPct));
  if (v.terms.apr !== null) p.set("apr", String(v.terms.apr));
  if (v.terms.term !== null && v.terms.term !== 60) p.set("term", String(v.terms.term));
  if (v.sort !== DEFAULT_SORT) p.set("sort", v.sort);
  for (const [k, val] of Object.entries(extra)) p.set(k, val);
  return `?${p.toString()}`;
}

/** The `/api/search` query for a view (the sort is the page's, not the search's). */
export function searchApiQuery(type: SearchType, v: View): string {
  const p = new URLSearchParams({ zip: v.zip, type });
  if (v.terms.down !== null) p.set("down", String(v.terms.down));
  else if (v.terms.downPct !== null) p.set("downPct", String(v.terms.downPct));
  if (v.terms.apr !== null) p.set("apr", String(v.terms.apr));
  if (v.terms.term !== null) p.set("term", String(v.terms.term));
  return `/api/search?${p.toString()}`;
}

export const resultsPath = (type: SearchType, v: View) => `/${type}${viewQuery(v)}`;
export const termsPath = (type: SearchType, v: View) => `/${type}${viewQuery(v, { terms: "1" })}`;
export const carPath = (type: SearchType, slug: string, v: View) => `/${type}/${slug}${viewQuery(v)}`;
export const listingPath = (type: SearchType, slug: string, n: number, v: View) =>
  `/${type}/${slug}/listing/${n}${viewQuery(v)}`;
export function quotePath(v?: { type: SearchType; view: View; car?: string | null }): string {
  if (!v) return "/quote";
  const extra: Record<string, string> = { type: v.type };
  if (v.car) extra.car = v.car;
  return `/quote${viewQuery(v.view, extra)}`;
}

/** "10% down · 60 mo · 7.54% APR", the settings summary line. */
export function termsSummary(t: Terms, aprPercent: number | null): string {
  const down =
    t.down !== null ? `$${Math.round(t.down).toLocaleString("en-US")} down` : `${t.downPct ?? 10}% down`;
  const term = `${t.term ?? 60} mo`;
  const apr = aprPercent !== null ? ` · ${t.apr ?? aprPercent}% APR` : t.apr !== null ? ` · ${t.apr}% APR` : "";
  return `${down} · ${term}${apr}`;
}
